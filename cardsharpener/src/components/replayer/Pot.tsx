import { chipStackUrl, type ChipBucket } from "../../lib/chips";

interface PotProps {
  amountLabel: string;
  bucket?: ChipBucket | null;
}

export function Pot({ amountLabel, bucket }: PotProps) {
  return (
    <div className="poker-table__pot" data-region="pot">
      {bucket ? (
        <img
          className="chip-stack__image"
          src={chipStackUrl(bucket)}
          alt=""
          draggable={false}
        />
      ) : null}
      <span className="poker-table__pot-amount">{amountLabel}</span>
    </div>
  );
}
