//! Local Python parser subprocess — no network, files stay on this Mac.

use crate::db::{self, ImportResult, ParsedPayload};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const PARSER_MARKER: &str = "hero_analysis_parser.py";
const IMPORT_SCRIPT: &str = "cardsharpener/scripts/import_hands.py";

pub fn import_paths(app: &AppHandle, paths: Vec<String>) -> Result<ImportResult, String> {
  if paths.is_empty() {
    return Err("No files or folders selected".into());
  }

  let repo = find_repo_root()?;
  let python = find_python(&repo)?;
  let script = repo.join(IMPORT_SCRIPT);
  if !script.is_file() {
    return Err(format!(
      "Import script missing at {}. Re-clone the repo?",
      script.display()
    ));
  }

  let tmp_dir = env::temp_dir();
  let stamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let output_path = tmp_dir.join(format!("cardsharpener-import-{stamp}.json"));

  let mut cmd = Command::new(&python);
  cmd
    .arg(&script)
    .arg("--output")
    .arg(&output_path)
    .args(&paths)
    .current_dir(&repo)
    .env("PYTHONUNBUFFERED", "1");

  let result = cmd
    .output()
    .map_err(|e| format!("Failed to start local Python parser ({}): {e}", python.display()))?;

  if !result.status.success() {
    let stderr = String::from_utf8_lossy(&result.stderr);
    let stdout = String::from_utf8_lossy(&result.stdout);
    let _ = fs::remove_file(&output_path);
    return Err(format!(
      "Python parser failed ({}).\n{stderr}\n{stdout}",
      result.status
    ));
  }

  let json_text = fs::read_to_string(&output_path).map_err(|e| {
    format!(
      "Parser ran but produced no JSON at {}: {e}",
      output_path.display()
    )
  })?;
  let _ = fs::remove_file(&output_path);

  let payload: ParsedPayload = serde_json::from_str(&json_text)
    .map_err(|e| format!("Failed to read parser JSON: {e}"))?;

  if payload.files.is_empty() && payload.hands.is_empty() {
    return Err(
      "No .txt/.xml hand histories found in the selected files or folders".into(),
    );
  }

  let source_label = paths.join("; ");
  db::persist_parsed_import(app, payload, &source_label)
}

fn find_repo_root() -> Result<PathBuf, String> {
  if let Ok(explicit) = env::var("CARDSHARPENER_REPO") {
    let path = PathBuf::from(explicit);
    if path.join(PARSER_MARKER).is_file() {
      return Ok(path);
    }
  }

  let mut starts = Vec::new();
  if let Ok(cwd) = env::current_dir() {
    starts.push(cwd);
  }
  if let Ok(exe) = env::current_exe() {
    if let Some(parent) = exe.parent() {
      starts.push(parent.to_path_buf());
    }
  }

  for start in starts {
    let mut cur = start;
    for _ in 0..10 {
      if cur.join(PARSER_MARKER).is_file() {
        return Ok(cur);
      }
      if !cur.pop() {
        break;
      }
    }
  }

  Err(
    "Could not find the Cardsharpener repo (hero_analysis_parser.py). \
     Set CARDSHARPENER_REPO to the repo root."
      .into(),
  )
}

fn find_python(repo: &Path) -> Result<PathBuf, String> {
  if let Ok(explicit) = env::var("CARDSHARPENER_PYTHON") {
    let path = PathBuf::from(explicit);
    if path.is_file() {
      return Ok(path);
    }
  }

  let candidates = [
    repo.join(".venv/bin/python3"),
    repo.join(".venv/bin/python"),
    repo.join("cardsharpener/.venv/bin/python3"),
    repo.join("cardsharpener/.venv/bin/python"),
  ];
  for candidate in candidates {
    if candidate.is_file() {
      return Ok(candidate);
    }
  }

  if which_python("python3") {
    return Ok(PathBuf::from("python3"));
  }
  if which_python("python") {
    return Ok(PathBuf::from("python"));
  }

  Err(format!(
    "Python not found. Create a local venv:\n  {}\nthen retry Import selected.",
    repo.join("cardsharpener/scripts/setup_import_venv.sh").display()
  ))
}

fn which_python(name: &str) -> bool {
  Command::new(name)
    .arg("-c")
    .arg("import sys")
    .output()
    .map(|o| o.status.success())
    .unwrap_or(false)
}
