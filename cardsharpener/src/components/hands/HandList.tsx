import { parseCardCodes } from "../../lib/assets";
import { formatNetBb, formatPlayedAt } from "../../lib/stats";
import type { HandSummary } from "../../types/poker";
import { Card } from "../replayer/Card";

interface HandListProps {
  hands: HandSummary[];
  onSelect?: (hand: HandSummary) => void;
  loading?: boolean;
  emptyLabel?: string;
}

export function HandList({
  hands,
  onSelect,
  loading = false,
  emptyLabel,
}: HandListProps) {
  if (loading && hands.length === 0) {
    return (
      <div className="hand-list" role="status" aria-label="Loading hands">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="hand-list__skeleton" />
        ))}
      </div>
    );
  }

  if (hands.length === 0) {
    return (
      <div className="empty-state" role="status">
        {emptyLabel ??
          "No hands in the local database yet. Import histories to populate this list."}
      </div>
    );
  }

  return (
    <div className={`hand-list${loading ? " is-refreshing" : ""}`} role="list">
      {hands.map((hand) => {
        const hole = parseCardCodes(hand.heroCards);
        const board = parseCardCodes(hand.boardCards);
        const flop = board.slice(0, 3);
        const runout = board.slice(3);
        const net = formatNetBb(hand.heroNet, hand.stakes);
        const netTone =
          hand.heroNet == null ? "" : hand.heroNet >= 0 ? " is-pos" : " is-neg";
        return (
          <button
            key={hand.id}
            type="button"
            className="hand-list__row"
            role="listitem"
            onClick={() => onSelect?.(hand)}
          >
            <span className="hand-list__cards" aria-label={hand.heroCards ?? "Hole cards"}>
              {(hole.length ? hole : [null, null]).map((code, i) => (
                <Card key={`h-${i}`} code={code} />
              ))}
            </span>
            <span className={`hand-list__net mono${netTone}`}>{net}</span>
            <span className="hand-list__when muted">{formatPlayedAt(hand.playedAt)}</span>
            <span className="hand-list__board" aria-label={hand.boardCards ?? "Board"}>
              {flop.map((code, i) => (
                <Card key={`f-${i}`} code={code} />
              ))}
              {runout.length > 0 ? (
                <span className="hand-list__runout">
                  {runout.map((code, i) => (
                    <Card key={`r-${i}`} code={code} />
                  ))}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
