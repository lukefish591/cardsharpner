import type { AppScreen } from "../../types/poker";

const ITEMS: { id: AppScreen; label: string }[] = [
  { id: "import", label: "Import" },
  { id: "hands", label: "Hands" },
  { id: "replayer", label: "Replayer" },
  { id: "stats", label: "Stats" },
];

interface NavProps {
  active: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}

export function Nav({ active, onNavigate }: NavProps) {
  return (
    <nav className="app-nav" aria-label="Primary">
      <div className="app-nav__brand">
        Cardsharpener
        <span className="app-nav__brand-sub">Local · Mac desktop</span>
      </div>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.id === active
              ? "app-nav__item app-nav__item--active"
              : "app-nav__item"
          }
          aria-current={item.id === active ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
      <div className="app-nav__footer">
        Hands stay on this Mac. No cloud upload.
      </div>
    </nav>
  );
}
