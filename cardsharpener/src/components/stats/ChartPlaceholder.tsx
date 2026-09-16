interface ChartPlaceholderProps {
  title: string;
  note?: string;
}

export function ChartPlaceholder({ title, note }: ChartPlaceholderProps) {
  return (
    <div className={title ? "panel" : undefined} data-region="chart-panel">
      {title ? <h2 className="panel__title">{title}</h2> : null}
      <div className="chart-placeholder">
        {note ?? "Chart from gathered data only — stub"}
      </div>
    </div>
  );
}
