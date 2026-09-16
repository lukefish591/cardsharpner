import type { CurvePoint } from "../../lib/stats";

interface Series {
  key: keyof Omit<CurvePoint, "handNumber">;
  label: string;
  color: string;
}

const SERIES: Series[] = [
  { key: "nonShowdown", label: "Non-showdown", color: "var(--cs-danger)" },
  { key: "showdown", label: "Showdown", color: "var(--cs-accent)" },
  { key: "total", label: "Cumulative", color: "var(--cs-ok)" },
];

interface LineChartProps {
  points: CurvePoint[];
}

export function LineChart({ points }: LineChartProps) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const ys = points.flatMap((p) => [p.total, p.showdown, p.nonShowdown]);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const spanY = maxY - minY || 1;
  const minX = points[0]?.handNumber ?? 1;
  const maxX = points[points.length - 1]?.handNumber ?? 1;
  const spanX = maxX - minX || 1;

  const xAt = (handNumber: number) => pad.left + ((handNumber - minX) / spanX) * innerW;
  const yAt = (value: number) =>
    pad.top + ((maxY - value) / spanY) * innerH;

  function pathFor(key: Series["key"]): string {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.handNumber).toFixed(2)} ${yAt(p[key]).toFixed(2)}`)
      .join(" ");
  }

  const zeroY = yAt(0);
  const yTicks = [maxY, 0, minY].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="chart-frame" data-region="line-chart">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Cumulative profit over hands"
      >
        <line
          className="chart-axis"
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={height - pad.bottom}
        />
        <line
          className="chart-axis"
          x1={pad.left}
          y1={height - pad.bottom}
          x2={width - pad.right}
          y2={height - pad.bottom}
        />
        <line
          className="chart-zero"
          x1={pad.left}
          y1={zeroY}
          x2={width - pad.right}
          y2={zeroY}
        />
        {yTicks.map((tick) => (
          <text
            key={tick}
            className="chart-label"
            x={pad.left - 8}
            y={yAt(tick) + 3}
            textAnchor="end"
          >
            {tick.toFixed(0)}
          </text>
        ))}
        <text className="chart-label" x={pad.left} y={height - 8}>
          {minX}
        </text>
        <text
          className="chart-label"
          x={width - pad.right}
          y={height - 8}
          textAnchor="end"
        >
          {maxX}
        </text>
        {SERIES.map((series) => (
          <path
            key={series.key}
            className="chart-line"
            d={pathFor(series.key)}
            style={{ stroke: series.color }}
          />
        ))}
      </svg>
      <ul className="chart-legend">
        {SERIES.map((series) => (
          <li key={series.key}>
            <span className="chart-legend__swatch" style={{ background: series.color }} />
            {series.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
