import { useMemo, useRef, type CSSProperties } from "react";
import { useElementSize } from "../../hooks/useElementSize";
import { chipBucketForAmount } from "../../lib/chips";
import { formatAmount, type ReplayFrame } from "../../lib/replay";
import {
  computeTableMetrics,
  DEFAULT_TABLE_SIZE,
  layoutSeats,
  tableRegionVars,
} from "../../lib/tableLayout";
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
  const regionRef = useRef<HTMLDivElement>(null);
  const measured = useElementSize(regionRef);
  const seatCount = frame?.seats.length ?? 6;
  const metrics = useMemo(() => {
    const width = measured.width || DEFAULT_TABLE_SIZE.width;
    const height = measured.height || DEFAULT_TABLE_SIZE.height;
    return computeTableMetrics(width, height, seatCount);
  }, [measured.width, measured.height, seatCount]);
  const slots = useMemo(
    () => layoutSeats(metrics, seatCount),
    [metrics, seatCount],
  );
  const vars = tableRegionVars(metrics);

  if (!frame) {
    return (
      <div
        ref={regionRef}
        className="replayer-table-region"
        data-region="table"
        style={vars as CSSProperties}
      >
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
    <div
      ref={regionRef}
      className="replayer-table-region"
      data-region="table"
        style={vars as CSSProperties}
    >
      <div className="poker-table" aria-hidden="true" />
      {frame.seats.map((seat, index) => {
        const slot = slots[index] ?? { x: seat.x, y: seat.y, chipX: seat.chipX, chipY: seat.chipY };
        return (
          <Seat
            key={seat.key}
            position={seat.position}
            stackLabel={money(seat.stack)}
            x={slot.x}
            y={slot.y}
            isHero={seat.isHero}
            isDealer={false}
            folded={seat.folded}
            isActing={seat.isActing}
            allIn={seat.allIn}
            cards={seat.cards}
            faceDown={seat.faceDown}
          />
        );
      })}
      {frame.seats.map((seat, index) => {
        if (seat.streetBet <= 0 || !seat.chipBucket) return null;
        const slot = slots[index];
        if (!slot) return null;
        return (
          <ChipStack
            key={`chips-${seat.key}`}
            amountLabel={money(seat.streetBet)}
            bucket={seat.chipBucket}
            x={slot.chipX}
            y={slot.chipY}
          />
        );
      })}
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
