import { useEffect, useState } from "react";
import { fetchDbStatus } from "../../lib/db";
import { ChartPlaceholder } from "./ChartPlaceholder";

export function StatsScreen() {
  const [handCount, setHandCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDbStatus()
      .then((s) => {
        if (!cancelled) setHandCount(s.handCount);
      })
      .catch(() => {
        if (!cancelled) setHandCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

      <div className="stats-grid">
        <div className="panel stat-metric">
          <span className="stat-metric__label">Hands in DB</span>
          <span className="stat-metric__value">
            {handCount == null ? "—" : handCount}
          </span>
        </div>
        <div className="panel stat-metric">
          <span className="stat-metric__label">Hero net (stub)</span>
          <span className="stat-metric__value muted">n/a</span>
        </div>
        <ChartPlaceholder title="Win rate over time" />
        <ChartPlaceholder title="Results by position" />
        <ChartPlaceholder title="Results by stakes" />
      </div>
    </section>
  );
}
