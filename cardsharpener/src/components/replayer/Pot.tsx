import { chipNorm, chipStackUrl, type ChipBucket } from "../../lib/chips";

interface PotProps {
  amountLabel: string;
  bucket?: ChipBucket | null;
}

export function Pot({ amountLabel, bucket }: PotProps) {
  return (
    <div
      className="poker-table__pot"
      data-region="pot"
      style={
        bucket
          ? { ["--chip-norm" as string]: String(chipNorm(bucket)) }
          : undefined
      }
    >
      {bucket ? (
        <span className="chip-stack__art">
          <img
            className="chip-stack__image"
            src={chipStackUrl(bucket)}
            alt=""
            draggable={false}
          />
        </span>
      ) : null}
      <span className="poker-table__pot-amount">{amountLabel}</span>
    </div>
  );
}
