import type { HandSummary } from "../../types/poker";

interface HandPickerProps {
  hands: HandSummary[];
  selectedId: number | null;
  onSelect: (handId: number) => void;
}

export function HandPicker({ hands, selectedId, onSelect }: HandPickerProps) {
  if (hands.length === 0) {
    return (
      <p className="muted" data-region="hand-picker">
        No imported hands yet.
      </p>
    );
  }

  return (
    <label className="hand-picker" data-region="hand-picker">
      <span className="muted">Hand</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        {hands.map((hand) => (
          <option key={hand.id} value={hand.id}>
            {hand.externalHandId ?? `Hand #${hand.id}`}
            {hand.heroCards ? ` · ${hand.heroCards}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
