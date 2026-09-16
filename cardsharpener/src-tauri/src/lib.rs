mod db;
mod import;
mod stats;

use tauri::Manager;

#[tauri::command]
fn get_db_status(app: tauri::AppHandle) -> Result<db::DbStatus, String> {
  db::status(&app)
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
fn list_hands(app: tauri::AppHandle) -> Result<Vec<db::HandSummary>, String> {
  db::list_hands(&app)
}

#[tauri::command]
fn get_hand_replay(app: tauri::AppHandle, hand_id: i64) -> Result<db::HandReplay, String> {
  db::get_hand_replay(&app, hand_id)
}

/// Parse local files/folders with the repo Python parsers and write SQLite.
/// Hands never leave this Mac.
#[tauri::command]
fn import_hands(app: tauri::AppHandle, paths: Vec<String>) -> Result<db::ImportResult, String> {
  import::import_paths(&app, paths)
}

#[tauri::command]
fn get_hero_stats(app: tauri::AppHandle) -> Result<stats::HeroStatsPayload, String> {
  stats::hero_stats(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      db::initialize(app.handle()).map_err(|e| {
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
          match import::import_paths(app.handle(), paths) {
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
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_db_status,
      get_app_data_dir,
      list_hands,
      get_hand_replay,
      import_hands,
      get_hero_stats
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
