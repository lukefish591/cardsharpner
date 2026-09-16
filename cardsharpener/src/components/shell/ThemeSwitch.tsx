import { useMemo, useState } from "react";
import {
  applyAndPersistTheme,
  readSavedTheme,
  type ThemeMode,
} from "../../lib/palette";

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M3.2 12.8l1.3-1.3M11.5 4.5l1.3-1.3" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.4 10.6A5.2 5.2 0 0 1 6.2 2.8 5.3 5.3 0 1 0 11.4 10.6Z"
      />
    </svg>
  );
}

export function ThemeSwitch() {
  const initial = useMemo(() => readSavedTheme(), []);
  const [mode, setMode] = useState<ThemeMode>(initial);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    applyAndPersistTheme(next);
    setMode(next);
  }

  const nextLabel = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className="theme-switch"
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggle}
    >
      {mode === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
