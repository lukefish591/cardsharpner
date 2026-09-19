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
  boardCards?: string | null;
}

export interface HandFilters {
  site: string;
  stakes: string;
  dateFrom: string;
  dateTo: string;
  query: string;
  position: string;
  potType: string;
}

export interface DbStatus {
  path: string;
  handCount: number;
  actionCount: number;
  ready: boolean;
  statsReady: boolean;
  statsPending: number;
  journalMode: string;
}

export interface HandPage {
  hands: HandSummary[];
  matchCount: number;
  dbTotal: number;
  limit: number;
  offset: number;
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

export type ChipBucket =
  | "bb-0.5"
  | "bb-1"
  | "bb-1-5"
  | "bb-5-10"
  | "bb-10-20"
  | "bb-20-30"
  | "bb-30-50"
  | "bb-50";

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

export interface StatsOverview {
  dbHandCount: number;
  filteredHands: number;
  totalProfit: number;
  totalProfitBeforeRake: number;
  totalRake: number;
  avgProfit: number;
  avgProfitBeforeRake: number;
  avgRake: number;
  positions: string[];
  stakes: string[];
  potTypes: string[];
}

export interface StatsPlaystyle {
  vpipRate: number | null;
  preflopRaiseRate: number | null;
  threeBetRate: number | null;
  fourBetRate: number | null;
  flopRate: number | null;
  flopWinRate: number | null;
  showdownRate: number | null;
  wonAtShowdownRate: number | null;
  cbetFlopRate: number | null;
  cbetTurnRate: number | null;
  cbetRiverRate: number | null;
  showdownHands: number;
  showdownProfit: number;
  nonShowdownHands: number;
  nonShowdownProfit: number;
}

export interface EquityCurvePayload {
  points: Array<{
    handNumber: number;
    total: number;
    showdown: number;
    nonShowdown: number;
  }>;
  sampledFrom: number;
}

export interface BreakdownRow {
  key: string;
  hands: number;
  totalProfit: number;
  avgProfit: number;
  profitBb: number | null;
  showdownRate: number | null;
  flopWinRate: number | null;
  preflopRaiseRate: number | null;
  cbetRate: number | null;
}

export interface StatsBreakdowns {
  byPosition: BreakdownRow[];
  byStakes: BreakdownRow[];
}

export interface StatsFilters {
  position: string;
  stakes: string;
  potType: string;
  dateFrom: string;
  dateTo: string;
  excludeRake: boolean;
}
