import { Card } from "./Card";

interface SeatProps {
  name: string;
  position?: string;
  stackLabel: string;
  cards?: (string | null)[];
  faceDown?: boolean;
  isHero?: boolean;
  folded?: boolean;
  isActing?: boolean;
  allIn?: boolean;
  /** Percent positions relative to table region (0–100). */
  x: number;
  y: number;
}

export function Seat({
  name,
  position,
  stackLabel,
  cards,
  faceDown,
  isHero,
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
      <div className="seat__name">{name}</div>
      {position ? <div className="seat__position">{position}</div> : null}
      <div className="seat__stack">
        {stackLabel}
        {allIn ? " · all-in" : ""}
      </div>
    </div>
  );
}
