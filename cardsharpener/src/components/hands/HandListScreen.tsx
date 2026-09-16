import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { fetchHandsPage } from "../../lib/db";
import {
  getHandsCache,
  handsCacheKey,
  setHandsCache,
} from "../../lib/queryCache";
import type { HandFilters, HandPage, HandSummary } from "../../types/poker";
import { HandFiltersPanel } from "./HandFilters";
import { HandList } from "./HandList";

const EMPTY_FILTERS: HandFilters = {
  site: "",
  stakes: "",
  dateFrom: "",
  dateTo: "",
  query: "",
};

const PAGE_SIZE = 50;

interface HandListScreenProps {
  onOpenHand?: (hand: HandSummary) => void;
  dataRevision?: number;
}

export function HandListScreen({
  onOpenHand,
  dataRevision = 0,
}: HandListScreenProps) {
  const [filters, setFilters] = useState<HandFilters>(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<HandPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const debouncedQuery = useDebouncedValue(filters.query, 250);

  const request = useMemo(
    () => ({
      query: debouncedQuery,
      site: filters.site,
      stakes: filters.stakes,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: PAGE_SIZE,
      offset,
    }),
    [
      debouncedQuery,
      filters.site,
      filters.stakes,
      filters.dateFrom,
      filters.dateTo,
      offset,
    ],
  );
  const cacheKey = handsCacheKey(request);
  const searching = filters.query !== debouncedQuery || loading;

  useEffect(() => {
    setOffset(0);
  }, [
    debouncedQuery,
    filters.site,
    filters.stakes,
    filters.dateFrom,
    filters.dateTo,
  ]);

  useEffect(() => {
    const cached = getHandsCache(cacheKey);
    if (cached) {
      setPage(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const next = await fetchHandsPage(request);
        if (cancelled) return;
        setPage(next);
        setHandsCache(cacheKey, next);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load hands");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, request, dataRevision]);

  const matchCount = page?.matchCount ?? 0;
  const dbTotal = page?.dbTotal ?? 0;
  const limit = page?.limit ?? PAGE_SIZE;
  const pageNumber = Math.floor((page?.offset ?? offset) / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(matchCount / limit));
  const hasQuery = Boolean(debouncedQuery || filters.site || filters.stakes || filters.dateFrom || filters.dateTo);

  let statusText = "Newest hands";
  if (searching && dbTotal > 0) {
    statusText = `Searching ${dbTotal.toLocaleString()} hands…`;
  } else if (page) {
    statusText = `Page ${pageNumber} of ${pageCount} · ${matchCount.toLocaleString()} matches`;
  }

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
          <div className="hand-list__toolbar">
            <h2 className="panel__title">Hand list</h2>
            <p className="hand-list__status" aria-live="polite">
              {statusText}
            </p>
          </div>
          {error ? (
            <p style={{ color: "var(--cs-danger)" }}>{error}</p>
          ) : null}
          <HandList
            hands={page?.hands ?? []}
            onSelect={onOpenHand}
            loading={loading && !page}
            emptyLabel={
              hasQuery
                ? "No hands match this search."
                : undefined
            }
          />
          <div className="hand-list__pager">
            <button
              type="button"
              className="btn"
              disabled={pageNumber <= 1 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn"
              disabled={pageNumber >= pageCount || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
