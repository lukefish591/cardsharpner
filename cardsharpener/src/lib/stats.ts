import type { BreakdownRow, HandStatRow, StatsFilters } from "../types/poker";

export interface OverviewMetrics {
  totalHands: number;
  totalProfit: number;
  totalProfitBeforeRake: number;
  totalRake: number;
  avgProfit: number;
  avgProfitBeforeRake: number;
  avgRake: number;
  vpipRate: number;
  preflopRaiseRate: number;
  threeBetRate: number;
  fourBetRate: number;
  flopRate: number;
  flopWinRate: number;
  showdownRate: number;
  wonAtShowdownRate: number;
  cbetFlopRate: number;
  cbetTurnRate: number;
  cbetRiverRate: number;
  showdownHands: number;
  showdownProfit: number;
  nonShowdownHands: number;
  nonShowdownProfit: number;
}

export interface CurvePoint {
  handNumber: number;
  total: number;
  showdown: number;
  nonShowdown: number;
}

export type { BreakdownRow };

const EMPTY_METRICS: OverviewMetrics = {
  totalHands: 0,
  totalProfit: 0,
  totalProfitBeforeRake: 0,
  totalRake: 0,
  avgProfit: 0,
  avgProfitBeforeRake: 0,
  avgRake: 0,
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

export function filterStatRows(
  rows: HandStatRow[],
  filters: StatsFilters,
): HandStatRow[] {
  return rows.filter((row) => {
    if (filters.position && row.position !== filters.position) return false;
    if (filters.stakes && row.stakes !== filters.stakes) return false;
    if (filters.potType && row.potType !== filters.potType) return false;
    const played = row.playedAt ?? "";
    if (filters.dateFrom && played < filters.dateFrom) return false;
    if (filters.dateTo && played && played > `${filters.dateTo}z`) return false;
    return true;
  });
}

function rate(numer: number, denom: number): number {
  return denom > 0 ? (numer / denom) * 100 : 0;
}

function count(rows: HandStatRow[], pred: (row: HandStatRow) => boolean): number {
  return rows.reduce((sum, row) => sum + (pred(row) ? 1 : 0), 0);
}

export function aggregateMetrics(rows: HandStatRow[]): OverviewMetrics {
  if (rows.length === 0) return EMPTY_METRICS;

  const totalHands = rows.length;
  const totalProfit = rows.reduce((s, r) => s + r.heroNet, 0);
  const totalProfitBeforeRake = rows.reduce((s, r) => s + r.netBeforeRake, 0);
  const totalRake = rows.reduce((s, r) => s + r.rake, 0);
  const sawFlop = count(rows, (r) => r.sawFlop);
  const wentSd = count(rows, (r) => r.wentToShowdown);
  const showdownProfit = rows
    .filter((r) => r.wentToShowdown)
    .reduce((s, r) => s + r.heroNet, 0);
  const nonShowdownProfit = rows
    .filter((r) => !r.wentToShowdown)
    .reduce((s, r) => s + r.heroNet, 0);

  return {
    totalHands,
    totalProfit,
    totalProfitBeforeRake,
    totalRake,
    avgProfit: totalProfit / totalHands,
    avgProfitBeforeRake: totalProfitBeforeRake / totalHands,
    avgRake: totalRake / totalHands,
    vpipRate: rate(count(rows, (r) => r.vpip), totalHands),
    preflopRaiseRate: rate(count(rows, (r) => r.preflopRaised), totalHands),
    threeBetRate: rate(
      count(rows, (r) => r.threeBet),
      count(rows, (r) => r.threeBetOpportunity),
    ),
    fourBetRate: rate(
      count(rows, (r) => r.fourBet),
      count(rows, (r) => r.fourBetOpportunity),
    ),
    flopRate: rate(sawFlop, totalHands),
    flopWinRate: rate(count(rows, (r) => r.wonWhenSawFlop), sawFlop),
    showdownRate: rate(wentSd, sawFlop),
    wonAtShowdownRate: rate(count(rows, (r) => r.wonAtShowdown), wentSd),
    cbetFlopRate: rate(
      count(rows, (r) => r.cbetFlop),
      count(rows, (r) => r.cbetFlopOpportunity),
    ),
    cbetTurnRate: rate(
      count(rows, (r) => r.cbetTurn),
      count(rows, (r) => r.cbetTurnOpportunity),
    ),
    cbetRiverRate: rate(
      count(rows, (r) => r.cbetRiver),
      count(rows, (r) => r.cbetRiverOpportunity),
    ),
    showdownHands: wentSd,
    showdownProfit,
    nonShowdownHands: totalHands - wentSd,
    nonShowdownProfit,
  };
}

export function buildEquityCurve(rows: HandStatRow[]): CurvePoint[] {
  let total = 0;
  let showdown = 0;
  let nonShowdown = 0;
  return rows.map((row, index) => {
    total += row.heroNet;
    if (row.wentToShowdown) showdown += row.heroNet;
    else nonShowdown += row.heroNet;
    return {
      handNumber: index + 1,
      total,
      showdown,
      nonShowdown,
    };
  });
}

export function extractBb(stakes: string): number | null {
  const parts = stakes.replace(/\$/g, "").split("/");
  if (parts.length < 2) return null;
  const bb = Number.parseFloat(parts[1].trim());
  return Number.isFinite(bb) && bb > 0 ? bb : null;
}

/** Display stakes as 5NL / 25NL. NL number = big blind in cents. */
export function formatStakesNl(stakes: string | null | undefined): string {
  if (!stakes) return "—";
  const trimmed = stakes.trim();
  if (/^\d+NL$/i.test(trimmed)) return trimmed.toUpperCase();
  const bb = extractBb(trimmed);
  if (bb == null) return trimmed;
  return `${Math.round(bb * 100)}NL`;
}

export function formatNetBb(
  net: number | null | undefined,
  stakes: string | null | undefined,
): string {
  if (net == null) return "—";
  const bb = stakes ? extractBb(stakes) : null;
  if (bb == null) {
    const sign = net > 0 ? "+" : "";
    return `${sign}${net.toFixed(1)}`;
  }
  const value = net / bb;
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${text} BB`;
}

export function formatPlayedAt(raw: string | null | undefined): string {
  if (!raw) return "—";
  const isoish = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(isoish);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function breakdownBy(
  rows: HandStatRow[],
  keyOf: (row: HandStatRow) => string,
  order?: string[],
): BreakdownRow[] {
  const groups = new Map<string, HandStatRow[]>();
  for (const row of rows) {
    const key = keyOf(row) || "Unknown";
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const keys = order
    ? [...order.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => !order.includes(k))]
    : [...groups.keys()].sort();

  return keys.map((key) => {
    const group = groups.get(key) ?? [];
    const metrics = aggregateMetrics(group);
    const bb = extractBb(key);
    return {
      key,
      hands: metrics.totalHands,
      totalProfit: metrics.totalProfit,
      avgProfit: metrics.avgProfit,
      profitBb: bb == null ? null : metrics.totalProfit / bb,
      showdownRate: metrics.showdownRate,
      flopWinRate: metrics.flopWinRate,
      preflopRaiseRate: metrics.preflopRaiseRate,
      cbetRate: metrics.cbetFlopRate,
    };
  });
}

export function money(value: number, digits = 2): string {
  const abs = Math.abs(value).toFixed(digits);
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

export function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export const POSITION_ORDER = [
  "UTG",
  "UTG+1",
  "UTG+2",
  "Hijack",
  "Cutoff",
  "Button",
  "Small Blind",
  "Big Blind",
];
