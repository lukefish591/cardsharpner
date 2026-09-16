import { invoke } from "@tauri-apps/api/core";
import type { DbStatus, HandSummary } from "../types/poker";

export async function fetchDbStatus(): Promise<DbStatus> {
  return invoke<DbStatus>("get_db_status");
}

export async function fetchAppDataDir(): Promise<string> {
  return invoke<string>("get_app_data_dir");
}

export async function fetchHands(): Promise<HandSummary[]> {
  return invoke<HandSummary[]>("list_hands");
}
