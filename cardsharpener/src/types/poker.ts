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
  | "deal"
  | "collect"
  | "return"
  | "show";

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

export interface ImportResult {
  fileCount: number;
  handCount: number;
  skippedCount: number;
  errorCount: number;
  batchId: number;
  notes: string;
}

export interface ReplayPlayer {
  seat: number | null;
  name: string | null;
  position: string | null;
  startingStack: number | null;
  isHero: boolean;
  holeCards: string | null;
}

export interface ReplayAction {
  id: number;
  seq: number;
  street: string;
  actorSeat: number | null;
  actorName: string | null;
  actionType: string;
  amount: number | null;
  isAllIn: boolean;
  potAfter: number | null;
}

export interface HandReplay {
  id: number;
  externalHandId?: string | null;
  site?: string | null;
  playedAt?: string | null;
  stakes?: string | null;
  tableName?: string | null;
  heroSeat?: number | null;
  heroName?: string | null;
  heroCards?: string | null;
  boardCards?: string | null;
  potTotal?: number | null;
  heroNet?: number | null;
  rawText?: string | null;
  players: ReplayPlayer[];
  actions: ReplayAction[];
}

export type ChipSize = "small" | "medium" | "big";

export type AppScreen = "import" | "hands" | "replayer" | "stats";

export interface HandStatRow {
  id: number;
  playedAt?: string | null;
  stakes: string;
  position: string;
  potType: string;
  heroNet: number;
  rake: number;
  netBeforeRake: number;
  vpip: boolean;
  preflopRaised: boolean;
  preflopCalled: boolean;
  threeBet: boolean;
  threeBetOpportunity: boolean;
  fourBet: boolean;
  fourBetOpportunity: boolean;
  sawFlop: boolean;
  wonWhenSawFlop: boolean;
  wentToShowdown: boolean;
  wonAtShowdown: boolean;
  cbetFlop: boolean;
  cbetTurn: boolean;
  cbetRiver: boolean;
  cbetFlopOpportunity: boolean;
  cbetTurnOpportunity: boolean;
  cbetRiverOpportunity: boolean;
}

export interface HeroStatsPayload {
  handCount: number;
  positions: string[];
  stakes: string[];
  potTypes: string[];
  rows: HandStatRow[];
}

export interface StatsFilters {
  position: string;
  stakes: string;
  potType: string;
}
