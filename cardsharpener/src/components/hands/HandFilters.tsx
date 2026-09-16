import type { HandFilters } from "../../types/poker";

interface HandFiltersPanelProps {
  value: HandFilters;
  onChange: (next: HandFilters) => void;
}

export function HandFiltersPanel({ value, onChange }: HandFiltersPanelProps) {
  function patch(partial: Partial<HandFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <aside className="panel hand-filters" aria-label="Hand filters">
      <h2 className="panel__title">Filters</h2>
      <label>
        Search
        <input
          type="search"
          placeholder="Hand ID, cards…"
          value={value.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
      </label>
      <label>
        Site
        <select
          value={value.site}
          onChange={(e) => patch({ site: e.target.value })}
        >
          <option value="">Any</option>
          <option value="pokerstars">PokerStars</option>
          <option value="gg">GG</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Stakes
        <input
          type="text"
          placeholder="e.g. NL50"
          value={value.stakes}
          onChange={(e) => patch({ stakes: e.target.value })}
        />
      </label>
      <label>
        From
        <input
          type="date"
          value={value.dateFrom}
          onChange={(e) => patch({ dateFrom: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) => patch({ dateTo: e.target.value })}
        />
      </label>
    </aside>
  );
}
