import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { fetchHandsPage } from "../../lib/db";
import type { HandSummary } from "../../types/poker";

interface HandPickerProps {
  selectedId: number | null;
  selectedLabel: string;
  onSelect: (handId: number) => void;
}

export function HandPicker({
  selectedId,
  selectedLabel,
  onSelect,
}: HandPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<HandSummary[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHandsPage({ query: debouncedQuery, limit: 50, offset: 0 })
      .then((page) => {
        if (cancelled) return;
        setResults(page.hands);
        setMatchCount(page.matchCount);
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setMatchCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="hand-picker" data-region="hand-picker" ref={wrapRef}>
      <label>
        <span className="muted">Hand</span>
        <input
          type="search"
          className="hand-picker__input"
          placeholder={selectedLabel || "Search hand ID or cards…"}
          value={open ? query : selectedId != null ? selectedLabel : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          aria-expanded={open}
          aria-controls="hand-picker-results"
          autoComplete="off"
        />
      </label>
      {open ? (
        <ul id="hand-picker-results" className="hand-picker__results" role="listbox">
          {loading ? (
            <li className="hand-picker__empty muted">Searching…</li>
          ) : results.length === 0 ? (
            <li className="hand-picker__empty muted">
              {debouncedQuery
                ? "No matching hands"
                : "No imported hands yet."}
            </li>
          ) : (
            results.map((hand) => {
              const label = `${hand.externalHandId ?? `Hand #${hand.id}`}${
                hand.heroCards ? ` · ${hand.heroCards}` : ""
              }`;
              return (
                <li key={hand.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={hand.id === selectedId}
                    className={`hand-picker__option${
                      hand.id === selectedId ? " is-selected" : ""
                    }`}
                    onClick={() => {
                      onSelect(hand.id);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    {label}
                    {hand.heroNet != null ? (
                      <span className="muted"> · {hand.heroNet.toFixed(2)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
          {!loading && matchCount > results.length ? (
            <li className="hand-picker__empty muted">
              Showing 50 of {matchCount.toLocaleString()} — type to narrow
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
