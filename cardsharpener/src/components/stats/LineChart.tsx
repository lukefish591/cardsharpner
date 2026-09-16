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

/** 1–2–5 × 10^n so ticks land on 10, 100, 1 000, … */
function niceStep(span: number, target = 5): number {
  const safe = Math.max(Math.abs(span), 1);
  const raw = safe / target;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const err = raw / base;
  const mult = err > 5 ? 10 : err > 2 ? 5 : err > 1 ? 2 : 1;
  return Math.max(1, mult * base);
}

function niceTicks(min: number, max: number, target = 5): number[] {
  const step = niceStep(max - min, target);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  }
  return String(Math.round(value));
}

export function LineChart({ points }: LineChartProps) {
  const width = 640;
  const height = 248;
  const pad = { top: 16, right: 20, bottom: 48, left: 68 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const ys = points.flatMap((p) => [p.total, p.showdown, p.nonShowdown]);
  const rawMinY = Math.min(0, ...ys);
  const rawMaxY = Math.max(0, ...ys);
  const yTicks = niceTicks(rawMinY, rawMaxY);
  const minY = yTicks[0] ?? rawMinY;
  const maxY = yTicks[yTicks.length - 1] ?? rawMaxY;
  const spanY = maxY - minY || 1;

  const minX = points[0]?.handNumber ?? 1;
  const maxX = points[points.length - 1]?.handNumber ?? 1;
  const xTicks = niceTicks(0, maxX).filter((t) => t >= minX && t <= maxX);
  if (!xTicks.includes(minX)) xTicks.unshift(minX);
  if (!xTicks.includes(maxX)) xTicks.push(maxX);
  const spanX = maxX - minX || 1;

  const xAt = (handNumber: number) =>
    pad.left + ((handNumber - minX) / spanX) * innerW;
  const yAt = (value: number) => pad.top + ((maxY - value) / spanY) * innerH;

  function pathFor(key: Series["key"]): string {
    return points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xAt(p.handNumber).toFixed(2)} ${yAt(p[key]).toFixed(2)}`,
      )
      .join(" ");
  }

  const zeroY = yAt(0);

  return (
    <div className="chart-frame" data-region="line-chart">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Results: cumulative profit in dollars over hands"
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
            key={`y-${tick}`}
            className="chart-label"
            x={pad.left - 8}
            y={yAt(tick) + 3}
            textAnchor="end"
          >
            {formatTick(tick)}
          </text>
        ))}
        {xTicks.map((tick) => (
          <text
            key={`x-${tick}`}
            className="chart-label"
            x={xAt(tick)}
            y={height - pad.bottom + 14}
            textAnchor="middle"
          >
            {formatTick(tick)}
          </text>
        ))}
        <text
          className="chart-axis-title"
          transform={`rotate(-90 14 ${pad.top + innerH / 2})`}
          x={14}
          y={pad.top + innerH / 2}
          textAnchor="middle"
        >
          Profit ($)
        </text>
        <text
          className="chart-axis-title"
          x={pad.left + innerW / 2}
          y={height - 8}
          textAnchor="middle"
        >
          Hand
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
            <span
              className="chart-legend__swatch"
              style={{ background: series.color }}
            />
            {series.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
