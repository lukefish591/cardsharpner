import { formatStakesNl } from "../../lib/stats";
import type { HandFilters } from "../../types/poker";

interface HandFiltersPanelProps {
  value: HandFilters;
  positions: string[];
  stakes: string[];
  potTypes: string[];
  onChange: (next: HandFilters) => void;
}

export function HandFiltersPanel({
  value,
  positions,
  stakes,
  potTypes,
  onChange,
}: HandFiltersPanelProps) {
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
          placeholder="Cards…"
          value={value.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
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
