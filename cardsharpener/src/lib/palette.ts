/** Light / Dark palettes — 5 hex slots, local only.
 *
 * Slot order:
 *   1 bg       → --cs-bg              page / main canvas
 *   2 surface  → --cs-bg-elevated     nav, cards, panels
 *   3 raised   → --cs-bg-panel        buttons, nested chrome
 *   4 muted    → --cs-border          borders and quiet fills
 *   5 accent   → --cs-accent          links, primary buttons, hero seat
 *
 * Ink (--cs-text / --cs-text-muted) and --cs-accent-muted are derived.
 */

export const THEME_STORAGE_KEY = "cardsharpener.theme";

export type ThemeMode = "light" | "dark";
export type Hex5 = [string, string, string, string, string];

export const LIGHT_HEX: Hex5 = [
  "#f1f2eb",
  "#d8dad3",
  "#a4c2a5",
  "#566246",
  "#4a4a48",
];

export const DARK_HEX: Hex5 = [
  "#1c2e30",
  "#023a40",
  "#061c1f",
  "#3f4445",
  "#536b70",
];

function parseRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function luminance(hex: string): number {
  const { r, g, b } = parseRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function mixHex(a: string, b: string, t: number): string {
  const A = parseRgb(a);
  const B = parseRgb(b);
  return toHex(
    A.r + (B.r - A.r) * t,
    A.g + (B.g - A.g) * t,
    A.b + (B.b - A.b) * t,
  );
}

function contrastingInk(bg: string): string {
  return luminance(bg) > 0.45 ? "#1a1d23" : "#e8eaed";
}

export function hexForMode(mode: ThemeMode): Hex5 {
  return mode === "light" ? LIGHT_HEX : DARK_HEX;
}

export function applyPalette(hex: Hex5): void {
  const [bg, surface, raised, muted, accent] = hex;
  const root = document.documentElement;
  const text = contrastingInk(bg);
  const mutedText = mixHex(text, muted, 0.38);
  const accentMuted = mixHex(accent, raised, 0.42);

  root.style.setProperty("--cs-bg", bg);
  root.style.setProperty("--cs-bg-elevated", surface);
  root.style.setProperty("--cs-bg-panel", raised);
  root.style.setProperty("--cs-border", muted);
  root.style.setProperty("--cs-text", text);
  root.style.setProperty("--cs-text-muted", mutedText);
  root.style.setProperty("--cs-accent", accent);
  root.style.setProperty("--cs-accent-muted", accentMuted);
}

export function readSavedTheme(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function persistTheme(mode: ThemeMode): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export function applyTheme(mode: ThemeMode): void {
  applyPalette(hexForMode(mode));
}

export function applyAndPersistTheme(mode: ThemeMode): ThemeMode {
  applyTheme(mode);
  persistTheme(mode);
  return mode;
}

export function restoreTheme(): void {
  applyTheme(readSavedTheme());
}
