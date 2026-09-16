import { logoUrl } from "../../lib/assets";
import type { AppScreen } from "../../types/poker";
import { ThemeSwitch } from "./ThemeSwitch";

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
        <img
          className="app-nav__logo"
          src={logoUrl()}
          alt=""
          width={518}
          height={462}
        />
        <span className="app-nav__brand-name">Cardsharpener</span>
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
      <div className="app-nav__tools">
        <ThemeSwitch />
      </div>
      <div className="app-nav__footer">
        Hands stay on this Mac. No cloud upload.
      </div>
    </nav>
  );
}
