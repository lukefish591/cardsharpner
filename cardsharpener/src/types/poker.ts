/** Shared domain types for import / list / replay / stats (stubs). */

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type ActionType =
  | "post"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all-in"
  | "deal";

export interface HandSummary {
  id: number;
  externalHandId?: string | null;
  site?: string | null;
  playedAt?: string | null;
  stakes?: string | null;
  heroCards?: string | null;
  heroNet?: number | null;
}

export interface HandFilters {
  site: string;
  stakes: string;
  dateFrom: string;
  dateTo: string;
  query: string;
}

export interface DbStatus {
  path: string;
  handCount: number;
  actionCount: number;
  ready: boolean;
}

export type AppScreen = "import" | "hands" | "replayer" | "stats";
