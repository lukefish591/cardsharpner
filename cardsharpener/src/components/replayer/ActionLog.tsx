import { formatActionLine } from "../../lib/replay";
import type { ReplayAction } from "../../types/poker";

interface ActionLogProps {
  actions: ReplayAction[];
  /** Number of actions applied; item i is current when appliedCount === i + 1. */
  appliedCount: number;
  onSelect: (appliedCount: number) => void;
}

export function ActionLog({ actions, appliedCount, onSelect }: ActionLogProps) {
  return (
    <aside className="panel replayer-action-log" data-region="action-log">
      <h2 className="panel__title">Action log</h2>
      {actions.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No actions for this hand.
        </p>
      ) : (
        <ol className="action-log">
          {actions.map((action, index) => (
            <li key={action.id || `${action.seq}-${index}`}>
              <button
                type="button"
                className={
                  appliedCount === index + 1
                    ? "action-log__item action-log__item--active"
                    : "action-log__item"
                }
                onClick={() => onSelect(index + 1)}
              >
                {formatActionLine(action)}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
