/** Dev check: apply computeFrame to a parsed JSON hand (no Tauri). */
import { readFileSync } from "node:fs";
import { buildPlayback, computeFrame } from "../src/lib/replay.ts";
import type { HandReplay, ReplayAction, ReplayPlayer } from "../src/types/poker.ts";

const raw = JSON.parse(readFileSync(process.argv[2] ?? "/tmp/cs-test-hand.json", "utf8"));
const parsed = raw.hands[0];

const hand: HandReplay = {
  id: 1,
  externalHandId: parsed.external_hand_id,
  stakes: parsed.stakes,
  heroCards: parsed.hero_cards,
  boardCards: parsed.board_cards,
  rawText: parsed.raw_text,
  players: parsed.players.map(
    (p: {
      seat: number;
      name: string;
      position: string;
      starting_stack: number;
      is_hero: boolean;
      hole_cards: string;
    }): ReplayPlayer => ({
      seat: p.seat,
      name: p.name,
      position: p.position,
      startingStack: p.starting_stack,
      isHero: p.is_hero,
      holeCards: p.hole_cards,
    }),
  ),
  actions: parsed.actions.map(
    (a: {
      seq: number;
      street: string;
      actor_seat: number;
      actor_name: string;
      action_type: string;
      amount: number;
      is_all_in: boolean;
      pot_after: number;
    }, i: number): ReplayAction => ({
      id: i + 1,
      seq: a.seq,
      street: a.street,
      actorSeat: a.actor_seat,
      actorName: a.actor_name,
      actionType: a.action_type,
      amount: a.amount,
      isAllIn: a.is_all_in,
      potAfter: a.pot_after,
    }),
  ),
};

const flopBet = hand.actions.findIndex(
  (a) => a.street === "flop" && a.actionType === "bet",
);
const playback = buildPlayback(hand);
const postSteps = playback.filter((s) => {
  if (s.actionIndex == null) return false;
  return hand.actions[s.actionIndex]?.actionType.toLowerCase() === "post";
});
const dealStep = playback.findIndex((s) => s.kind === "deal" && s.street === "flop");
const flopAction = playback.findIndex(
  (s) => s.kind === "action" && s.applyThrough === flopBet,
);
const start = computeFrame(hand, 0);
const deal = dealStep >= 0 ? computeFrame(hand, dealStep) : null;
const action = computeFrame(hand, flopAction < 0 ? 0 : flopAction);
const betting = action.seats.filter((s) => s.streetBet > 0);

console.log(
  "playback",
  playback.map((s, i) => `${i}:${s.kind}:${s.street}:${s.label}`).join(" | "),
);
console.log("start pot", start.pot, "streetStart", start.streetStartPot, "board", start.board);
if (deal) {
  console.log(
    "deal pot",
    deal.pot,
    "streetStart",
    deal.streetStartPot,
    "board",
    deal.board,
    "streetBets",
    deal.seats.filter((s) => s.streetBet > 0).length,
  );
}
console.log(
  "flop bet pot",
  action.pot,
  "streetStart",
  action.streetStartPot,
  "board",
  action.board,
);
console.log(
  "chips",
  betting.map((s) => `${s.name} ${s.streetBet} ${s.chipBucket} @ ${s.chipX.toFixed(0)},${s.chipY.toFixed(0)}`),
);
console.log("hero cards", action.seats.find((s) => s.isHero)?.cards);

if (postSteps.length > 0) {
  throw new Error("Blind posts must not appear as playback steps");
}
if (dealStep < 0) {
  throw new Error("Expected a dedicated flop deal step");
}
if (!deal?.board[0]) {
  throw new Error("Expected flop cards on the deal step");
}
if (deal.seats.some((s) => s.streetBet > 0)) {
  throw new Error("Deal step must show the board before street action");
}
if (deal.streetStartPot !== deal.pot) {
  throw new Error("Deal step: street-start pot should equal total (no street action yet)");
}
if (betting.length === 0) {
  throw new Error("Expected chips in front of a betting player on the flop bet");
}
if (action.pot <= action.streetStartPot) {
  throw new Error("Flop bet should grow total pot while street-start stays frozen");
}
if (action.streetStartPot !== deal.streetStartPot) {
  throw new Error("Street-start pot must stay frozen after the flop deal");
}
if (start.seats.some((s) => s.isDealer)) {
  throw new Error("Dealer button must stay off");
}
console.log("ok");
