import { useMemo, useState } from "react";
import {
  applyAndPersistTheme,
  readSavedTheme,
  type ThemeMode,
} from "../../lib/palette";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function ThemeSwitch() {
  const initial = useMemo(() => readSavedTheme(), []);
  const [mode, setMode] = useState<ThemeMode>(initial);

  function choose(next: ThemeMode) {
    applyAndPersistTheme(next);
    setMode(next);
  }

  return (
    <div className="theme-switch" role="group" aria-label="Colour mode">
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.id === mode
              ? "theme-switch__btn is-active"
              : "theme-switch__btn"
          }
          aria-pressed={item.id === mode}
          onClick={() => choose(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
