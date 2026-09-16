import type { PlaybackStep } from "../../lib/replay";

interface ActionLogProps {
  steps: PlaybackStep[];
  currentStep: number;
  onSelect: (step: number) => void;
}

export function ActionLog({ steps, currentStep, onSelect }: ActionLogProps) {
  const visible = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.kind !== "start");

  return (
    <aside className="panel replayer-action-log" data-region="action-log">
      <h2 className="panel__title">Action log</h2>
      {visible.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No actions for this hand.
        </p>
      ) : (
        <ol className="action-log">
          {visible.map(({ step, index }) => (
            <li key={`${step.kind}-${step.applyThrough}-${index}`}>
              <button
                type="button"
                className={
                  currentStep === index
                    ? "action-log__item action-log__item--active"
                    : "action-log__item"
                }
                onClick={() => onSelect(index)}
              >
                {step.kind === "deal"
                  ? `${step.street.charAt(0).toUpperCase()}${step.street.slice(1)} · Deal`
                  : step.label}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
