const PLACEHOLDER_ACTIONS = [
  { id: 1, label: "Hero posts SB 0.5" },
  { id: 2, label: "BB posts BB 1" },
  { id: 3, label: "Hero raises to 2.5" },
  { id: 4, label: "BB calls 1.5" },
  { id: 5, label: "Flop dealt" },
  { id: 6, label: "BB checks" },
  { id: 7, label: "Hero bets 2" },
];

interface ActionLogProps {
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function ActionLog({ activeIndex, onSelect }: ActionLogProps) {
  return (
    <aside className="panel replayer-action-log" data-region="action-log">
      <h2 className="panel__title">Action log</h2>
      <ol className="action-log">
        {PLACEHOLDER_ACTIONS.map((action, index) => (
          <li key={action.id}>
            <button
              type="button"
              className={
                index === activeIndex
                  ? "action-log__item action-log__item--active"
                  : "action-log__item"
              }
              onClick={() => onSelect(index)}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ol>
      <p className="muted" style={{ marginTop: 12, fontSize: "0.8rem" }}>
        Placeholder actions — bind to DB `actions` rows after import.
      </p>
    </aside>
  );
}
