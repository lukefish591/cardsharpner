import { Board } from "./Board";
import { Pot } from "./Pot";
import { Seat } from "./Seat";

/** Skeleton oval table using separate DOM regions (not a canvas). */
export function PokerTable() {
  return (
    <div className="replayer-table-region" data-region="table">
      <div className="poker-table" aria-hidden="true" />
      <Seat name="UTG" stackLabel="100 bb" x={18} y={35} cards={[null, null]} />
      <Seat name="MP" stackLabel="100 bb" x={18} y={65} cards={[null, null]} />
      <Seat
        name="Hero"
        stackLabel="100 bb"
        x={50}
        y={88}
        isHero
        cards={["As", "Kd"]}
      />
      <Seat name="CO" stackLabel="100 bb" x={82} y={65} cards={[null, null]} />
      <Seat name="BTN" stackLabel="100 bb" x={82} y={35} cards={[null, null]} />
      <Seat name="SB" stackLabel="99.5 bb" x={65} y={18} cards={[null, null]} />
      <Seat name="BB" stackLabel="99 bb" x={35} y={18} cards={[null, null]} />
      <Board cards={[null, null, null, null, null]} />
      <Pot amountLabel="1.5 bb" />
    </div>
  );
}
