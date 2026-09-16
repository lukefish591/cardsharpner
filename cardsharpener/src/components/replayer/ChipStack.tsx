import { chipNorm, chipStackUrl, type ChipBucket } from "../../lib/chips";

interface ChipStackProps {
  amountLabel: string;
  bucket: ChipBucket;
  x: number;
  y: number;
}

export function ChipStack({ amountLabel, bucket, x, y }: ChipStackProps) {
  return (
    <div
      className="chip-stack"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        ["--chip-norm" as string]: String(chipNorm(bucket)),
      }}
      data-region="chip-stack"
    >
      <span className="chip-stack__art">
        <img
          className="chip-stack__image"
          src={chipStackUrl(bucket)}
          alt=""
          draggable={false}
        />
      </span>
      <span className="chip-stack__amount">{amountLabel}</span>
    </div>
  );
}
