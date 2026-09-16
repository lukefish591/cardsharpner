interface ChartPlaceholderProps {
  title: string;
  note?: string;
  spinning?: boolean;
}

export function ChartPlaceholder({ title, note, spinning = false }: ChartPlaceholderProps) {
  return (
    <div className={title ? "panel" : undefined} data-region="chart-panel">
      {title ? <h2 className="panel__title">{title}</h2> : null}
      <div className={`chart-placeholder${spinning ? " chart-placeholder--loading" : ""}`}>
        {spinning ? <span className="spinner" aria-label="Loading chart" /> : (note ?? "Chart from gathered data only — stub")}
      </div>
    </div>
  );
}
