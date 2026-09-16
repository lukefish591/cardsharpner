/**
 * Single source of truth for Replayer table geometry.
 *
 * Seats, hole cards, board, chips, and type scale from one seat diameter
 * derived from the measured table region. The oval uses whatever is left
 * after padding for those pieces, so it fills the panel without overlaps.
 */

export interface TableOval {
  /** Center and radii in percent of the table region (0–100). */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface TableMetrics {
  width: number;
  height: number;
  seatD: number;
  holeW: number;
  holeH: number;
  boardW: number;
  boardH: number;
  chipH: number;
  crown: number;
  gap: number;
  cardGap: number;
  seatLine: number;
  ovalLine: number;
  textTotal: number;
  textPos: number;
  textStack: number;
  textChip: number;
  holeOffset: number;
  oval: TableOval;
  chipT: number;
}

export interface SeatSlot {
  x: number;
  y: number;
  chipX: number;
  chipY: number;
}

/** Face-card aspect (w/h) matching Luke's PNGs / current 54×76 board tiles. */
const CARD_RATIO = 54 / 76;
/** Hole-card height as a fraction of the seat circle (and board card height). */
const HOLE_FRACTION = 54 / 76;

const MIN_D = 28;
const MAX_D = 112;

export const DEFAULT_TABLE_SIZE = { width: 960, height: 560 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pieces(d: number) {
  const boardH = d;
  const boardW = d * CARD_RATIO;
  const holeH = d * HOLE_FRACTION;
  const holeW = holeH * CARD_RATIO;
  const cardGap = Math.max(2, d * 0.055);
  const holePairW = holeW * 2 + cardGap;
  const labelH = Math.max(12, d * 0.24);
  const gap = Math.max(4, d * 0.1);
  const chipH = d * 0.55;
  const boardRowW = 5 * boardW + 4 * cardGap;
  const totalH = Math.max(16, d * 0.28);
  const potH = chipH + Math.max(14, d * 0.22);
  const centerW = boardRowW;
  const centerH = totalH + boardH + potH + gap * 2;
  return {
    boardH,
    boardW,
    holeH,
    holeW,
    holePairW,
    labelH,
    gap,
    cardGap,
    chipH,
    centerW,
    centerH,
    padX: d / 2 + holePairW + 8,
    padY: d / 2 + labelH + 10,
  };
}

function ovalPx(w: number, h: number, padX: number, padY: number) {
  return {
    cx: w / 2,
    cy: h / 2,
    rx: Math.max(40, w / 2 - padX),
    ry: Math.max(28, h / 2 - padY),
  };
}

function seatsFit(
  w: number,
  h: number,
  d: number,
  seatCount: number,
): { ok: boolean; t: number } {
  const p = pieces(d);
  if (w < p.padX * 2 + 64 || h < p.padY * 2 + 48) {
    return { ok: false, t: 0.45 };
  }
  const o = ovalPx(w, h, p.padX, p.padY);
  if (o.rx < 48 || o.ry < 32) return { ok: false, t: 0.45 };

  const n = Math.max(seatCount, 2);
  const halfCW = p.centerW / 2 + 8;
  const halfCH = p.centerH / 2 + 8;
  const chipClear = p.chipH * 0.55 + 6;
  let tMin = 0.28;
  let tMax = 0.62;

  for (let i = 0; i < n; i += 1) {
    const angle = Math.PI / 2 + (2 * Math.PI * i) / n;
    const sx = o.cx + o.rx * Math.cos(angle);
    const sy = o.cy + o.ry * Math.sin(angle);
    const dist = Math.hypot(o.cx - sx, o.cy - sy);
    if (dist < d) return { ok: false, t: 0.45 };

    const seatClearT = (d / 2 + chipClear) / dist;
    const ux = Math.abs(o.cx - sx) / dist;
    const uy = Math.abs(o.cy - sy) / dist;
    const centerReach = halfCW * ux + halfCH * uy;
    const centerClearT = 1 - (centerReach + chipClear) / dist;
    tMin = Math.max(tMin, seatClearT);
    tMax = Math.min(tMax, centerClearT);

    const j = (i + 1) % n;
    const a2 = Math.PI / 2 + (2 * Math.PI * j) / n;
    const sx2 = o.cx + o.rx * Math.cos(a2);
    const sy2 = o.cy + o.ry * Math.sin(a2);
    if (Math.hypot(sx2 - sx, sy2 - sy) < d * 1.12) {
      return { ok: false, t: 0.45 };
    }

    const holeLeft = sx - d / 2 - p.holePairW - 4;
    const holeRight = sx - d / 2 - 2;
    const holeTop = sy - p.holeH / 2;
    const holeBottom = sy + p.holeH / 2;
    if (
      holeRight > o.cx - halfCW &&
      holeLeft < o.cx + halfCW &&
      holeBottom > o.cy - halfCH &&
      holeTop < o.cy + halfCH
    ) {
      return { ok: false, t: 0.45 };
    }
    if (holeLeft < 2 || holeRight > w - 2) {
      return { ok: false, t: 0.45 };
    }
  }

  if (tMin > tMax - 0.04) return { ok: false, t: 0.45 };
  return { ok: true, t: (tMin + tMax) / 2 };
}

export function computeTableMetrics(
  width: number,
  height: number,
  seatCount = 6,
): TableMetrics {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const n = Math.max(2, seatCount);

  let lo = MIN_D;
  let hi = Math.min(MAX_D, Math.min(w, h) * 0.22);
  let best = MIN_D;
  let bestT = 0.42;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    const fit = seatsFit(w, h, mid, n);
    if (fit.ok) {
      best = mid;
      bestT = fit.t;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const fallback = seatsFit(w, h, best, n);
  if (!fallback.ok) {
    best = MIN_D;
    bestT = 0.38;
  } else {
    bestT = fallback.t;
  }

  const d = best;
  const p = pieces(d);
  const padX = clamp(p.padX, 36, w * 0.28);
  const padY = clamp(p.padY, 28, h * 0.28);
  const ovalW = Math.max(80, w - padX * 2);
  const ovalH = Math.max(56, h - padY * 2);
  const oval: TableOval = {
    cx: 50,
    cy: 50,
    rx: (ovalW / 2 / w) * 100,
    ry: (ovalH / 2 / h) * 100,
  };

  return {
    width: w,
    height: h,
    seatD: d,
    holeW: p.holeW,
    holeH: p.holeH,
    boardW: p.boardW,
    boardH: p.boardH,
    chipH: p.chipH,
    crown: Math.max(10, d * 0.2),
    gap: p.gap,
    cardGap: p.cardGap,
    seatLine: Math.max(2, d * 0.04),
    ovalLine: Math.max(2, d * 0.055),
    textTotal: Math.max(14, d * 0.3),
    textPos: Math.max(10, d * 0.2),
    textStack: Math.max(8, d * 0.125),
    textChip: Math.max(10, d * 0.18),
    holeOffset: d / 2 + 8,
    oval,
    chipT: clamp(bestT, 0.3, 0.55),
  };
}

export function tableRegionVars(m: TableMetrics): Record<string, string> {
  const left = m.oval.cx - m.oval.rx;
  const top = m.oval.cy - m.oval.ry;
  return {
    "--seat-d": `${m.seatD}px`,
    "--seat-line": `${m.seatLine}px`,
    "--hole-card-w": `${m.holeW}px`,
    "--hole-card-h": `${m.holeH}px`,
    "--board-card-w": `${m.boardW}px`,
    "--board-card-h": `${m.boardH}px`,
    "--chip-box": `${m.chipH}px`,
    "--chip-h": `${m.chipH}px`,
    "--crown-d": `${m.crown}px`,
    "--table-gap": `${m.gap}px`,
    "--card-gap": `${m.cardGap}px`,
    "--hole-offset": `${m.holeOffset}px`,
    "--text-total": `${m.textTotal}px`,
    "--text-pos": `${m.textPos}px`,
    "--text-stack": `${m.textStack}px`,
    "--text-chip": `${m.textChip}px`,
    "--oval-line": `${m.ovalLine}px`,
    "--oval-left": `${left}%`,
    "--oval-right": `${100 - (m.oval.cx + m.oval.rx)}%`,
    "--oval-top": `${top}%`,
    "--oval-bottom": `${100 - (m.oval.cy + m.oval.ry)}%`,
    "--oval-cy": `${m.oval.cy}%`,
  };
}

export function layoutSeats(metrics: TableMetrics, count: number): SeatSlot[] {
  if (count <= 0) return [];
  const { oval, chipT } = metrics;
  const slots: SeatSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI / 2 + (2 * Math.PI * i) / count;
    const x = oval.cx + oval.rx * Math.cos(angle);
    const y = oval.cy + oval.ry * Math.sin(angle);
    slots.push({
      x,
      y,
      chipX: x + (oval.cx - x) * chipT,
      chipY: y + (oval.cy - y) * chipT,
    });
  }
  return slots;
}
