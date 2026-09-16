import { useEffect, useMemo, useState } from "react";
import { fetchHeroStats } from "../../lib/db";
import {
  POSITION_ORDER,
  aggregateMetrics,
  breakdownBy,
  buildEquityCurve,
  filterStatRows,
  money,
  pct,
} from "../../lib/stats";
import type { HeroStatsPayload, StatsFilters as StatsFiltersValue } from "../../types/poker";
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

export function StatsScreen() {
  const [payload, setPayload] = useState<HeroStatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StatsFiltersValue>(EMPTY_FILTERS);

  useEffect(() => {
    let cancelled = false;
    fetchHeroStats()
      .then((data) => {
        if (!cancelled) {
          setPayload(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load stats");
          setPayload({
            handCount: 0,
            positions: [],
            stakes: [],
            potTypes: [],
            rows: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => (payload ? filterStatRows(payload.rows, filters) : []),
    [payload, filters],
  );

  const metrics = useMemo(() => aggregateMetrics(filtered), [filtered]);
  const curve = useMemo(() => buildEquityCurve(filtered), [filtered]);
  const byPosition = useMemo(
    () => breakdownBy(filtered, (row) => row.position, POSITION_ORDER),
    [filtered],
  );
  const byStakes = useMemo(
    () => breakdownBy(filtered, (row) => row.stakes),
    [filtered],
  );

  const loading = payload == null;
  const emptyDb = payload != null && payload.handCount === 0;
  const emptyFilter = payload != null && payload.handCount > 0 && filtered.length === 0;

  return (
    <section className="screen" aria-labelledby="stats-title">
      <header className="screen__header">
        <h1 id="stats-title" className="screen__title">
          Stats
        </h1>
        <p className="screen__subtitle">
          Reports and graphs from imported hand data only. No GTO / theory
          comparison views.
        </p>
      </header>

      {error ? <p style={{ color: "var(--cs-danger)" }}>{error}</p> : null}

      {loading ? (
        <p className="muted">Loading gathered-hand stats…</p>
      ) : null}

      {emptyDb ? (
        <div className="empty-state" data-region="stats-empty">
          No hands in the local database yet. Import a history folder, then
          come back — charts stay empty until there is gathered data.
        </div>
      ) : null}

      {!loading && !emptyDb ? (
        <>
          <StatsFilters
            value={filters}
            positions={payload?.positions ?? []}
            stakes={payload?.stakes ?? []}
            potTypes={payload?.potTypes ?? []}
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
                  <Metric label="Hands in DB" value={String(metrics.totalHands)} />
                  <Metric
                    label="Total profit (after rake)"
                    value={money(metrics.totalProfit)}
                    tone={metrics.totalProfit >= 0 ? "pos" : "neg"}
                  />
                  <Metric
                    label="Total profit (before rake)"
                    value={money(metrics.totalProfitBeforeRake)}
                  />
                  <Metric label="Total rake paid" value={money(metrics.totalRake)} />
                  <Metric
                    label="Avg profit / hand"
                    value={money(metrics.avgProfit)}
                    tone={metrics.avgProfit >= 0 ? "pos" : "neg"}
                  />
                  <Metric
                    label="Avg profit / hand (before rake)"
                    value={money(metrics.avgProfitBeforeRake)}
                  />
                  <Metric label="Avg rake / hand" value={money(metrics.avgRake)} />
                </div>
              </section>

              <section className="stats-section" data-region="playstyle-metrics">
                <h2 className="stats-section__title">Playstyle</h2>
                <div className="stats-grid">
                  <Metric label="VPIP" value={pct(metrics.vpipRate)} />
                  <Metric label="PFR" value={pct(metrics.preflopRaiseRate)} />
                  <Metric label="3-bet" value={pct(metrics.threeBetRate)} />
                  <Metric label="4-bet" value={pct(metrics.fourBetRate)} />
                  <Metric label="Saw flop" value={pct(metrics.flopRate)} />
                  <Metric label="Flop win rate" value={pct(metrics.flopWinRate)} />
                  <Metric
                    label="Showdown rate (of flop)"
                    value={pct(metrics.showdownRate)}
                  />
                  <Metric label="W$SD" value={pct(metrics.wonAtShowdownRate)} />
                  <Metric label="C-bet flop" value={pct(metrics.cbetFlopRate)} />
                  <Metric label="C-bet turn" value={pct(metrics.cbetTurnRate)} />
                  <Metric label="C-bet river" value={pct(metrics.cbetRiverRate)} />
                </div>
              </section>

              <ChartPanel
                title="Showdown vs non-showdown winnings"
                note="Hand number on the x-axis. Built from imported hero net only."
              >
                {curve.length > 0 ? (
                  <LineChart points={curve} />
                ) : (
                  <ChartPlaceholder title="" note="No points to plot" />
                )}
                <div className="stats-grid stats-grid--compact">
                  <Metric label="Showdown hands" value={String(metrics.showdownHands)} />
                  <Metric
                    label="Showdown profit"
                    value={money(metrics.showdownProfit)}
                    tone={metrics.showdownProfit >= 0 ? "pos" : "neg"}
                  />
                  <Metric
                    label="Non-showdown hands"
                    value={String(metrics.nonShowdownHands)}
                  />
                  <Metric
                    label="Non-showdown profit"
                    value={money(metrics.nonShowdownProfit)}
                    tone={metrics.nonShowdownProfit >= 0 ? "pos" : "neg"}
                  />
                </div>
              </ChartPanel>

              <ChartPanel title="Results by position">
                {byPosition.length > 0 ? (
                  <BarChart
                    data={byPosition.map((row) => ({
                      label: shortPosition(row.key),
                      value: row.totalProfit,
                    }))}
                    formatValue={(v) => money(v)}
                  />
                ) : (
                  <ChartPlaceholder title="" note="No position rows" />
                )}
                <BreakdownTable rows={byPosition} keyLabel="Position" />
              </ChartPanel>

              <div className="stats-split">
                <ChartPanel title="Profit by stakes ($)">
                  {byStakes.length > 0 ? (
                    <BarChart
                      data={byStakes.map((row) => ({
                        label: row.key,
                        value: row.totalProfit,
                      }))}
                      formatValue={(v) => money(v)}
                    />
                  ) : (
                    <ChartPlaceholder title="" note="No stakes rows" />
                  )}
                </ChartPanel>
                <ChartPanel title="Profit by stakes (BB)">
                  {byStakes.length > 0 ? (
                    <BarChart
                      data={byStakes.map((row) => ({
                        label: row.key,
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
                <BreakdownTable rows={byStakes} keyLabel="Stakes" showBb />
              </ChartPanel>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="panel stat-metric" data-region="stat-metric">
      <span className="stat-metric__label">{label}</span>
      <span
        className={`stat-metric__value${tone ? ` stat-metric__value--${tone}` : ""}`}
      >
        {value}
      </span>
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
