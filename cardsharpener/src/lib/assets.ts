/** Card + chip raster assets copied from Luke's CardFaceAssets / Chips assets. */

const CARD_RANKS = new Set(["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]);
const CARD_SUITS = new Set(["c", "d", "h", "s"]);

export function normalizeCardCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!trimmed || trimmed === "??") return null;
  const rank = trimmed[0]?.toUpperCase();
  const suit = trimmed[1]?.toLowerCase();
  if (!rank || !suit || !CARD_RANKS.has(rank) || !CARD_SUITS.has(suit)) {
    return null;
  }
  return `${rank}${suit}`;
}

export function cardAssetUrl(code: string | null | undefined): string | null {
  const key = normalizeCardCode(code);
  return key ? `/assets/cards/${key}.png` : null;
}

/** Luke's red lattice back from CardFaceAssets/Card Back.png */
export function cardBackUrl(): string {
  return "/assets/cards/back.png";
}

export function chipAssetUrl(size: "small" | "medium" | "big"): string {
  return `/assets/chips/${size}.png`;
}

export function parseCardCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((part) => normalizeCardCode(part))
    .filter((part): part is string => Boolean(part));
}
