/** Dev check: apply computeFrame to a parsed JSON hand (no Tauri). */
import { readFileSync } from "node:fs";
import { computeFrame } from "../src/lib/replay.ts";
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
const step = flopBet + 1;
const frame = computeFrame(hand, step);
const betting = frame.seats.filter((s) => s.streetBet > 0);
console.log("step", step, frame.streetLabel, "board", frame.board, "pot", frame.potLabel);
console.log(
  "chips",
  betting.map((s) => `${s.name} ${s.streetBet} ${s.chipBucket} @ ${s.chipX.toFixed(0)},${s.chipY.toFixed(0)}`),
);
console.log("hero cards", frame.seats.find((s) => s.isHero)?.cards);
if (betting.length === 0) {
  throw new Error("Expected chips in front of a betting player on the flop bet");
}
if (!frame.board[0]) {
  throw new Error("Expected flop cards");
}
console.log("ok");
