import { invoke } from "@tauri-apps/api/core";
import type {
  DbStatus,
  EquityCurvePayload,
  HandPage,
  HandReplay,
  ImportResult,
  StatsBreakdowns,
  StatsFilters,
  StatsOverview,
  StatsPlaystyle,
} from "../types/poker";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const EMPTY_PAGE: HandPage = {
  hands: [],
  matchCount: 0,
  dbTotal: 0,
  limit: 50,
  offset: 0,
};

export interface HandsPageQuery {
  query?: string;
  site?: string;
  stakes?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function fetchDbStatus(): Promise<DbStatus> {
  if (!isTauriRuntime()) {
    return {
      path: "(open via npm run tauri dev for live SQLite)",
      handCount: 0,
      actionCount: 0,
      ready: false,
      statsReady: false,
      statsPending: 0,
      journalMode: "n/a",
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

export async function fetchHandsPage(input: HandsPageQuery = {}): Promise<HandPage> {
  if (!isTauriRuntime()) {
    return { ...EMPTY_PAGE, limit: input.limit ?? 50, offset: input.offset ?? 0 };
  }
  return invoke<HandPage>("list_hands_page", {
    query: input.query ?? "",
    site: input.site ?? "",
    stakes: input.stakes ?? "",
    dateFrom: input.dateFrom ?? "",
    dateTo: input.dateTo ?? "",
    date_from: input.dateFrom ?? "",
    date_to: input.dateTo ?? "",
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  });
}

export async function fetchHandReplay(handId: number): Promise<HandReplay> {
  if (!isTauriRuntime()) {
    throw new Error("Replay needs the Tauri shell — run npm run tauri dev.");
  }
  return invoke<HandReplay>("get_hand_replay", { handId, hand_id: handId });
}

export async function importHands(paths: string[]): Promise<ImportResult> {
  if (!isTauriRuntime()) {
    throw new Error("Import needs the Tauri shell — run npm run tauri dev.");
  }
  return invoke<ImportResult>("import_hands", { paths });
}

export async function backfillHandStats(): Promise<number> {
  if (!isTauriRuntime()) {
    return 0;
  }
  return invoke<number>("backfill_hand_stats");
}

function statsArgs(filters: StatsFilters) {
  return {
    position: filters.position,
    stakes: filters.stakes,
    potType: filters.potType,
    pot_type: filters.potType,
  };
}

export async function fetchStatsOverview(
  filters: StatsFilters,
): Promise<StatsOverview> {
  if (!isTauriRuntime()) {
    return {
      dbHandCount: 0,
      filteredHands: 0,
      totalProfit: 0,
      totalProfitBeforeRake: 0,
      totalRake: 0,
      avgProfit: 0,
      avgProfitBeforeRake: 0,
      avgRake: 0,
      positions: [],
      stakes: [],
      potTypes: [],
    };
  }
  return invoke<StatsOverview>("get_stats_overview", statsArgs(filters));
}

export async function fetchStatsPlaystyle(
  filters: StatsFilters,
): Promise<StatsPlaystyle> {
  if (!isTauriRuntime()) {
    return {
      vpipRate: 0,
      preflopRaiseRate: 0,
      threeBetRate: 0,
      fourBetRate: 0,
      flopRate: 0,
      flopWinRate: 0,
      showdownRate: 0,
      wonAtShowdownRate: 0,
      cbetFlopRate: 0,
      cbetTurnRate: 0,
      cbetRiverRate: 0,
      showdownHands: 0,
      showdownProfit: 0,
      nonShowdownHands: 0,
      nonShowdownProfit: 0,
    };
  }
  return invoke<StatsPlaystyle>("get_stats_playstyle", statsArgs(filters));
}

export async function fetchEquityCurve(
  filters: StatsFilters,
): Promise<EquityCurvePayload> {
  if (!isTauriRuntime()) {
    return { points: [], sampledFrom: 0 };
  }
  return invoke<EquityCurvePayload>("get_equity_curve", statsArgs(filters));
}

export async function fetchStatsBreakdown(
  filters: StatsFilters,
): Promise<StatsBreakdowns> {
  if (!isTauriRuntime()) {
    return { byPosition: [], byStakes: [] };
  }
  return invoke<StatsBreakdowns>("get_stats_breakdown", statsArgs(filters));
}
