interface ChartPlaceholderProps {
  title: string;
  note?: string;
}

export function ChartPlaceholder({ title, note }: ChartPlaceholderProps) {
  return (
    <div className="panel" data-region="chart-panel">
      <h2 className="panel__title">{title}</h2>
      <div className="chart-placeholder">
        {note ?? "Chart from gathered data only — stub"}
      </div>
    </div>
  );
}
