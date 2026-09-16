import { Card } from "./Card";

interface SeatProps {
  position: string;
  stackLabel: string;
  cards?: (string | null)[];
  faceDown?: boolean;
  isHero?: boolean;
  isDealer?: boolean;
  folded?: boolean;
  isActing?: boolean;
  allIn?: boolean;
  /** Percent positions relative to table region (0–100). */
  x: number;
  y: number;
}

export function Seat({
  position,
  stackLabel,
  cards,
  faceDown,
  isHero,
  isDealer,
  folded,
  isActing,
  allIn,
  x,
  y,
}: SeatProps) {
  const classes = [
    "seat",
    isHero ? "seat--hero" : "",
    folded ? "seat--folded" : "",
    isActing ? "seat--acting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stackText = `${stackLabel}${allIn ? " AI" : ""}`;

  return (
    <div
      className={classes}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-region="seat"
    >
      <div className="seat__cards" data-region="seat-cards">
        {(cards ?? [null, null]).map((c, i) => (
          <Card
            key={i}
            code={c}
            faceDown={faceDown || (!c && !isHero)}
          />
        ))}
      </div>
      <div className="seat__body">
        <div className="seat__node">
          {isDealer ? (
            <span className="seat__dealer" aria-label="Dealer">
              D
            </span>
          ) : null}
          <span className="seat__stack" title={stackText}>
            {stackText}
          </span>
        </div>
        <span className="seat__position">{position}</span>
      </div>
    </div>
  );
}
