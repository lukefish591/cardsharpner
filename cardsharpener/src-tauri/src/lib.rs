mod db;

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

/// Placeholder import command — parsers can hook later (local-only).
#[tauri::command]
fn list_hands(_app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
  // Empty list until import/parser wiring lands.
  Ok(Vec::new())
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
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_db_status,
      get_app_data_dir,
      list_hands
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
