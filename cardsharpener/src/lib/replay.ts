import { parseCardCodes } from "./assets";
import { chipBucketForAmount, type ChipBucket } from "./chips";
import type { HandReplay, ReplayAction, ReplayPlayer } from "../types/poker";

/**
 * Wide racetrack oval, in table-region percent.
 * Must match `.poker-table` insets in app.css (cx/cy/rx/ry).
 */
export const TABLE_OVAL = { cx: 50, cy: 51, rx: 36, ry: 22 };

export interface SeatFrame {
  key: string;
  seat: number | null;
  name: string;
  position: string;
  stack: number;
  stackLabel: string;
  streetBet: number;
  folded: boolean;
  allIn: boolean;
  isHero: boolean;
  isDealer: boolean;
  isActing: boolean;
  cards: (string | null)[];
  faceDown: boolean;
  chipBucket: ChipBucket | null;
  x: number;
  y: number;
  chipX: number;
  chipY: number;
}

export interface ReplayFrame {
  street: string;
  streetLabel: string;
  board: (string | null)[];
  /** Running pot including the current street's bets. */
  pot: number;
  potLabel: string;
  /** Pot in the middle when this street began (blinds on preflop). Chip image uses this. */
  streetStartPot: number;
  bigBlind: number;
  seats: SeatFrame[];
  lastActionIndex: number;
  lastActionLabel: string;
  playbackKind: PlaybackStep["kind"];
}

export interface PlaybackStep {
  kind: "start" | "deal" | "action";
  street: string;
  /** Inclusive last raw action index to apply. -1 = nothing yet. */
  applyThrough: number;
  actionIndex: number | null;
  label: string;
}

const DEAL_STREETS = new Set(["flop", "turn", "river"]);

export function isBlindPost(action: ReplayAction): boolean {
  return action.actionType.toLowerCase() === "post";
}

interface MutableSeat {
  player: ReplayPlayer;
  stack: number;
  streetBet: number;
  folded: boolean;
  allIn: boolean;
  holeCards: string[];
}

const MONEY_ACTIONS = new Set(["post", "call", "bet", "raise", "all-in"]);
const STREET_RESET = new Set(["preflop", "flop", "turn", "river", "showdown"]);

export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatBb(value: number, bigBlind: number): string {
  if (bigBlind <= 0) return `$${formatMoney(value)}`;
  const bb = value / bigBlind;
  const rounded = Math.round(bb * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} BB`;
}

export function formatAmount(
  value: number,
  useBigBlinds: boolean,
  bigBlind: number,
): string {
  return useBigBlinds ? formatBb(value, bigBlind) : `$${formatMoney(value)}`;
}

export function abbreviatePosition(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase().replace(/[\s_+-]+/g, "");
  const map: Record<string, string> = {
    button: "BTN",
    btn: "BTN",
    dealer: "BTN",
    smallblind: "SB",
    sb: "SB",
    bigblind: "BB",
    bb: "BB",
    cutoff: "CO",
    co: "CO",
    hijack: "HJ",
    hj: "HJ",
    lojack: "LJ",
    lj: "LJ",
    utg: "UTG",
    utg1: "UTG1",
    utgplus1: "UTG1",
    utg2: "UTG2",
    utgplus2: "UTG2",
    mp: "MP",
    mp1: "MP1",
    mpplus1: "LJ",
    mp2: "MP2",
    ep: "EP",
  };
  if (map[key]) return map[key];
  return raw.replace(/[\s+]/g, "").toUpperCase();
}

export function streetLabel(street: string): string {
  if (!street) return "—";
  return street.charAt(0).toUpperCase() + street.slice(1);
}

export function parseBigBlind(stakes: string | null | undefined): number {
  if (!stakes) return 0;
  const match = stakes.match(/\$?([\d.]+)\s*\/\s*\$?([\d.]+)/);
  if (!match) return 0;
  return Number(match[2]) || 0;
}

export function parseShownCards(rawText: string | null | undefined): Map<string, string[]> {
  const shown = new Map<string, string[]>();
  if (!rawText) return shown;
  const patterns = [
    /(?:^|\n)([^:\n]+): shows \[([^\]]+)\]/gi,
    /Seat \d+: ([^(]+).*?showed \[([^\]]+)\]/gi,
  ];
  for (const pattern of patterns) {
    for (const match of rawText.matchAll(pattern)) {
      const name = match[1].trim();
      const cards = parseCardCodes(match[2]);
      if (name && cards.length) shown.set(name, cards);
    }
  }
  return shown;
}

function playerKey(player: ReplayPlayer, index: number): string {
  if (player.seat != null) return `seat-${player.seat}`;
  if (player.name) return `name-${player.name}`;
  return `idx-${index}`;
}

function findSeat(
  seats: MutableSeat[],
  action: ReplayAction,
): MutableSeat | undefined {
  if (action.actorSeat != null) {
    const bySeat = seats.find((s) => s.player.seat === action.actorSeat);
    if (bySeat) return bySeat;
  }
  if (action.actorName) {
    return seats.find((s) => s.player.name === action.actorName);
  }
  return undefined;
}

function collectStreetBets(seats: MutableSeat[]) {
  for (const seat of seats) {
    seat.streetBet = 0;
  }
}

function towardCenter(x: number, y: number, t = 0.5): { x: number; y: number } {
  return {
    x: x + (TABLE_OVAL.cx - x) * t,
    y: y + (TABLE_OVAL.cy - y) * t,
  };
}

function boardForStreet(street: string, board: string[], atEnd: boolean): (string | null)[] {
  const slots: (string | null)[] = [null, null, null, null, null];
  let count = 0;
  if (atEnd) {
    count = Math.min(board.length, 5);
  } else if (street === "flop") {
    count = 3;
  } else if (street === "turn") {
    count = 4;
  } else if (street === "river" || street === "showdown") {
    count = 5;
  }
  for (let i = 0; i < count && i < board.length; i += 1) {
    slots[i] = board[i];
  }
  return slots;
}

function actionLabel(action: ReplayAction): string {
  const name = action.actorName || (action.actorSeat != null ? `Seat ${action.actorSeat}` : "Unknown");
  const kind = action.actionType;
  const amount =
    action.amount != null && action.amount > 0 ? ` $${formatMoney(action.amount)}` : "";
  const allIn = action.isAllIn ? " all-in" : "";
  return `${name} ${kind}${amount}${allIn}`;
}

function assignSlots(count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  const slots: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    // Hero at bottom (π/2), then counter-clockwise around the racetrack.
    const angle = Math.PI / 2 + (2 * Math.PI * i) / count;
    slots.push({
      x: TABLE_OVAL.cx + TABLE_OVAL.rx * Math.cos(angle),
      y: TABLE_OVAL.cy + TABLE_OVAL.ry * Math.sin(angle),
    });
  }
  return slots;
}

/** Playback list: blinds applied at start, no post steps, deal is its own step. */
export function buildPlayback(hand: HandReplay): PlaybackStep[] {
  const actions = hand.actions;
  let lastLeadingPost = -1;
  for (let i = 0; i < actions.length; i += 1) {
    if (!isBlindPost(actions[i])) break;
    lastLeadingPost = i;
  }

  const steps: PlaybackStep[] = [
    {
      kind: "start",
      street: "preflop",
      applyThrough: lastLeadingPost,
      actionIndex: null,
      label: "Start",
    },
  ];

  let lastStreet = "preflop";
  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    if (isBlindPost(action)) continue;
    const street = (action.street || lastStreet).toLowerCase();
    if (DEAL_STREETS.has(street) && street !== lastStreet) {
      steps.push({
        kind: "deal",
        street,
        applyThrough: i - 1,
        actionIndex: null,
        label: `Deal ${street}`,
      });
      lastStreet = street;
    }
    if (action.actionType.toLowerCase() === "deal") {
      lastStreet = street;
      continue;
    }
    lastStreet = street;
    steps.push({
      kind: "action",
      street,
      applyThrough: i,
      actionIndex: i,
      label: formatActionLine(action),
    });
  }
  return steps;
}

/**
 * `step` is an index into `buildPlayback(hand)`.
 */
export function computeFrame(hand: HandReplay, step: number): ReplayFrame {
  const playback = buildPlayback(hand);
  const idx = Math.max(0, Math.min(step, Math.max(0, playback.length - 1)));
  const play = playback[idx] ?? playback[0];
  const applyThrough = play?.applyThrough ?? -1;
  const actions = hand.actions;
  const bigBlind = parseBigBlind(hand.stakes);
  const shown = parseShownCards(hand.rawText);
  const boardCards = parseCardCodes(hand.boardCards);

  const ordered = [...hand.players];
  const heroIndex = ordered.findIndex((p) => p.isHero);
  if (heroIndex > 0) {
    ordered.push(...ordered.splice(0, heroIndex));
  }

  const seats: MutableSeat[] = ordered.map((player) => {
    const fromPlayer = parseCardCodes(player.holeCards);
    const fromHero = player.isHero ? parseCardCodes(hand.heroCards) : [];
    const fromShown = player.name ? shown.get(player.name) ?? [] : [];
    return {
      player,
      stack: player.startingStack ?? 0,
      streetBet: 0,
      folded: false,
      allIn: false,
      holeCards: fromPlayer.length ? fromPlayer : fromHero.length ? fromHero : fromShown,
    };
  });

  let street = "preflop";
  let pot = 0;
  let streetStartPot = 0;
  let lastActionIndex = -1;

  for (let i = 0; i <= applyThrough && i < actions.length; i += 1) {
    const action = actions[i];
    const nextStreet = (action.street || street).toLowerCase();
    if (STREET_RESET.has(nextStreet) && nextStreet !== street) {
      collectStreetBets(seats);
      street = nextStreet;
      streetStartPot = pot;
    } else {
      street = nextStreet;
    }
    lastActionIndex = i;

    const seat = findSeat(seats, action);
    const amount = action.amount ?? 0;
    const kind = action.actionType.toLowerCase();

    if (seat) {
      if (kind === "fold") {
        seat.folded = true;
      } else if (kind === "post" || kind === "bet") {
        seat.streetBet = amount;
        seat.stack = Math.max(0, seat.stack - amount);
        if (action.isAllIn) seat.allIn = true;
      } else if (kind === "call") {
        seat.streetBet += amount;
        seat.stack = Math.max(0, seat.stack - amount);
        if (action.isAllIn) seat.allIn = true;
      } else if (kind === "raise" || kind === "all-in") {
        const facing = seats.reduce(
          (max, other) => (other === seat ? max : Math.max(max, other.streetBet)),
          0,
        );
        const nextBet = Math.max(seat.streetBet + amount, facing + amount);
        const spent = Math.max(amount, nextBet - seat.streetBet);
        seat.stack = Math.max(0, seat.stack - spent);
        seat.streetBet = nextBet;
        if (action.isAllIn || kind === "all-in") seat.allIn = true;
      } else if (kind === "return") {
        seat.stack += amount;
        seat.streetBet = Math.max(0, seat.streetBet - amount);
      } else if (kind === "collect") {
        seat.stack += amount;
        collectStreetBets(seats);
      } else if (kind === "show") {
        if (seat.holeCards.length === 0) {
          const extra = action.actorName ? shown.get(action.actorName) : undefined;
          if (extra) seat.holeCards = extra;
        }
      }
    }

    if (action.potAfter != null) {
      pot = action.potAfter;
    } else if (MONEY_ACTIONS.has(kind)) {
      pot += amount;
    } else if (kind === "return") {
      pot = Math.max(0, pot - amount);
    }

    if (isBlindPost(action)) {
      streetStartPot = pot;
    }
  }

  if (play?.kind === "deal") {
    collectStreetBets(seats);
    street = play.street;
    streetStartPot = pot;
  }

  const atEnd =
    playback.length > 0 && idx >= playback.length - 1 && actions.length > 0;
  const lastAction = lastActionIndex >= 0 ? actions[lastActionIndex] : null;
  const slots = assignSlots(seats.length);

  const seatFrames: SeatFrame[] = seats.map((seat, index) => {
    const slot = slots[index] ?? { x: TABLE_OVAL.cx, y: TABLE_OVAL.cy + TABLE_OVAL.ry };
    const chips = towardCenter(slot.x, slot.y);
    const reveal =
      seat.player.isHero ||
      atEnd ||
      street === "showdown" ||
      (lastAction?.actionType.toLowerCase() === "show" &&
        lastAction.actorName === seat.player.name);
    const cards = seat.holeCards.length
      ? [seat.holeCards[0] ?? null, seat.holeCards[1] ?? null]
      : [null, null];
    const position =
      abbreviatePosition(seat.player.position) ||
      (seat.player.seat != null ? `S${seat.player.seat}` : "");
    return {
      key: playerKey(seat.player, index),
      seat: seat.player.seat,
      name: seat.player.isHero
        ? "Hero"
        : seat.player.name ||
          (seat.player.seat != null ? `Seat ${seat.player.seat}` : "Player"),
      position,
      stack: seat.stack,
      stackLabel: `$${formatMoney(seat.stack)}`,
      streetBet: seat.streetBet,
      folded: seat.folded,
      allIn: seat.allIn,
      isHero: seat.player.isHero,
      isDealer: false,
      isActing: Boolean(
        play?.kind === "action" &&
          lastAction &&
          ((lastAction.actorSeat != null && lastAction.actorSeat === seat.player.seat) ||
            lastAction.actorName === seat.player.name),
      ),
      cards,
      faceDown: !reveal || seat.holeCards.length === 0,
      chipBucket:
        seat.streetBet > 0
          ? chipBucketForAmount(seat.streetBet, bigBlind)
          : null,
      x: slot.x,
      y: slot.y,
      chipX: chips.x,
      chipY: chips.y,
    };
  });

  return {
    street,
    streetLabel: streetLabel(street),
    board: boardForStreet(street, boardCards, atEnd),
    pot,
    potLabel: `$${formatMoney(pot)}`,
    streetStartPot,
    bigBlind,
    seats: seatFrames,
    lastActionIndex,
    lastActionLabel: play?.label ?? "Start of hand",
    playbackKind: play?.kind ?? "start",
  };
}

export function formatActionLine(action: ReplayAction): string {
  return `${streetLabel(action.street)} · ${actionLabel(action)}`;
}
