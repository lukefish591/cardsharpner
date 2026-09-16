import type { ReactNode } from "react";

interface ChartPanelProps {
  title: string;
  children: ReactNode;
  note?: string;
}

export function ChartPanel({ title, children, note }: ChartPanelProps) {
  return (
    <section className="panel chart-panel" data-region="chart-panel">
      <h2 className="panel__title">{title}</h2>
      {note ? <p className="chart-panel__note">{note}</p> : null}
      {children}
    </section>
  );
}
