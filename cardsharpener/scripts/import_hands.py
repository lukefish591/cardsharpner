#!/usr/bin/env python3
"""Local-only hand import bridge for the Cardsharpener Mac app.

Reads .txt/.xml files or folders, splits on ``Poker Hand #`` (same as the
existing parsers), then calls:

- ``hero_analysis_parser.HeroAnalysisParser`` for hero / stats fields
- ``hand_replayer.HandReplayer`` for players / actions / board
- ``comprehensive_parser.ComprehensiveParser`` only when replay data is missing

Prints nothing but JSON to --output (or stdout). No network. Hands stay on disk.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Keep parser INFO logs off stdout so --output - stays valid JSON.
logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
for name in ("hero_analysis_parser", "comprehensive_parser"):
    logging.getLogger(name).setLevel(logging.WARNING)

from hero_analysis_parser import HeroAnalysisParser  # noqa: E402
from hand_replayer import HandReplayer  # noqa: E402

HAND_SPLIT = re.compile(r"(?=Poker Hand #)")
TEXT_EXTS = {".txt", ".xml"}


def collect_files(paths: Iterable[str]) -> List[Path]:
    found: List[Path] = []
    for raw in paths:
        path = Path(raw).expanduser().resolve()
        if path.is_file() and path.suffix.lower() in TEXT_EXTS:
            found.append(path)
        elif path.is_dir():
            for ext in TEXT_EXTS:
                found.extend(p for p in path.rglob(f"*{ext}") if p.is_file())
    unique = sorted(set(found))
    return unique


def split_hands(text: str) -> List[str]:
    return [chunk.strip() for chunk in HAND_SPLIT.split(text) if chunk.strip()]


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if value is None:
        return None
    return str(value)


def _join_cards(cards: Any) -> str:
    if not cards:
        return ""
    if isinstance(cards, str):
        return cards
    return " ".join(str(c) for c in cards if c)


def _hero_from_replay(replay: Any) -> Any:
    if replay is None:
        return None
    return next((p for p in replay.players if p.is_hero), None)


def _replay_players(replay: Any) -> List[Dict[str, Any]]:
    if replay is None:
        return []
    rows = []
    for player in replay.players:
        rows.append(
            {
                "seat": player.seat,
                "name": player.name,
                "position": player.position,
                "starting_stack": player.stack,
                "is_hero": bool(player.is_hero),
                "hole_cards": _join_cards(player.hole_cards),
            }
        )
    return rows


def _replay_actions(replay: Any) -> List[Dict[str, Any]]:
    if replay is None:
        return []
    rows = []
    for action in replay.actions:
        desc = (action.description or "").lower()
        rows.append(
            {
                "seq": action.action_number,
                "street": action.street,
                "actor_seat": action.seat,
                "actor_name": action.player,
                "action_type": action.action_type,
                "amount": action.amount,
                "is_all_in": "all-in" in desc or "all in" in desc,
                "pot_after": action.pot_after,
            }
        )
    return rows


def _comprehensive_players(hand: Any) -> List[Dict[str, Any]]:
    rows = []
    for player in hand.players:
        rows.append(
            {
                "seat": player.seat,
                "name": player.name,
                "position": player.position,
                "starting_stack": player.starting_stack,
                "is_hero": bool(player.is_hero),
                "hole_cards": _join_cards(player.hole_cards),
            }
        )
    return rows


def _comprehensive_actions(hand: Any) -> List[Dict[str, Any]]:
    rows = []
    for idx, action in enumerate(hand.actions, start=1):
        rows.append(
            {
                "seq": action.timestamp or idx,
                "street": action.street,
                "actor_seat": None,
                "actor_name": action.player,
                "action_type": action.action_type,
                "amount": action.amount,
                "is_all_in": action.action_type == "all-in",
                "pot_after": action.pot_after,
            }
        )
    return rows


def _try_comprehensive(hand_text: str) -> Any:
    try:
        from comprehensive_parser import ComprehensiveParser

        return ComprehensiveParser().parse_hand_comprehensive(hand_text)
    except Exception as exc:  # noqa: BLE001 — keep import going
        logging.getLogger(__name__).warning("comprehensive_parser fallback failed: %s", exc)
        return None


def parse_chunk(hand_text: str, source_path: str) -> Optional[Dict[str, Any]]:
    hero_parser = parse_chunk.hero_parser  # type: ignore[attr-defined]
    replayer = parse_chunk.replayer  # type: ignore[attr-defined]

    hero = None
    try:
        hero = hero_parser.parse_hand(hand_text)
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("hero parser failed: %s", exc)

    if hero is not None and not getattr(hero, "hand_id", ""):
        hero = None

    replay = None
    try:
        replay = replayer.parse_hand_for_replay(hand_text)
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("replayer failed: %s", exc)

    players = _replay_players(replay)
    actions = _replay_actions(replay)
    comprehensive = None
    if not players:
        comprehensive = _try_comprehensive(hand_text)
        if comprehensive is not None:
            players = _comprehensive_players(comprehensive)
            if not actions:
                actions = _comprehensive_actions(comprehensive)

    if hero is None and replay is None and comprehensive is None:
        return None

    replay_hero = _hero_from_replay(replay)
    board = ""
    if replay is not None:
        board = _join_cards(replay.board_cards)
    elif hero is not None:
        board = " ".join(
            part
            for part in (
                _join_cards(hero.flop_cards),
                hero.turn_card,
                hero.river_card,
            )
            if part
        )
    elif comprehensive is not None:
        board = _join_cards(comprehensive.board_cards)

    hero_seat = None
    if replay_hero is not None:
        hero_seat = replay_hero.seat
    elif comprehensive is not None:
        hero_seat = comprehensive.hero_seat

    hero_cards = ""
    if hero is not None:
        hero_cards = _join_cards(hero.hole_cards)
    elif replay_hero is not None:
        hero_cards = _join_cards(replay_hero.hole_cards)
    elif comprehensive is not None:
        hero_cards = _join_cards(comprehensive.hero_hole_cards)

    pot_total = None
    if hero is not None and hero.total_pot_size:
        pot_total = hero.total_pot_size
    elif replay is not None:
        pot_total = replay.final_pot
    elif comprehensive is not None:
        pot_total = comprehensive.pot_size

    return {
        "external_hand_id": (hero.hand_id if hero else None)
        or (replay.hand_id if replay else None)
        or (comprehensive.hand_id if comprehensive else None)
        or "",
        "site": (hero.site if hero else None)
        or (comprehensive.site if comprehensive else None)
        or "Unknown",
        "played_at": _iso(hero.timestamp if hero else None)
        or _iso(replay.timestamp if replay else None)
        or _iso(comprehensive.timestamp if comprehensive else None),
        "stakes": (hero.stakes if hero else None)
        or (replay.stakes if replay else None)
        or (comprehensive.stakes if comprehensive else None)
        or "",
        "table_name": (hero.table_name if hero else None)
        or (replay.table_name if replay else None)
        or (comprehensive.table_name if comprehensive else None)
        or "",
        "hero_seat": hero_seat,
        "hero_name": "Hero",
        "hero_cards": hero_cards,
        "board_cards": board,
        "pot_total": pot_total,
        "hero_net": hero.net_profit if hero is not None else None,
        "raw_text": (hero.raw_text if hero and hero.raw_text else hand_text.strip()),
        "source_path": source_path,
        "players": players,
        "actions": actions,
    }


parse_chunk.hero_parser = HeroAnalysisParser()
parse_chunk.replayer = HandReplayer()


def parse_paths(paths: List[str]) -> Dict[str, Any]:
    files = collect_files(paths)
    hands: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []

    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            errors.append({"source_path": str(path), "message": str(exc)})
            continue

        chunks = split_hands(text)
        if not chunks:
            errors.append(
                {"source_path": str(path), "message": "No 'Poker Hand #' blocks found"}
            )
            continue

        for chunk in chunks:
            try:
                parsed = parse_chunk(chunk, str(path))
                if parsed is None:
                    errors.append(
                        {
                            "source_path": str(path),
                            "message": "Parsers returned no data for a hand block",
                        }
                    )
                    continue
                hands.append(parsed)
            except Exception as exc:  # noqa: BLE001
                errors.append({"source_path": str(path), "message": str(exc)})

    return {
        "files": [str(p) for p in files],
        "hands": hands,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse local poker hand histories to JSON")
    parser.add_argument("paths", nargs="+", help="Hand history files or folders")
    parser.add_argument(
        "--output",
        default="-",
        help="Write JSON here, or - for stdout",
    )
    args = parser.parse_args()

    payload = parse_paths(args.paths)
    encoded = json.dumps(payload, ensure_ascii=False)

    if args.output == "-":
        sys.stdout.write(encoded)
        if not encoded.endswith("\n"):
            sys.stdout.write("\n")
    else:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(encoded, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
