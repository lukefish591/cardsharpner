import { useEffect, useState } from "react";
import { fetchHands } from "../../lib/db";
import type { HandFilters, HandSummary } from "../../types/poker";
import { HandFiltersPanel } from "./HandFilters";
import { HandList } from "./HandList";

const EMPTY_FILTERS: HandFilters = {
  site: "",
  stakes: "",
  dateFrom: "",
  dateTo: "",
  query: "",
};

interface HandListScreenProps {
  onOpenHand?: (hand: HandSummary) => void;
}

export function HandListScreen({ onOpenHand }: HandListScreenProps) {
  const [filters, setFilters] = useState<HandFilters>(EMPTY_FILTERS);
  const [hands, setHands] = useState<HandSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchHands();
        if (!cancelled) setHands(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load hands");
          setHands([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter stub — real filtering will query SQLite later.
  const visible = hands.filter((h) => {
    if (filters.site && (h.site ?? "") !== filters.site) return false;
    if (
      filters.stakes &&
      !(h.stakes ?? "").toLowerCase().includes(filters.stakes.toLowerCase())
    ) {
      return false;
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const hay = `${h.externalHandId ?? ""} ${h.heroCards ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <section className="screen" aria-labelledby="hands-title">
      <header className="screen__header">
        <h1 id="hands-title" className="screen__title">
          Hands
        </h1>
        <p className="screen__subtitle">
          Browse and filter imported hands from the local SQLite store.
        </p>
      </header>

      <div className="hands-layout">
        <HandFiltersPanel value={filters} onChange={setFilters} />
        <div className="panel" style={{ minHeight: 0 }}>
          <h2 className="panel__title">Hand list</h2>
          {error ? (
            <p style={{ color: "var(--cs-danger)" }}>{error}</p>
          ) : null}
          <HandList hands={visible} onSelect={onOpenHand} />
        </div>
      </div>
    </section>
  );
}
