import { invoke } from "@tauri-apps/api/core";
import type { DbStatus, HandSummary, ImportResult } from "../types/poker";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function fetchDbStatus(): Promise<DbStatus> {
  if (!isTauriRuntime()) {
    return {
      path: "(open via npm run tauri dev for live SQLite)",
      handCount: 0,
      actionCount: 0,
      ready: false,
    };
  }
  return invoke<DbStatus>("get_db_status");
}

export async function fetchAppDataDir(): Promise<string> {
  if (!isTauriRuntime()) {
    return "(Tauri app data dir unavailable in browser-only mode)";
  }
  return invoke<string>("get_app_data_dir");
}

export async function fetchHands(): Promise<HandSummary[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<HandSummary[]>("list_hands");
}

export async function importHands(paths: string[]): Promise<ImportResult> {
  if (!isTauriRuntime()) {
    throw new Error("Import needs the Tauri shell — run npm run tauri dev.");
  }
  return invoke<ImportResult>("import_hands", { paths });
}
