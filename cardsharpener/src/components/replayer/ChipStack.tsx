import type { ChipSize } from "../../types/poker";

interface ChipStackProps {
  amountLabel: string;
  size: ChipSize;
  x: number;
  y: number;
}

export function ChipStack({ amountLabel, size, x, y }: ChipStackProps) {
  return (
    <div
      className={`chip-stack chip-stack--${size}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-region="chip-stack"
    >
      <span className="chip-stack__chip" aria-hidden="true" />
      <span className="chip-stack__amount">{amountLabel}</span>
    </div>
  );
}
