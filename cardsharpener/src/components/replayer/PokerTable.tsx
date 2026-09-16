import type { ReplayFrame } from "../../lib/replay";
import { Board } from "./Board";
import { ChipStack } from "./ChipStack";
import { Pot } from "./Pot";
import { Seat } from "./Seat";

interface PokerTableProps {
  frame?: ReplayFrame | null;
}

/** Skeleton oval table using separate DOM regions (not a canvas). */
export function PokerTable({ frame }: PokerTableProps) {
  if (!frame) {
    return (
      <div className="replayer-table-region" data-region="table">
        <div className="poker-table" aria-hidden="true" />
        <p className="replayer-table-empty">Pick an imported hand to replay.</p>
      </div>
    );
  }

  return (
    <div className="replayer-table-region" data-region="table">
      <div className="poker-table" aria-hidden="true" />
      {frame.seats.map((seat) => (
        <Seat
          key={seat.key}
          name={seat.name}
          position={seat.position}
          stackLabel={seat.stackLabel}
          x={seat.x}
          y={seat.y}
          isHero={seat.isHero}
          folded={seat.folded}
          isActing={seat.isActing}
          allIn={seat.allIn}
          cards={seat.cards}
          faceDown={seat.faceDown}
        />
      ))}
      {frame.seats
        .filter((seat) => seat.streetBet > 0 && seat.chipSize)
        .map((seat) => (
          <ChipStack
            key={`chips-${seat.key}`}
            amount={seat.streetBet}
            size={seat.chipSize!}
            x={seat.chipX}
            y={seat.chipY}
          />
        ))}
      <Board cards={frame.board} />
      <Pot amountLabel={frame.potLabel} />
    </div>
  );
}
