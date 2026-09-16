import { chipStackUrl, type ChipBucket } from "../../lib/chips";

interface ChipStackProps {
  amountLabel: string;
  bucket: ChipBucket;
  x: number;
  y: number;
}

export function ChipStack({ amountLabel, bucket, x, y }: ChipStackProps) {
  return (
    <div
      className={`chip-stack chip-stack--${bucket}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-region="chip-stack"
    >
      <img
        className="chip-stack__image"
        src={chipStackUrl(bucket)}
        alt=""
        draggable={false}
      />
      <span className="chip-stack__amount">{amountLabel}</span>
    </div>
  );
}
