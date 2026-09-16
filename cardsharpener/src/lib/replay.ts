import { parseCardCodes } from "./assets";
import type {
  ChipSize,
  HandReplay,
  ReplayAction,
  ReplayPlayer,
} from "../types/poker";

/** Existing oval seat percentages — keep the current table layout. */
export const TABLE_SLOTS: { x: number; y: number }[] = [
  { x: 50, y: 88 },
  { x: 18, y: 65 },
  { x: 18, y: 35 },
  { x: 35, y: 18 },
  { x: 65, y: 18 },
  { x: 82, y: 35 },
  { x: 82, y: 65 },
];

export interface SeatFrame {
  key: string;
  seat: number | null;
  name: string;
  position: string;
  stackLabel: string;
  streetBet: number;
  folded: boolean;
  allIn: boolean;
  isHero: boolean;
  isActing: boolean;
  cards: (string | null)[];
  faceDown: boolean;
  chipSize: ChipSize | null;
  x: number;
  y: number;
  chipX: number;
  chipY: number;
}

export interface ReplayFrame {
  street: string;
  streetLabel: string;
  board: (string | null)[];
  pot: number;
  potLabel: string;
  seats: SeatFrame[];
  lastActionIndex: number;
  lastActionLabel: string;
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

function chipSizeFor(amount: number, bigBlind: number, allIn: boolean): ChipSize {
  if (allIn) return "big";
  const bb = bigBlind > 0 ? amount / bigBlind : amount;
  if (bb >= 20) return "big";
  if (bb >= 5) return "medium";
  return "small";
}

function towardCenter(x: number, y: number, t = 0.36): { x: number; y: number } {
  return {
    x: x + (50 - x) * t,
    y: y + (50 - y) * t,
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
  if (count >= TABLE_SLOTS.length) return TABLE_SLOTS.slice();
  if (count === TABLE_SLOTS.length - 1) {
    return TABLE_SLOTS.slice(0, count);
  }
  const picked = [TABLE_SLOTS[0]];
  const rest = TABLE_SLOTS.slice(1);
  for (let i = 0; i < count - 1; i += 1) {
    const idx = Math.round((i * (rest.length - 1)) / Math.max(1, count - 2));
    picked.push(rest[Math.min(idx, rest.length - 1)]);
  }
  return picked;
}

/**
 * `step` is the number of actions applied: 0 = start, actions.length = end.
 */
export function computeFrame(hand: HandReplay, step: number): ReplayFrame {
  const actions = hand.actions;
  const clamped = Math.max(0, Math.min(step, actions.length));
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
  let lastActionIndex = -1;

  for (let i = 0; i < clamped; i += 1) {
    const action = actions[i];
    const nextStreet = (action.street || street).toLowerCase();
    if (STREET_RESET.has(nextStreet) && nextStreet !== street) {
      collectStreetBets(seats);
    }
    street = nextStreet;
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
  }

  const atEnd = clamped >= actions.length && actions.length > 0;
  const lastAction = lastActionIndex >= 0 ? actions[lastActionIndex] : null;
  const slots = assignSlots(seats.length);

  const seatFrames: SeatFrame[] = seats.map((seat, index) => {
    const slot = slots[index] ?? TABLE_SLOTS[0];
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
    return {
      key: playerKey(seat.player, index),
      seat: seat.player.seat,
      name: seat.player.isHero
        ? "Hero"
        : seat.player.name ||
          (seat.player.seat != null ? `Seat ${seat.player.seat}` : "Player"),
      position: seat.player.position || "",
      stackLabel: `$${formatMoney(seat.stack)}`,
      streetBet: seat.streetBet,
      folded: seat.folded,
      allIn: seat.allIn,
      isHero: seat.player.isHero,
      isActing: Boolean(
        lastAction &&
          ((lastAction.actorSeat != null && lastAction.actorSeat === seat.player.seat) ||
            lastAction.actorName === seat.player.name),
      ),
      cards,
      faceDown: !reveal || seat.holeCards.length === 0,
      chipSize:
        seat.streetBet > 0
          ? chipSizeFor(seat.streetBet, bigBlind, seat.allIn)
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
    seats: seatFrames,
    lastActionIndex,
    lastActionLabel: lastAction ? actionLabel(lastAction) : "Start of hand",
  };
}

export function formatActionLine(action: ReplayAction): string {
  return `${streetLabel(action.street)} · ${actionLabel(action)}`;
}
