//! Local SQLite store for Cardsharpener.
//!
//! Hands and actions stay on disk under the app data directory.
//! No remote DB or upload path is wired here.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::hole;
use crate::stats;

const DB_FILE: &str = "cardsharpener.sqlite3";
const DEFAULT_PAGE_SIZE: i64 = 50;
const MAX_PAGE_SIZE: i64 = 100;

/// Empty schema stub sized for later import + replay + data-only stats.
const SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_hand_id TEXT,
  site TEXT,
  played_at TEXT,
  stakes TEXT,
  table_name TEXT,
  hero_seat INTEGER,
  hero_name TEXT,
  hero_cards TEXT,
  board_cards TEXT,
  pot_total REAL,
  hero_net REAL,
  raw_text TEXT,
  source_path TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hands_played_at ON hands(played_at);
CREATE INDEX IF NOT EXISTS idx_hands_site ON hands(site);
CREATE INDEX IF NOT EXISTS idx_hands_external_id ON hands(external_hand_id);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hand_id INTEGER NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  seat INTEGER,
  name TEXT,
  position TEXT,
  starting_stack REAL,
  is_hero INTEGER NOT NULL DEFAULT 0,
  hole_cards TEXT
);

CREATE INDEX IF NOT EXISTS idx_players_hand ON players(hand_id);

CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hand_id INTEGER NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  street TEXT NOT NULL,
  actor_seat INTEGER,
  actor_name TEXT,
  action_type TEXT NOT NULL,
  amount REAL,
  is_all_in INTEGER NOT NULL DEFAULT 0,
  pot_after REAL
);

CREATE INDEX IF NOT EXISTS idx_actions_hand_seq ON actions(hand_id, seq);
CREATE INDEX IF NOT EXISTS idx_hands_hero_cards ON hands(hero_cards);
CREATE INDEX IF NOT EXISTS idx_hands_stakes ON hands(stakes);
CREATE INDEX IF NOT EXISTS idx_hands_hero_net ON hands(hero_net);

CREATE TABLE IF NOT EXISTS hand_stats (
  hand_id INTEGER PRIMARY KEY REFERENCES hands(id) ON DELETE CASCADE,
  played_at TEXT,
  stakes TEXT,
  position TEXT,
  pot_type TEXT,
  hero_net REAL NOT NULL DEFAULT 0,
  rake REAL NOT NULL DEFAULT 0,
  net_before_rake REAL NOT NULL DEFAULT 0,
  vpip INTEGER NOT NULL DEFAULT 0,
  preflop_raised INTEGER NOT NULL DEFAULT 0,
  preflop_called INTEGER NOT NULL DEFAULT 0,
  three_bet INTEGER NOT NULL DEFAULT 0,
  three_bet_opportunity INTEGER NOT NULL DEFAULT 0,
  four_bet INTEGER NOT NULL DEFAULT 0,
  four_bet_opportunity INTEGER NOT NULL DEFAULT 0,
  saw_flop INTEGER NOT NULL DEFAULT 0,
  won_when_saw_flop INTEGER NOT NULL DEFAULT 0,
  went_to_showdown INTEGER NOT NULL DEFAULT 0,
  won_at_showdown INTEGER NOT NULL DEFAULT 0,
  cbet_flop INTEGER NOT NULL DEFAULT 0,
  cbet_turn INTEGER NOT NULL DEFAULT 0,
  cbet_river INTEGER NOT NULL DEFAULT 0,
  cbet_flop_opportunity INTEGER NOT NULL DEFAULT 0,
  cbet_turn_opportunity INTEGER NOT NULL DEFAULT 0,
  cbet_river_opportunity INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hand_stats_position ON hand_stats(position);
CREATE INDEX IF NOT EXISTS idx_hand_stats_stakes ON hand_stats(stakes);
CREATE INDEX IF NOT EXISTS idx_hand_stats_pot_type ON hand_stats(pot_type);
CREATE INDEX IF NOT EXISTS idx_hand_stats_played_at ON hand_stats(played_at);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  hand_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  notes TEXT
);
"#;

/// One reused SQLite connection (WAL). Commands take this via Tauri state.
pub struct AppDb {
  conn: Mutex<Connection>,
}

impl AppDb {
  pub fn read<T>(&self, f: impl FnOnce(&Connection) -> Result<T, String>) -> Result<T, String> {
    let guard = self
      .conn
      .lock()
      .map_err(|e| format!("Database is locked: {e}"))?;
    f(&guard)
  }

  pub fn write<T>(
    &self,
    f: impl FnOnce(&mut Connection) -> Result<T, String>,
  ) -> Result<T, String> {
    let mut guard = self
      .conn
      .lock()
      .map_err(|e| format!("Database is locked: {e}"))?;
    f(&mut guard)
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
  pub path: String,
  pub hand_count: i64,
  pub action_count: i64,
  pub ready: bool,
  pub stats_ready: bool,
  pub stats_pending: i64,
  pub journal_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandSummary {
  pub id: i64,
  pub external_hand_id: Option<String>,
  pub site: Option<String>,
  pub played_at: Option<String>,
  pub stakes: Option<String>,
  pub hero_cards: Option<String>,
  pub hero_net: Option<f64>,
  pub board_cards: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandPage {
  pub hands: Vec<HandSummary>,
  pub match_count: i64,
  pub db_total: i64,
  pub limit: i64,
  pub offset: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayPlayer {
  pub seat: Option<i64>,
  pub name: Option<String>,
  pub position: Option<String>,
  pub starting_stack: Option<f64>,
  pub is_hero: bool,
  pub hole_cards: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayAction {
  pub id: i64,
  pub seq: i64,
  pub street: String,
  pub actor_seat: Option<i64>,
  pub actor_name: Option<String>,
  pub action_type: String,
  pub amount: Option<f64>,
  pub is_all_in: bool,
  pub pot_after: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandReplay {
  pub id: i64,
  pub external_hand_id: Option<String>,
  pub site: Option<String>,
  pub played_at: Option<String>,
  pub stakes: Option<String>,
  pub table_name: Option<String>,
  pub hero_seat: Option<i64>,
  pub hero_name: Option<String>,
  pub hero_cards: Option<String>,
  pub board_cards: Option<String>,
  pub pot_total: Option<f64>,
  pub hero_net: Option<f64>,
  pub raw_text: Option<String>,
  pub players: Vec<ReplayPlayer>,
  pub actions: Vec<ReplayAction>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
  pub file_count: i64,
  pub hand_count: i64,
  pub skipped_count: i64,
  pub error_count: i64,
  pub batch_id: i64,
  pub notes: String,
}

#[derive(Debug, Deserialize)]
pub struct ParsedPayload {
  #[serde(default)]
  pub files: Vec<String>,
  #[serde(default)]
  pub hands: Vec<ParsedHand>,
  #[serde(default)]
  pub errors: Vec<ParsedError>,
}

#[derive(Debug, Deserialize)]
pub struct ParsedError {
  #[serde(default)]
  pub source_path: String,
  #[serde(default)]
  pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct ParsedHand {
  pub external_hand_id: Option<String>,
  pub site: Option<String>,
  pub played_at: Option<String>,
  pub stakes: Option<String>,
  pub table_name: Option<String>,
  pub hero_seat: Option<i64>,
  pub hero_name: Option<String>,
  pub hero_cards: Option<String>,
  pub board_cards: Option<String>,
  pub pot_total: Option<f64>,
  pub hero_net: Option<f64>,
  pub raw_text: Option<String>,
  pub source_path: Option<String>,
  #[serde(default)]
  pub players: Vec<ParsedPlayer>,
  #[serde(default)]
  pub actions: Vec<ParsedAction>,
}

#[derive(Debug, Deserialize)]
pub struct ParsedPlayer {
  pub seat: Option<i64>,
  pub name: Option<String>,
  pub position: Option<String>,
  pub starting_stack: Option<f64>,
  #[serde(default)]
  pub is_hero: bool,
  pub hole_cards: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ParsedAction {
  pub seq: Option<i64>,
  pub street: Option<String>,
  pub actor_seat: Option<i64>,
  pub actor_name: Option<String>,
  pub action_type: Option<String>,
  pub amount: Option<f64>,
  #[serde(default)]
  pub is_all_in: bool,
  pub pot_after: Option<f64>,
}

pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
  fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {e}"))?;
  Ok(dir.join(DB_FILE))
}

fn apply_pragmas(conn: &Connection) -> Result<(), String> {
  conn
    .busy_timeout(Duration::from_secs(5))
    .map_err(|e| format!("Failed to set busy_timeout: {e}"))?;
  conn
    .query_row("PRAGMA journal_mode = WAL", [], |row| row.get::<_, String>(0))
    .map_err(|e| format!("Failed to enable WAL: {e}"))?;
  conn
    .execute_batch(
      "PRAGMA foreign_keys = ON;
       PRAGMA synchronous = NORMAL;",
    )
    .map_err(|e| format!("Failed to apply SQLite pragmas: {e}"))?;
  Ok(())
}

fn apply_schema(conn: &Connection) -> Result<(), String> {
  conn
    .execute_batch(SCHEMA)
    .map_err(|e| format!("Failed to apply schema: {e}"))?;
  conn
    .execute(
      "INSERT OR IGNORE INTO schema_migrations (id) VALUES (?1)",
      params![1],
    )
    .map_err(|e| format!("Failed to record migration 1: {e}"))?;
  conn
    .execute(
      "INSERT OR IGNORE INTO schema_migrations (id) VALUES (?1)",
      params![2],
    )
    .map_err(|e| format!("Failed to record migration 2: {e}"))?;
  Ok(())
}

pub fn initialize(app: &AppHandle) -> Result<PathBuf, String> {
  let path = db_path(app)?;
  let conn = Connection::open(&path).map_err(|e| format!("Failed to open SQLite: {e}"))?;
  apply_pragmas(&conn)?;
  apply_schema(&conn)?;
  Ok(path)
}

pub fn initialize_managed(app: &AppHandle) -> Result<AppDb, String> {
  let path = initialize(app)?;
  let conn = Connection::open(&path).map_err(|e| format!("Failed to open SQLite: {e}"))?;
  apply_pragmas(&conn)?;
  apply_schema(&conn)?;
  Ok(AppDb {
    conn: Mutex::new(conn),
  })
}

pub fn status(conn: &Connection, path: &str) -> Result<DbStatus, String> {
  let hand_count: i64 = conn
    .query_row("SELECT COUNT(*) FROM hands", [], |r| r.get(0))
    .unwrap_or(0);
  let action_count: i64 = conn
    .query_row("SELECT COUNT(*) FROM actions", [], |r| r.get(0))
    .unwrap_or(0);
  let stats_count: i64 = conn
    .query_row("SELECT COUNT(*) FROM hand_stats", [], |r| r.get(0))
    .unwrap_or(0);
  let stats_pending = (hand_count - stats_count).max(0);
  let journal_mode: String = conn
    .query_row("PRAGMA journal_mode", [], |r| r.get::<_, String>(0))
    .unwrap_or_else(|_| "unknown".into());
  Ok(DbStatus {
    path: path.to_string(),
    hand_count,
    action_count,
    ready: true,
    stats_ready: stats_pending == 0,
    stats_pending,
    journal_mode,
  })
}

fn like_needle(raw: &str) -> String {
  let trimmed = raw.trim().to_ascii_lowercase();
  let escaped = trimmed
    .replace('\\', "\\\\")
    .replace('%', "\\%")
    .replace('_', "\\_");
  format!("%{escaped}%")
}

fn clamp_page(limit: Option<i64>, offset: Option<i64>) -> (i64, i64) {
  let limit = limit.unwrap_or(DEFAULT_PAGE_SIZE).clamp(1, MAX_PAGE_SIZE);
  let offset = offset.unwrap_or(0).max(0);
  (limit, offset)
}

fn hands_order_sql(sort: &str) -> &'static str {
  match sort.trim().to_ascii_lowercase().as_str() {
    "oldest" => "h.played_at ASC, h.id ASC",
    "won" | "most-won" | "most_won" => "COALESCE(h.hero_net, 0) DESC, h.id DESC",
    "lost" | "most-lost" | "most_lost" => "COALESCE(h.hero_net, 0) ASC, h.id ASC",
    _ => "h.played_at DESC, h.id DESC",
  }
}

/// Paged hand search. Never selects `raw_text`. Empty query = newest page.
/// Position / pot-type / exact stakes filter through `hand_stats` (no full-table load).
pub fn list_hands_page(
  conn: &Connection,
  query: Option<String>,
  site: Option<String>,
  stakes: Option<String>,
  date_from: Option<String>,
  date_to: Option<String>,
  position: Option<String>,
  pot_type: Option<String>,
  sort: Option<String>,
  limit: Option<i64>,
  offset: Option<i64>,
) -> Result<HandPage, String> {
  let (limit, offset) = clamp_page(limit, offset);
  let query = query.unwrap_or_default();
  let site = site.unwrap_or_default();
  let stakes = stakes.unwrap_or_default();
  let date_from = date_from.unwrap_or_default();
  let date_to = date_to.unwrap_or_default();
  let position = position.unwrap_or_default();
  let pot_type = pot_type.unwrap_or_default();

  let q = if query.trim().is_empty() {
    String::new()
  } else {
    like_needle(&query)
  };
  let site_q = if site.trim().is_empty() {
    String::new()
  } else {
    like_needle(&site)
  };
  let stakes_q = stakes.trim().to_string();
  let from_q = date_from.trim().to_string();
  let to_q = if date_to.trim().is_empty() {
    String::new()
  } else {
    format!("{}z", date_to.trim())
  };
  let position_q = position.trim().to_string();
  let pot_type_q = pot_type.trim().to_string();
  let order_sql = hands_order_sql(&sort.unwrap_or_default());

  let hole_sql = hole::hole_filter_sql(&query)
    .map(|pred| format!(" OR ({pred})"))
    .unwrap_or_default();
  let where_sql = format!(
    r#"
    WHERE (?1 = '' OR (
      LOWER(COALESCE(h.external_hand_id, '')) LIKE ?1 ESCAPE '\'
      OR LOWER(COALESCE(h.hero_cards, '')) LIKE ?1 ESCAPE '\'
      OR LOWER(REPLACE(COALESCE(h.hero_cards, ''), ' ', '')) LIKE ?1 ESCAPE '\'
      {hole_sql}
    ))
    AND (?2 = '' OR LOWER(COALESCE(h.site, '')) LIKE ?2 ESCAPE '\')
    AND (?3 = '' OR COALESCE(s.stakes, h.stakes) = ?3)
    AND (?4 = '' OR COALESCE(h.played_at, '') >= ?4)
    AND (?5 = '' OR COALESCE(h.played_at, '') <= ?5)
    AND (?6 = '' OR s.position = ?6)
    AND (?7 = '' OR s.pot_type = ?7)
  "#
  );

  let db_total: i64 = conn
    .query_row("SELECT COUNT(*) FROM hands", [], |r| r.get(0))
    .map_err(|e| format!("Failed to count hands: {e}"))?;

  let match_sql = format!(
    "SELECT COUNT(*) FROM hands h LEFT JOIN hand_stats s ON s.hand_id = h.id {where_sql}"
  );
  let match_count: i64 = conn
    .query_row(
      &match_sql,
      params![q, site_q, stakes_q, from_q, to_q, position_q, pot_type_q],
      |r| r.get(0),
    )
    .map_err(|e| format!("Failed to count matching hands: {e}"))?;

  let list_sql = format!(
    "SELECT h.id, h.external_hand_id, h.site, h.played_at, h.stakes, h.hero_cards, h.hero_net, h.board_cards
     FROM hands h
     LEFT JOIN hand_stats s ON s.hand_id = h.id
     {where_sql}
     ORDER BY {order_sql}
     LIMIT ?8 OFFSET ?9"
  );
  let mut stmt = conn
    .prepare(&list_sql)
    .map_err(|e| format!("Failed to prepare list_hands_page: {e}"))?;
  let rows = stmt
    .query_map(
      params![
        q,
        site_q,
        stakes_q,
        from_q,
        to_q,
        position_q,
        pot_type_q,
        limit,
        offset
      ],
      |row| {
        Ok(HandSummary {
          id: row.get(0)?,
          external_hand_id: row.get(1)?,
          site: row.get(2)?,
          played_at: row.get(3)?,
          stakes: row.get(4)?,
          hero_cards: row.get(5)?,
          hero_net: row.get(6)?,
          board_cards: row.get(7)?,
        })
      },
    )
    .map_err(|e| format!("Failed to query hands page: {e}"))?;

  let mut hands = Vec::with_capacity(limit as usize);
  for row in rows {
    hands.push(row.map_err(|e| format!("Failed to read hand row: {e}"))?);
  }

  Ok(HandPage {
    hands,
    match_count,
    db_total,
    limit,
    offset,
  })
}

pub fn get_hand_replay(conn: &Connection, hand_id: i64) -> Result<HandReplay, String> {
  let hand = conn
    .query_row(
      "SELECT id, external_hand_id, site, played_at, stakes, table_name,
              hero_seat, hero_name, hero_cards, board_cards, pot_total, hero_net, raw_text
       FROM hands WHERE id = ?1",
      params![hand_id],
      |row| {
        Ok(HandReplay {
          id: row.get(0)?,
          external_hand_id: row.get(1)?,
          site: row.get(2)?,
          played_at: row.get(3)?,
          stakes: row.get(4)?,
          table_name: row.get(5)?,
          hero_seat: row.get(6)?,
          hero_name: row.get(7)?,
          hero_cards: row.get(8)?,
          board_cards: row.get(9)?,
          pot_total: row.get(10)?,
          hero_net: row.get(11)?,
          raw_text: row.get(12)?,
          players: Vec::new(),
          actions: Vec::new(),
        })
      },
    )
    .optional()
    .map_err(|e| format!("Failed to load hand {hand_id}: {e}"))?
    .ok_or_else(|| format!("Hand {hand_id} not found"))?;

  let mut replay = hand;

  let mut player_stmt = conn
    .prepare(
      "SELECT seat, name, position, starting_stack, is_hero, hole_cards
       FROM players WHERE hand_id = ?1 ORDER BY seat ASC, id ASC",
    )
    .map_err(|e| format!("Failed to prepare players: {e}"))?;
  let player_rows = player_stmt
    .query_map(params![hand_id], |row| {
      let is_hero: i64 = row.get(4)?;
      Ok(ReplayPlayer {
        seat: row.get(0)?,
        name: row.get(1)?,
        position: row.get(2)?,
        starting_stack: row.get(3)?,
        is_hero: is_hero != 0,
        hole_cards: row.get(5)?,
      })
    })
    .map_err(|e| format!("Failed to query players: {e}"))?;
  for row in player_rows {
    replay
      .players
      .push(row.map_err(|e| format!("Failed to read player: {e}"))?);
  }

  let mut action_stmt = conn
    .prepare(
      "SELECT id, seq, street, actor_seat, actor_name, action_type, amount, is_all_in, pot_after
       FROM actions WHERE hand_id = ?1 ORDER BY seq ASC, id ASC",
    )
    .map_err(|e| format!("Failed to prepare actions: {e}"))?;
  let action_rows = action_stmt
    .query_map(params![hand_id], |row| {
      let is_all_in: i64 = row.get(7)?;
      Ok(ReplayAction {
        id: row.get(0)?,
        seq: row.get(1)?,
        street: row.get(2)?,
        actor_seat: row.get(3)?,
        actor_name: row.get(4)?,
        action_type: row.get(5)?,
        amount: row.get(6)?,
        is_all_in: is_all_in != 0,
        pot_after: row.get(8)?,
      })
    })
    .map_err(|e| format!("Failed to query actions: {e}"))?;
  for row in action_rows {
    replay
      .actions
      .push(row.map_err(|e| format!("Failed to read action: {e}"))?);
  }

  Ok(replay)
}

fn empty_to_none(value: Option<String>) -> Option<String> {
  value.and_then(|s| {
    let trimmed = s.trim().to_string();
    if trimmed.is_empty() {
      None
    } else {
      Some(trimmed)
    }
  })
}

fn hand_already_imported(conn: &Connection, external_id: &str) -> Result<bool, String> {
  if external_id.is_empty() {
    return Ok(false);
  }
  let existing: Option<i64> = conn
    .query_row(
      "SELECT id FROM hands WHERE external_hand_id = ?1 LIMIT 1",
      params![external_id],
      |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("Failed to check existing hand: {e}"))?;
  Ok(existing.is_some())
}

pub fn persist_parsed_import(
  conn: &mut Connection,
  payload: ParsedPayload,
  source_label: &str,
) -> Result<ImportResult, String> {
  let tx = conn
    .transaction()
    .map_err(|e| format!("Failed to start import transaction: {e}"))?;

  tx.execute(
    "INSERT INTO import_batches (source_path, file_count, hand_count, status, notes)
     VALUES (?1, ?2, 0, 'running', ?3)",
    params![
      source_label,
      payload.files.len() as i64,
      format!("{} parser errors pending", payload.errors.len())
    ],
  )
  .map_err(|e| format!("Failed to record import batch: {e}"))?;
  let batch_id = tx.last_insert_rowid();

  let mut inserted = 0i64;
  let mut skipped = 0i64;

  for hand in &payload.hands {
    let external_id = hand
      .external_hand_id
      .as_deref()
      .unwrap_or("")
      .trim()
      .to_string();
    if hand_already_imported(&tx, &external_id)? {
      skipped += 1;
      continue;
    }

    tx.execute(
      "INSERT INTO hands (
         external_hand_id, site, played_at, stakes, table_name,
         hero_seat, hero_name, hero_cards, board_cards, pot_total,
         hero_net, raw_text, source_path
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
      params![
        empty_to_none(Some(external_id.clone())),
        empty_to_none(hand.site.clone()),
        empty_to_none(hand.played_at.clone()),
        empty_to_none(hand.stakes.clone()),
        empty_to_none(hand.table_name.clone()),
        hand.hero_seat,
        empty_to_none(hand.hero_name.clone()),
        empty_to_none(hand.hero_cards.clone()),
        empty_to_none(hand.board_cards.clone()),
        hand.pot_total,
        hand.hero_net,
        hand.raw_text.clone(),
        empty_to_none(hand.source_path.clone()),
      ],
    )
    .map_err(|e| format!("Failed to insert hand {external_id}: {e}"))?;
    let hand_id = tx.last_insert_rowid();

    for player in &hand.players {
      tx.execute(
        "INSERT INTO players (
           hand_id, seat, name, position, starting_stack, is_hero, hole_cards
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
          hand_id,
          player.seat,
          empty_to_none(player.name.clone()),
          empty_to_none(player.position.clone()),
          player.starting_stack,
          if player.is_hero { 1 } else { 0 },
          empty_to_none(player.hole_cards.clone()),
        ],
      )
      .map_err(|e| format!("Failed to insert player for hand {external_id}: {e}"))?;
    }

    for action in &hand.actions {
      tx.execute(
        "INSERT INTO actions (
           hand_id, seq, street, actor_seat, actor_name, action_type,
           amount, is_all_in, pot_after
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
          hand_id,
          action.seq.unwrap_or(0),
          action.street.clone().unwrap_or_else(|| "unknown".into()),
          action.actor_seat,
          empty_to_none(action.actor_name.clone()),
          action
            .action_type
            .clone()
            .unwrap_or_else(|| "unknown".into()),
          action.amount,
          if action.is_all_in { 1 } else { 0 },
          action.pot_after,
        ],
      )
      .map_err(|e| format!("Failed to insert action for hand {external_id}: {e}"))?;
    }

    let position = hand
      .players
      .iter()
      .find(|p| p.is_hero)
      .and_then(|p| p.position.clone())
      .and_then(|s| {
        let trimmed = s.trim().to_string();
        if trimmed.is_empty() {
          None
        } else {
          Some(trimmed)
        }
      })
      .unwrap_or_else(|| "Unknown".into());
    let hero_starting_stack = hand
      .players
      .iter()
      .find(|p| p.is_hero)
      .and_then(|p| p.starting_stack);
    let load = stats::HandLoad {
      id: hand_id,
      played_at: hand.played_at.clone(),
      stakes: hand.stakes.clone(),
      hero_name: hand.hero_name.clone(),
      hero_net: hand.hero_net,
      raw_text: hand.raw_text.clone(),
      board_cards: hand.board_cards.clone(),
      hero_starting_stack,
    };
    let actions: Vec<stats::ActionLoad> = hand
      .actions
      .iter()
      .map(|action| stats::ActionLoad {
        street: action.street.clone().unwrap_or_else(|| "unknown".into()),
        actor_name: action.actor_name.clone(),
        action_type: action
          .action_type
          .clone()
          .unwrap_or_else(|| "unknown".into()),
        amount: action.amount,
        is_all_in: action.is_all_in,
      })
      .collect();
    let row = stats::classify_hand(&load, &position, &actions);
    stats::insert_row(&tx, &row)?;

    inserted += 1;
  }

  let error_count = payload.errors.len() as i64;
  let status = if inserted == 0 && error_count > 0 {
    "error"
  } else if error_count > 0 || skipped > 0 {
    "partial"
  } else {
    "ok"
  };
  let error_preview: Vec<String> = payload
    .errors
    .iter()
    .take(3)
    .map(|err| format!("{}: {}", err.source_path, err.message))
    .collect();
  let notes = if error_preview.is_empty() {
    format!("inserted={inserted}; skipped={skipped}; parser_errors={error_count}")
  } else {
    format!(
      "inserted={inserted}; skipped={skipped}; parser_errors={error_count}; {}",
      error_preview.join(" | ")
    )
  };

  tx.execute(
    "UPDATE import_batches
     SET hand_count = ?1, status = ?2, finished_at = datetime('now'), notes = ?3
     WHERE id = ?4",
    params![inserted, status, notes, batch_id],
  )
  .map_err(|e| format!("Failed to finalize import batch: {e}"))?;

  tx.commit()
    .map_err(|e| format!("Failed to commit import: {e}"))?;

  Ok(ImportResult {
    file_count: payload.files.len() as i64,
    hand_count: inserted,
    skipped_count: skipped,
    error_count,
    batch_id,
    notes,
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  fn seed_hands(conn: &Connection, count: i64) {
    for i in 1..=count {
      conn
        .execute(
          "INSERT INTO hands (external_hand_id, site, played_at, stakes, hero_cards, hero_net)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
          params![
            format!("HH{i:04}"),
            "PokerStars",
            format!("2024-09-{:02} 12:00:00", (i % 28) + 1),
            "$0.05/$0.10",
            if i % 2 == 0 { "Qc Jd" } else { "Ah Kd" },
            0.1 * i as f64,
          ],
        )
        .unwrap();
    }
  }

  #[test]
  fn list_hands_page_returns_newest_slice_not_all_rows() {
    let conn = Connection::open_in_memory().unwrap();
    apply_schema(&conn).unwrap();
    seed_hands(&conn, 120);
    let page = list_hands_page(
      &conn,
      None,
      None,
      None,
      None,
      None,
      None,
      None,
      None,
      Some(50),
      Some(0),
    )
    .unwrap();
    assert_eq!(page.db_total, 120);
    assert_eq!(page.match_count, 120);
    assert_eq!(page.hands.len(), 50);
    assert_eq!(page.limit, 50);
    let search = list_hands_page(
      &conn,
      Some("qc".into()),
      None,
      None,
      None,
      None,
      None,
      None,
      None,
      Some(50),
      Some(0),
    )
    .unwrap();
    assert_eq!(search.match_count, 60);
    assert_eq!(search.hands.len(), 50);
    assert!(search
      .hands
      .iter()
      .all(|h| h.hero_cards.as_deref() == Some("Qc Jd")));
  }

  #[test]
  fn list_hands_page_filters_hand_stats_without_loading_all() {
    let conn = Connection::open_in_memory().unwrap();
    apply_schema(&conn).unwrap();
    seed_hands(&conn, 40);
    conn
      .execute(
        "UPDATE hands SET board_cards = 'Ah Kd Qc 2s 7h' WHERE id = 1",
        [],
      )
      .unwrap();
    conn
      .execute(
        "INSERT INTO hand_stats (hand_id, played_at, stakes, position, pot_type, hero_net)
         VALUES (1, '2024-09-02 12:00:00', '$0.05/$0.10', 'Button', '3-Bet Pot', 0.5)",
        [],
      )
      .unwrap();
    conn
      .execute(
        "INSERT INTO hand_stats (hand_id, played_at, stakes, position, pot_type, hero_net)
         VALUES (2, '2024-09-03 12:00:00', '$0.05/$0.10', 'Cutoff', 'SRP', 0.2)",
        [],
      )
      .unwrap();

    let filtered = list_hands_page(
      &conn,
      None,
      None,
      None,
      None,
      None,
      Some("Button".into()),
      Some("3-Bet Pot".into()),
      None,
      Some(50),
      Some(0),
    )
    .unwrap();
    assert_eq!(filtered.match_count, 1);
    assert_eq!(filtered.hands.len(), 1);
    assert_eq!(filtered.hands[0].id, 1);
    assert_eq!(
      filtered.hands[0].board_cards.as_deref(),
      Some("Ah Kd Qc 2s 7h")
    );

    let by_stakes = list_hands_page(
      &conn,
      None,
      None,
      Some("$0.05/$0.10".into()),
      None,
      None,
      None,
      None,
      None,
      Some(50),
      Some(0),
    )
    .unwrap();
    assert_eq!(by_stakes.match_count, 40);
    assert_eq!(by_stakes.hands.len(), 40);
  }

  #[test]
  fn list_hands_page_sorts_by_date_and_net() {
    let conn = Connection::open_in_memory().unwrap();
    apply_schema(&conn).unwrap();
    let rows = [
      ("HH1", "2024-01-01 12:00:00", 5.0),
      ("HH2", "2024-03-01 12:00:00", -2.0),
      ("HH3", "2024-02-01 12:00:00", 1.0),
    ];
    for (id, when, net) in rows {
      conn
        .execute(
          "INSERT INTO hands (external_hand_id, site, played_at, stakes, hero_cards, hero_net)
           VALUES (?1, 'PokerStars', ?2, '$0.05/$0.10', 'Ah Kd', ?3)",
          params![id, when, net],
        )
        .unwrap();
    }

    let ids = |sort: &str| {
      list_hands_page(
        &conn,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        Some(sort.into()),
        Some(50),
        Some(0),
      )
      .unwrap()
      .hands
      .into_iter()
      .map(|h| h.external_hand_id.unwrap_or_default())
      .collect::<Vec<_>>()
    };

    assert_eq!(ids("newest"), ["HH2", "HH3", "HH1"]);
    assert_eq!(ids("oldest"), ["HH1", "HH3", "HH2"]);
    assert_eq!(ids("won"), ["HH1", "HH3", "HH2"]);
    assert_eq!(ids("lost"), ["HH2", "HH3", "HH1"]);
  }

  #[test]
  fn list_hands_page_filters_exact_and_generic_hole_cards() {
    let conn = Connection::open_in_memory().unwrap();
    apply_schema(&conn).unwrap();
    let rows = [
      ("EX1", "Ah Kd"),
      ("SU1", "Ah Kh"),
      ("OF1", "As Kd"),
      ("PR1", "Ah Ad"),
      ("OT1", "Qc Jd"),
    ];
    for (id, cards) in rows {
      conn
        .execute(
          "INSERT INTO hands (external_hand_id, site, played_at, stakes, hero_cards, hero_net)
           VALUES (?1, 'PokerStars', '2024-01-01 12:00:00', '$0.05/$0.10', ?2, 0)",
          params![id, cards],
        )
        .unwrap();
    }

    let ids = |query: &str| {
      list_hands_page(
        &conn,
        Some(query.into()),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        Some(50),
        Some(0),
      )
      .unwrap()
      .hands
      .into_iter()
      .map(|h| h.external_hand_id.unwrap_or_default())
      .collect::<Vec<_>>()
    };

    assert_eq!(ids("Ah Kd"), ["EX1"]);
    assert_eq!(ids("AKs"), ["SU1"]);
    let offsuit = ids("AKo");
    assert!(offsuit.contains(&"EX1".into()));
    assert!(offsuit.contains(&"OF1".into()));
    assert_eq!(offsuit.len(), 2);
    let any_ak = ids("AK");
    assert_eq!(any_ak.len(), 3);
    assert_eq!(ids("AA"), ["PR1"]);
  }
}
