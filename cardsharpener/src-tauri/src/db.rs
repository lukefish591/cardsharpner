//! Local SQLite store for Cardsharpener.
//!
//! Hands and actions stay on disk under the app data directory.
//! No remote DB or upload path is wired here.

use rusqlite::{params, Connection};
use serde::Serialize;
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
