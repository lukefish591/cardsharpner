interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  formatValue?: (value: number) => string;
}

export function BarChart({ data, formatValue }: BarChartProps) {
  const width = 420;
  const height = 220;
  const pad = { top: 20, right: 12, bottom: 36, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = data.map((d) => d.value);
  const minY = Math.min(0, ...values);
  const maxY = Math.max(0, ...values);
  const spanY = maxY - minY || 1;
  const barW = data.length > 0 ? (innerW / data.length) * 0.62 : 0;
  const slot = data.length > 0 ? innerW / data.length : 0;

  const yAt = (value: number) => pad.top + ((maxY - value) / spanY) * innerH;
  const zeroY = yAt(0);
  const format = formatValue ?? ((v: number) => v.toFixed(1));

  return (
    <div className="chart-frame" data-region="bar-chart">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Bar chart"
      >
        <line
          className="chart-axis"
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={height - pad.bottom}
        />
        <line
          className="chart-zero"
          x1={pad.left}
          y1={zeroY}
          x2={width - pad.right}
          y2={zeroY}
        />
        <text className="chart-label" x={pad.left - 8} y={yAt(maxY) + 3} textAnchor="end">
          {maxY.toFixed(0)}
        </text>
        <text className="chart-label" x={pad.left - 8} y={yAt(minY) + 3} textAnchor="end">
          {minY.toFixed(0)}
        </text>
        {data.map((datum, index) => {
          const x = pad.left + index * slot + (slot - barW) / 2;
          const y = Math.min(yAt(datum.value), zeroY);
          const h = Math.max(Math.abs(yAt(datum.value) - zeroY), 1);
          const positive = datum.value >= 0;
          return (
            <g key={datum.label}>
              <rect
                className={positive ? "chart-bar chart-bar--pos" : "chart-bar chart-bar--neg"}
                x={x}
                y={y}
                width={barW}
                height={h}
              />
              <text
                className="chart-label"
                x={x + barW / 2}
                y={height - 14}
                textAnchor="middle"
              >
                {datum.label}
              </text>
              <text
                className="chart-label"
                x={x + barW / 2}
                y={positive ? y - 4 : y + h + 12}
                textAnchor="middle"
              >
                {format(datum.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
