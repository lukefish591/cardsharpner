import { HAND_SORTS } from "../../lib/handSort";
import { formatStakesNl } from "../../lib/stats";
import type { HandFilters } from "../../types/poker";

interface HandFiltersPanelProps {
  value: HandFilters;
  sort: string;
  positions: string[];
  stakes: string[];
  potTypes: string[];
  onChange: (next: HandFilters) => void;
  onSortChange: (sort: string) => void;
}

export function HandFiltersPanel({
  value,
  sort,
  positions,
  stakes,
  potTypes,
  onChange,
  onSortChange,
}: HandFiltersPanelProps) {
  function patch(partial: Partial<HandFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <aside className="panel hand-filters" aria-label="Hand filters">
      <h2 className="panel__title">Filters</h2>
      <label>
        Sort
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          {HAND_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Hole cards
        <input
          type="search"
          placeholder="AKs, AKo, or Ah Kd"
          value={value.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
        <span className="hand-filters__hint">
          Exact suits (Ah Kd) or generic suited/offsuit (AKs / AKo). AK matches both.
        </span>
      </label>
      <label>
        Position
        <select
          value={value.position}
          onChange={(e) => patch({ position: e.target.value })}
        >
          <option value="">All positions</option>
          {positions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Stakes
        <select
          value={value.stakes}
          onChange={(e) => patch({ stakes: e.target.value })}
        >
          <option value="">All stakes</option>
          {stakes.map((item) => (
            <option key={item} value={item}>
              {formatStakesNl(item)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Pot type
        <select
          value={value.potType}
          onChange={(e) => patch({ potType: e.target.value })}
        >
          <option value="">All pot types</option>
          {potTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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
