/** Designer trial palettes — 5 hex slots, local only. Not a production theme system.
 *
 * Slot order:
 *   1 bg       → --cs-bg              page / main canvas
 *   2 surface  → --cs-bg-elevated     nav, cards, panels
 *   3 raised   → --cs-bg-panel        buttons, nested chrome
 *   4 muted    → --cs-border          borders and quiet fills
 *   5 accent   → --cs-accent          links, primary buttons, hero seat
 *
 * Ink (--cs-text / --cs-text-muted) and --cs-accent-muted are derived
 * so a pasted 5-colour array stays readable on light or dark grounds.
 */

export const PALETTE_STORAGE_KEY = "cardsharpener.trialPalette";

export type Hex5 = [string, string, string, string, string];

export interface TrialPalette {
  id: string;
  name: string;
  hex: Hex5;
}

export const DARK_SKELETON: TrialPalette = {
  id: "dark-skeleton",
  name: "Dark skeleton",
  hex: ["#1a1d23", "#242830", "#2c313a", "#3d4450", "#5b8def"],
};

export const SAGE_CREAM: TrialPalette = {
  id: "sage-cream",
  name: "Sage cream",
  hex: ["#ccd5ae", "#e9edc9", "#fefae0", "#faedcd", "#d4a373"],
};

export const PRESETS: TrialPalette[] = [DARK_SKELETON, SAGE_CREAM];

export const SLOT_HINT = "1 bg · 2 surface · 3 raised · 4 muted · 5 accent";

const TRIAL_VARS = [
  "--cs-bg",
  "--cs-bg-elevated",
  "--cs-bg-panel",
  "--cs-border",
  "--cs-text",
  "--cs-text-muted",
  "--cs-accent",
  "--cs-accent-muted",
] as const;

export interface SavedTrialPalette {
  id: string;
  hex: Hex5;
}

export function parseHex5(input: unknown): Hex5 | null {
  let parts: unknown[] = [];

  if (Array.isArray(input)) {
    parts = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        parts = parsed;
      }
    } catch {
      parts = trimmed
        .replace(/[[\]"'`]/g, " ")
        .split(/[\s,;]+/)
        .filter(Boolean);
    }
  } else {
    return null;
  }

  if (parts.length !== 5) return null;

  const hex: string[] = [];
  for (const part of parts) {
    const normalised = normaliseHex(String(part));
    if (!normalised) return null;
    hex.push(normalised);
  }
  return hex as Hex5;
}

export function normaliseHex(value: string): string | null {
  const raw = value.trim();
  const match = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  let digits = match[1].toLowerCase();
  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return `#${digits}`;
}

export function hex5Equal(a: Hex5, b: Hex5): boolean {
  return a.every((value, i) => value === b[i]);
}

export function matchPreset(hex: Hex5): TrialPalette | undefined {
  return PRESETS.find((preset) => hex5Equal(preset.hex, hex));
}

export function formatHex5(hex: Hex5): string {
  return JSON.stringify(hex);
}

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

function clearTrialVars(): void {
  const root = document.documentElement;
  for (const name of TRIAL_VARS) {
    root.style.removeProperty(name);
  }
}

export function applyTrialPalette(hex: Hex5): void {
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

export function revertToDarkSkeleton(): void {
  clearTrialVars();
}

export function persistTrialPalette(saved: SavedTrialPalette): void {
  window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(saved));
}

export function readSavedTrialPalette(): SavedTrialPalette {
  try {
    const raw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (!raw) return { id: DARK_SKELETON.id, hex: DARK_SKELETON.hex };
    const parsed = JSON.parse(raw) as Partial<SavedTrialPalette>;
    const hex = parseHex5(parsed.hex);
    if (!hex) return { id: DARK_SKELETON.id, hex: DARK_SKELETON.hex };
    const preset = matchPreset(hex);
    return { id: preset?.id ?? parsed.id ?? "custom", hex };
  } catch {
    return { id: DARK_SKELETON.id, hex: DARK_SKELETON.hex };
  }
}

export function restoreTrialPalette(): void {
  const saved = readSavedTrialPalette();
  if (saved.id === DARK_SKELETON.id && hex5Equal(saved.hex, DARK_SKELETON.hex)) {
    revertToDarkSkeleton();
    return;
  }
  applyTrialPalette(saved.hex);
}

export function applyAndPersist(hex: Hex5): SavedTrialPalette {
  const preset = matchPreset(hex);
  const saved: SavedTrialPalette = {
    id: preset?.id ?? "custom",
    hex,
  };
  if (saved.id === DARK_SKELETON.id) {
    revertToDarkSkeleton();
  } else {
    applyTrialPalette(hex);
  }
  persistTrialPalette(saved);
  return saved;
}
