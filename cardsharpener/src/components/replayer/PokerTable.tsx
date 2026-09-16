import { chipBucketForAmount } from "../../lib/chips";
import { formatAmount, type ReplayFrame } from "../../lib/replay";
import { Board } from "./Board";
import { ChipStack } from "./ChipStack";
import { Pot } from "./Pot";
import { Seat } from "./Seat";

interface PokerTableProps {
  frame?: ReplayFrame | null;
  useBigBlinds?: boolean;
}

/** Skeleton racetrack table using separate DOM regions (not a canvas). */
export function PokerTable({ frame, useBigBlinds = false }: PokerTableProps) {
  if (!frame) {
    return (
      <div className="replayer-table-region" data-region="table">
        <div className="poker-table" aria-hidden="true" />
        <p className="replayer-table-empty">Pick an imported hand to replay.</p>
      </div>
    );
  }

  const money = (value: number) =>
    formatAmount(value, useBigBlinds, frame.bigBlind);
  const potBucket =
    frame.streetStartPot > 0
      ? chipBucketForAmount(frame.streetStartPot, frame.bigBlind)
      : null;

  return (
    <div className="replayer-table-region" data-region="table">
      <div className="poker-table" aria-hidden="true" />
      {frame.seats.map((seat) => (
        <Seat
          key={seat.key}
          position={seat.position}
          stackLabel={money(seat.stack)}
          x={seat.x}
          y={seat.y}
          isHero={seat.isHero}
          isDealer={false}
          folded={seat.folded}
          isActing={seat.isActing}
          allIn={seat.allIn}
          cards={seat.cards}
          faceDown={seat.faceDown}
        />
      ))}
      {frame.seats
        .filter((seat) => seat.streetBet > 0 && seat.chipBucket)
        .map((seat) => (
          <ChipStack
            key={`chips-${seat.key}`}
            amountLabel={money(seat.streetBet)}
            bucket={seat.chipBucket!}
            x={seat.chipX}
            y={seat.chipY}
          />
        ))}
      <div className="poker-table__center">
        <div className="poker-table__total" data-region="pot-total">
          {money(frame.pot)}
        </div>
        <Board cards={frame.board} />
        <Pot amountLabel={money(frame.streetStartPot)} bucket={potBucket} />
      </div>
    </div>
  );
}
