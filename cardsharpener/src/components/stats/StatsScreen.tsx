import { useEffect, useState } from "react";
import {
  fetchEquityCurve,
  fetchStatsBreakdown,
  fetchStatsOverview,
  fetchStatsPlaystyle,
} from "../../lib/db";
import {
  getStatsCache,
  patchStatsCache,
  statsCacheKey,
} from "../../lib/queryCache";
import { formatStakesNl, money, pct } from "../../lib/stats";
import type {
  EquityCurvePayload,
  StatsBreakdowns,
  StatsFilters as StatsFiltersValue,
  StatsOverview,
  StatsPlaystyle,
} from "../../types/poker";
import { BarChart } from "./BarChart";
import { BreakdownTable } from "./BreakdownTable";
import { ChartPanel } from "./ChartPanel";
import { ChartPlaceholder } from "./ChartPlaceholder";
import { LineChart } from "./LineChart";
import { StatsFilters } from "./StatsFilters";

const EMPTY_FILTERS: StatsFiltersValue = {
  position: "",
  stakes: "",
  potType: "",
};

const POT_TYPES = [
  "Preflop Only",
  "Limped Pot",
  "SRP",
  "3-Bet Pot",
  "4-Bet Pot",
  "5+ Bet Pot",
];

interface StatsScreenProps {
  dataRevision?: number;
}

export function StatsScreen({ dataRevision = 0 }: StatsScreenProps) {
  const [filters, setFilters] = useState<StatsFiltersValue>(EMPTY_FILTERS);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [playstyle, setPlaystyle] = useState<StatsPlaystyle | null>(null);
  const [curve, setCurve] = useState<EquityCurvePayload | null>(null);
  const [breakdowns, setBreakdowns] = useState<StatsBreakdowns | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = statsCacheKey(filters);
    const cached = getStatsCache(key);
    if (cached?.overview) {
      setOverview(cached.overview);
      setPlaystyle(cached.playstyle ?? null);
      setCurve(cached.curve ?? null);
      setBreakdowns(cached.breakdowns ?? null);
      setError(null);
      if (cached.overview && cached.playstyle && cached.curve && cached.breakdowns) {
        return;
      }
    } else {
      setOverview(null);
      setPlaystyle(null);
      setCurve(null);
      setBreakdowns(null);
    }

    let cancelled = false;
    (async () => {
      try {
        const nextOverview = cached?.overview ?? (await fetchStatsOverview(filters));
        if (cancelled) return;
        setOverview(nextOverview);
        patchStatsCache(key, { overview: nextOverview });
        setError(null);

        const nextPlay =
          cached?.playstyle ?? (await fetchStatsPlaystyle(filters));
        if (cancelled) return;
        setPlaystyle(nextPlay);
        patchStatsCache(key, { playstyle: nextPlay });

        const nextCurve = cached?.curve ?? (await fetchEquityCurve(filters));
        if (cancelled) return;
        setCurve(nextCurve);
        patchStatsCache(key, { curve: nextCurve });

        const nextBreak =
          cached?.breakdowns ?? (await fetchStatsBreakdown(filters));
        if (cancelled) return;
        setBreakdowns(nextBreak);
        patchStatsCache(key, { breakdowns: nextBreak });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load stats");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, dataRevision]);

  const emptyDb = overview != null && overview.dbHandCount === 0;
  const emptyFilter =
    overview != null && overview.dbHandCount > 0 && overview.filteredHands === 0;
  const overviewLoading = overview == null;
  const playstyleLoading = playstyle == null;
  const curveLoading = curve == null;
  const breakdownLoading = breakdowns == null;

  return (
    <section className="screen" aria-labelledby="stats-title">
      <header className="screen__header">
        <h1 id="stats-title" className="screen__title">
          Stats
        </h1>
      </header>

      {error ? <p style={{ color: "var(--cs-danger)" }}>{error}</p> : null}

      {emptyDb ? (
        <div className="empty-state" data-region="stats-empty">
          No hands in the local database yet. Import a history folder, then
          come back — charts stay empty until there is gathered data.
        </div>
      ) : (
        <>
          <StatsFilters
            value={filters}
            positions={(overview?.positions ?? []).filter((item) => item && item !== "Unknown")}
            stakes={(overview?.stakes ?? []).filter((item) => item && item !== "Unknown")}
            potTypes={[
              ...new Set([...(overview?.potTypes ?? []), ...POT_TYPES]),
            ].filter((item) => item && item !== "Unknown")}
            onChange={setFilters}
          />

          {emptyFilter ? (
            <div className="empty-state" data-region="stats-filter-empty">
              No hands match these filters.
            </div>
          ) : (
            <>
              <section className="stats-section" data-region="overview-metrics">
                <h2 className="stats-section__title">Overview</h2>
                <div className="stats-grid">
                  <Metric
                    label="Hands in DB"
                    value={overview ? String(overview.filteredHands) : ""}
                    loading={overviewLoading}
                  />
                  <Metric
                    label="Total profit (after rake)"
                    value={overview ? money(overview.totalProfit) : ""}
                    tone={
                      overview
                        ? overview.totalProfit >= 0
                          ? "pos"
                          : "neg"
                        : undefined
                    }
                    loading={overviewLoading}
                  />
                  <Metric
                    label="Total profit (before rake)"
                    value={overview ? money(overview.totalProfitBeforeRake) : ""}
                    loading={overviewLoading}
                  />
                  <Metric
                    label="Total rake paid"
                    value={overview ? money(overview.totalRake) : ""}
                    loading={overviewLoading}
                  />
                  <Metric
                    label="Avg profit / hand"
                    value={overview ? money(overview.avgProfit) : ""}
                    tone={
                      overview
                        ? overview.avgProfit >= 0
                          ? "pos"
                          : "neg"
                        : undefined
                    }
                    loading={overviewLoading}
                  />
                  <Metric
                    label="Avg profit / hand (before rake)"
                    value={overview ? money(overview.avgProfitBeforeRake) : ""}
                    loading={overviewLoading}
                  />
                  <Metric
                    label="Avg rake / hand"
                    value={overview ? money(overview.avgRake) : ""}
                    loading={overviewLoading}
                  />
                </div>
              </section>

              <section className="stats-section" data-region="playstyle-metrics">
                <h2 className="stats-section__title">Playstyle</h2>
                <div className="stats-grid">
                  <Metric label="VPIP" value={playstyle ? pct(playstyle.vpipRate) : ""} loading={playstyleLoading} />
                  <Metric label="PFR" value={playstyle ? pct(playstyle.preflopRaiseRate) : ""} loading={playstyleLoading} />
                  <Metric label="3-bet" value={playstyle ? pct(playstyle.threeBetRate) : ""} loading={playstyleLoading} />
                  <Metric label="4-bet" value={playstyle ? pct(playstyle.fourBetRate) : ""} loading={playstyleLoading} />
                  <Metric label="Saw flop" value={playstyle ? pct(playstyle.flopRate) : ""} loading={playstyleLoading} />
                  <Metric label="Flop win rate" value={playstyle ? pct(playstyle.flopWinRate) : ""} loading={playstyleLoading} />
                  <Metric
                    label="Showdown rate (of flop)"
                    value={playstyle ? pct(playstyle.showdownRate) : ""}
                    loading={playstyleLoading}
                  />
                  <Metric label="W$SD" value={playstyle ? pct(playstyle.wonAtShowdownRate) : ""} loading={playstyleLoading} />
                  <Metric label="C-bet flop" value={playstyle ? pct(playstyle.cbetFlopRate) : ""} loading={playstyleLoading} />
                  <Metric label="C-bet turn" value={playstyle ? pct(playstyle.cbetTurnRate) : ""} loading={playstyleLoading} />
                  <Metric label="C-bet river" value={playstyle ? pct(playstyle.cbetRiverRate) : ""} loading={playstyleLoading} />
                </div>
              </section>

              <ChartPanel
                title="Showdown vs non-showdown winnings"
                note="Hand number on the x-axis. Built from imported hero net only."
              >
                {curveLoading ? (
                  <ChartPlaceholder title="" note="" spinning />
                ) : curve && curve.points.length > 0 ? (
                  <LineChart points={curve.points} />
                ) : (
                  <ChartPlaceholder title="" note="No points to plot" />
                )}
                <div className="stats-grid stats-grid--compact">
                  <Metric
                    label="Showdown hands"
                    value={playstyle ? String(playstyle.showdownHands) : ""}
                    loading={playstyleLoading}
                  />
                  <Metric
                    label="Showdown profit"
                    value={playstyle ? money(playstyle.showdownProfit) : ""}
                    tone={
                      playstyle
                        ? playstyle.showdownProfit >= 0
                          ? "pos"
                          : "neg"
                        : undefined
                    }
                    loading={playstyleLoading}
                  />
                  <Metric
                    label="Non-showdown hands"
                    value={playstyle ? String(playstyle.nonShowdownHands) : ""}
                    loading={playstyleLoading}
                  />
                  <Metric
                    label="Non-showdown profit"
                    value={playstyle ? money(playstyle.nonShowdownProfit) : ""}
                    tone={
                      playstyle
                        ? playstyle.nonShowdownProfit >= 0
                          ? "pos"
                          : "neg"
                        : undefined
                    }
                    loading={playstyleLoading}
                  />
                </div>
              </ChartPanel>

              <ChartPanel title="Results by position">
                {breakdownLoading ? (
                  <ChartPlaceholder title="" note="" spinning />
                ) : breakdowns && breakdowns.byPosition.length > 0 ? (
                  <BarChart
                    data={breakdowns.byPosition.map((row) => ({
                      label: shortPosition(row.key),
                      value: row.totalProfit,
                    }))}
                    formatValue={(v) => money(v)}
                  />
                ) : (
                  <ChartPlaceholder title="" note="No position rows" />
                )}
                {breakdownLoading ? null : (
                  <BreakdownTable
                    rows={breakdowns?.byPosition ?? []}
                    keyLabel="Position"
                  />
                )}
              </ChartPanel>

              <div className="stats-split">
                <ChartPanel title="Profit by stakes ($)">
                  {breakdownLoading ? (
                    <ChartPlaceholder title="" note="" spinning />
                  ) : breakdowns && breakdowns.byStakes.length > 0 ? (
                    <BarChart
                    data={breakdowns.byStakes.map((row) => ({
                      label: formatStakesNl(row.key),
                      value: row.totalProfit,
                    }))}
                      formatValue={(v) => money(v)}
                    />
                  ) : (
                    <ChartPlaceholder title="" note="No stakes rows" />
                  )}
                </ChartPanel>
                <ChartPanel title="Profit by stakes (BB)">
                  {breakdownLoading ? (
                    <ChartPlaceholder title="" note="" spinning />
                  ) : breakdowns && breakdowns.byStakes.length > 0 ? (
                    <BarChart
                    data={breakdowns.byStakes.map((row) => ({
                      label: formatStakesNl(row.key),
                      value: row.profitBb ?? 0,
                    }))}
                      formatValue={(v) => `${v.toFixed(1)} BB`}
                    />
                  ) : (
                    <ChartPlaceholder title="" note="No stakes rows" />
                  )}
                </ChartPanel>
              </div>

              <ChartPanel title="Stakes summary">
                {breakdownLoading ? (
                  <ChartPlaceholder title="" note="" spinning />
                ) : (
                  <BreakdownTable
                    rows={breakdowns?.byStakes ?? []}
                    keyLabel="Stakes"
                    showBb
                  />
                )}
              </ChartPanel>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  loading?: boolean;
}) {
  return (
    <div className="panel stat-metric" data-region="stat-metric">
      <span className="stat-metric__label">{label}</span>
      {loading ? (
        <span className="spinner" aria-label="Loading" />
      ) : (
        <span
          className={`stat-metric__value${tone ? ` stat-metric__value--${tone}` : ""}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function shortPosition(position: string): string {
  switch (position) {
    case "Small Blind":
      return "SB";
    case "Big Blind":
      return "BB";
    case "Button":
      return "BTN";
    case "Cutoff":
      return "CO";
    case "Hijack":
      return "HJ";
    default:
      return position;
  }
}
