import type { HandSummary } from "../../types/poker";

interface HandListProps {
  hands: HandSummary[];
  onSelect?: (hand: HandSummary) => void;
}

export function HandList({ hands, onSelect }: HandListProps) {
  if (hands.length === 0) {
    return (
      <div className="empty-state" role="status">
        No hands in the local database yet. Import histories to populate this
        list.
      </div>
    );
  }

  return (
    <div className="hand-list" role="list">
      {hands.map((hand) => (
        <button
          key={hand.id}
          type="button"
          className="hand-list__row"
          role="listitem"
          onClick={() => onSelect?.(hand)}
        >
          <span>
            {hand.externalHandId ?? `Hand #${hand.id}`}
            <span className="muted"> · {hand.site ?? "unknown site"}</span>
          </span>
          <span className="mono">{hand.heroCards ?? "—"}</span>
          <span className="mono">
            {hand.heroNet != null ? hand.heroNet.toFixed(2) : "—"}
          </span>
        </button>
      ))}
    </div>
  );
}
