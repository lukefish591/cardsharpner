import type {
  EquityCurvePayload,
  HandPage,
  StatsBreakdowns,
  StatsOverview,
  StatsPlaystyle,
} from "../types/poker";

export interface HandsCacheEntry {
  key: string;
  page: HandPage;
}

export interface StatsCacheEntry {
  key: string;
  overview?: StatsOverview;
  playstyle?: StatsPlaystyle;
  curve?: EquityCurvePayload;
  breakdowns?: StatsBreakdowns;
}

let handsCache: HandsCacheEntry | null = null;
let statsCache: StatsCacheEntry | null = null;

export function handsCacheKey(input: {
  query: string;
  site: string;
  stakes: string;
  dateFrom: string;
  dateTo: string;
  position: string;
  potType: string;
  limit: number;
  offset: number;
}): string {
  return [
    input.query,
    input.site,
    input.stakes,
    input.dateFrom,
    input.dateTo,
    input.position,
    input.potType,
    input.limit,
    input.offset,
  ].join("|");
}

export function statsCacheKey(input: {
  position: string;
  stakes: string;
  potType: string;
  dateFrom: string;
  dateTo: string;
  excludeRake: boolean;
}): string {
  return [
    input.position,
    input.stakes,
    input.potType,
    input.dateFrom,
    input.dateTo,
    input.excludeRake ? "norake" : "rake",
  ].join("|");
}

export function getHandsCache(key: string): HandPage | null {
  return handsCache?.key === key ? handsCache.page : null;
}

export function setHandsCache(key: string, page: HandPage): void {
  handsCache = { key, page };
}

export function getStatsCache(key: string): StatsCacheEntry | null {
  return statsCache?.key === key ? statsCache : null;
}

export function setStatsCache(entry: StatsCacheEntry): void {
  statsCache = entry;
}

export function patchStatsCache(
  key: string,
  patch: Partial<Omit<StatsCacheEntry, "key">>,
): void {
  if (statsCache?.key === key) {
    statsCache = { ...statsCache, ...patch };
  } else {
    statsCache = { key, ...patch };
  }
}

export function clearQueryCache(): void {
  handsCache = null;
  statsCache = null;
}
