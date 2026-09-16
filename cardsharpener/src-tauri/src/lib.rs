mod db;
mod import;
mod stats;

use tauri::{Manager, State};

#[tauri::command]
fn get_db_status(app: tauri::AppHandle, db: State<db::AppDb>) -> Result<db::DbStatus, String> {
  let path = db::db_path(&app)?;
  db.read(|conn| db::status(conn, &path.display().to_string()))
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
  app
    .path()
    .app_data_dir()
    .map(|p| p.display().to_string())
    .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

#[tauri::command]
fn list_hands_page(
  db: State<db::AppDb>,
  query: Option<String>,
  site: Option<String>,
  stakes: Option<String>,
  date_from: Option<String>,
  date_to: Option<String>,
  position: Option<String>,
  pot_type: Option<String>,
  limit: Option<i64>,
  offset: Option<i64>,
) -> Result<db::HandPage, String> {
  db.read(|conn| {
    db::list_hands_page(
      conn, query, site, stakes, date_from, date_to, position, pot_type, limit, offset,
    )
  })
}

#[tauri::command]
fn get_hand_replay(db: State<db::AppDb>, hand_id: i64) -> Result<db::HandReplay, String> {
  db.read(|conn| db::get_hand_replay(conn, hand_id))
}

/// Parse local files/folders with the repo Python parsers and write SQLite.
/// Hands never leave this Mac.
#[tauri::command]
fn import_hands(db: State<db::AppDb>, paths: Vec<String>) -> Result<db::ImportResult, String> {
  db.write(|conn| import::import_paths(conn, paths))
}

#[tauri::command]
fn backfill_hand_stats(db: State<db::AppDb>) -> Result<i64, String> {
  db.write(stats::backfill_missing)
}

#[tauri::command]
fn get_stats_overview(
  db: State<db::AppDb>,
  position: Option<String>,
  stakes: Option<String>,
  pot_type: Option<String>,
) -> Result<stats::StatsOverview, String> {
  let filter = stats::StatsFilter {
    position: position.unwrap_or_default(),
    stakes: stakes.unwrap_or_default(),
    pot_type: pot_type.unwrap_or_default(),
  };
  db.write(|conn| {
    stats::ensure_stats(conn)?;
    stats::overview(conn, &filter)
  })
}

#[tauri::command]
fn get_stats_playstyle(
  db: State<db::AppDb>,
  position: Option<String>,
  stakes: Option<String>,
  pot_type: Option<String>,
) -> Result<stats::StatsPlaystyle, String> {
  let filter = stats::StatsFilter {
    position: position.unwrap_or_default(),
    stakes: stakes.unwrap_or_default(),
    pot_type: pot_type.unwrap_or_default(),
  };
  db.write(|conn| {
    stats::ensure_stats(conn)?;
    stats::playstyle(conn, &filter)
  })
}

#[tauri::command]
fn get_equity_curve(
  db: State<db::AppDb>,
  position: Option<String>,
  stakes: Option<String>,
  pot_type: Option<String>,
) -> Result<stats::EquityCurvePayload, String> {
  let filter = stats::StatsFilter {
    position: position.unwrap_or_default(),
    stakes: stakes.unwrap_or_default(),
    pot_type: pot_type.unwrap_or_default(),
  };
  db.write(|conn| {
    stats::ensure_stats(conn)?;
    stats::equity_curve(conn, &filter)
  })
}

#[tauri::command]
fn get_stats_breakdown(
  db: State<db::AppDb>,
  position: Option<String>,
  stakes: Option<String>,
  pot_type: Option<String>,
) -> Result<stats::StatsBreakdowns, String> {
  let filter = stats::StatsFilter {
    position: position.unwrap_or_default(),
    stakes: stakes.unwrap_or_default(),
    pot_type: pot_type.unwrap_or_default(),
  };
  db.write(|conn| {
    stats::ensure_stats(conn)?;
    stats::breakdowns(conn, &filter)
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let managed = db::initialize_managed(app.handle()).map_err(|e| {
        Box::<dyn std::error::Error>::from(std::io::Error::other(e))
      })?;
      // Optional local automation: CARDSHARPENER_IMPORT_ON_START=/path/file.txt[:/path/dir]
      if let Ok(raw) = std::env::var("CARDSHARPENER_IMPORT_ON_START") {
        let paths: Vec<String> = raw
          .split(':')
          .map(str::trim)
          .filter(|s| !s.is_empty())
          .map(str::to_string)
          .collect();
        if !paths.is_empty() {
          match managed.write(|conn| import::import_paths(conn, paths)) {
            Ok(result) => {
              eprintln!(
                "Startup import: {} hands from {} files ({})",
                result.hand_count, result.file_count, result.notes
              );
            }
            Err(e) => eprintln!("Startup import failed: {e}"),
          }
        }
      }
      match managed.write(stats::backfill_missing) {
        Ok(written) if written > 0 => {
          eprintln!("Startup hand_stats backfill wrote {written} rows");
        }
        Err(e) => eprintln!("Startup hand_stats backfill failed: {e}"),
        _ => {}
      }
      app.manage(managed);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_db_status,
      get_app_data_dir,
      list_hands_page,
      get_hand_replay,
      import_hands,
      backfill_hand_stats,
      get_stats_overview,
      get_stats_playstyle,
      get_equity_curve,
      get_stats_breakdown
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
