//! Local SQLite store for Cardsharpener.
//!
//! Hands and actions stay on disk under the app data directory.
//! No remote DB or upload path is wired here.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const DB_FILE: &str = "cardsharpener.sqlite3";

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
  pub path: String,
  pub hand_count: i64,
  pub action_count: i64,
  pub ready: bool,
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

pub fn open_connection(app: &AppHandle) -> Result<Connection, String> {
  let path = db_path(app)?;
  let conn = Connection::open(&path).map_err(|e| format!("Failed to open SQLite: {e}"))?;
  conn
    .execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;
  Ok(conn)
}

pub fn initialize(app: &AppHandle) -> Result<PathBuf, String> {
  let path = db_path(app)?;
  let conn = Connection::open(&path).map_err(|e| format!("Failed to open SQLite: {e}"))?;
  conn
    .execute_batch(SCHEMA)
    .map_err(|e| format!("Failed to apply schema: {e}"))?;
  // Record stub migration id 1 once.
  conn
    .execute(
      "INSERT OR IGNORE INTO schema_migrations (id) VALUES (?1)",
      params![1],
    )
    .map_err(|e| format!("Failed to record migration: {e}"))?;
  Ok(path)
}

pub fn status(app: &AppHandle) -> Result<DbStatus, String> {
  let path = initialize(app)?;
  let conn = open_connection(app)?;
  let hand_count: i64 = conn
    .query_row("SELECT COUNT(*) FROM hands", [], |r| r.get(0))
    .unwrap_or(0);
  let action_count: i64 = conn
    .query_row("SELECT COUNT(*) FROM actions", [], |r| r.get(0))
    .unwrap_or(0);
  Ok(DbStatus {
    path: path.display().to_string(),
    hand_count,
    action_count,
    ready: true,
  })
}

pub fn list_hands(app: &AppHandle) -> Result<Vec<HandSummary>, String> {
  initialize(app)?;
  let conn = open_connection(app)?;
  let mut stmt = conn
    .prepare(
      "SELECT id, external_hand_id, site, played_at, stakes, hero_cards, hero_net
       FROM hands
       ORDER BY played_at DESC, id DESC",
    )
    .map_err(|e| format!("Failed to prepare list_hands: {e}"))?;
  let rows = stmt
    .query_map([], |row| {
      Ok(HandSummary {
        id: row.get(0)?,
        external_hand_id: row.get(1)?,
        site: row.get(2)?,
        played_at: row.get(3)?,
        stakes: row.get(4)?,
        hero_cards: row.get(5)?,
        hero_net: row.get(6)?,
      })
    })
    .map_err(|e| format!("Failed to query hands: {e}"))?;

  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| format!("Failed to read hand row: {e}"))?);
  }
  Ok(out)
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
  app: &AppHandle,
  payload: ParsedPayload,
  source_label: &str,
) -> Result<ImportResult, String> {
  initialize(app)?;
  let mut conn = open_connection(app)?;
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
