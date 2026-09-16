import { Card } from "./Card";

interface SeatProps {
  name: string;
  stackLabel: string;
  cards?: (string | null)[];
  isHero?: boolean;
  /** Percent positions relative to table region (0–100). */
  x: number;
  y: number;
}

export function Seat({ name, stackLabel, cards, isHero, x, y }: SeatProps) {
  return (
    <div
      className={isHero ? "seat seat--hero" : "seat"}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-region="seat"
    >
      <div className="seat__cards" data-region="seat-cards">
        {(cards ?? [null, null]).map((c, i) => (
          <Card key={i} code={c} faceDown={!c && !isHero} />
        ))}
      </div>
      <div className="seat__name">{name}</div>
      <div className="seat__stack">{stackLabel}</div>
    </div>
  );
}
