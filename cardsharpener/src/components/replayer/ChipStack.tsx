import { chipAssetUrl } from "../../lib/assets";
import { formatMoney } from "../../lib/replay";
import type { ChipSize } from "../../types/poker";

interface ChipStackProps {
  amount: number;
  size: ChipSize;
  x: number;
  y: number;
}

export function ChipStack({ amount, size, x, y }: ChipStackProps) {
  return (
    <div
      className={`chip-stack chip-stack--${size}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-region="chip-stack"
    >
      <img
        className="chip-stack__image"
        src={chipAssetUrl(size)}
        alt=""
        draggable={false}
      />
      <span className="chip-stack__amount">${formatMoney(amount)}</span>
    </div>
  );
}
