import { formatStakesNl } from "../../lib/stats";
import type { StatsFilters as StatsFiltersValue } from "../../types/poker";

interface StatsFiltersProps {
  value: StatsFiltersValue;
  positions: string[];
  stakes: string[];
  potTypes: string[];
  onChange: (next: StatsFiltersValue) => void;
}

export function StatsFilters({
  value,
  positions,
  stakes,
  potTypes,
  onChange,
}: StatsFiltersProps) {
  function patch(partial: Partial<StatsFiltersValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="panel stats-filters" data-region="stats-filters">
      <h2 className="panel__title">Results filters</h2>
      <div className="stats-filters__row">
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
      </div>
    </div>
  );
}
