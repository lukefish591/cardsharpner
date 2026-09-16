//! Hero stats from imported SQLite rows — gathered data only.
//!
//! Mirrors the Streamlit overview / results / position / stakes reports.
//! No GTO, theory, or range-chart baselines.

use crate::db::{initialize, open_connection};
use serde::Serialize;
use std::collections::HashMap;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandStatRow {
  pub id: i64,
  pub played_at: Option<String>,
  pub stakes: String,
  pub position: String,
  pub pot_type: String,
  pub hero_net: f64,
  pub rake: f64,
  pub net_before_rake: f64,
  pub vpip: bool,
  pub preflop_raised: bool,
  pub preflop_called: bool,
  pub three_bet: bool,
  pub three_bet_opportunity: bool,
  pub four_bet: bool,
  pub four_bet_opportunity: bool,
  pub saw_flop: bool,
  pub won_when_saw_flop: bool,
  pub went_to_showdown: bool,
  pub won_at_showdown: bool,
  pub cbet_flop: bool,
  pub cbet_turn: bool,
  pub cbet_river: bool,
  pub cbet_flop_opportunity: bool,
  pub cbet_turn_opportunity: bool,
  pub cbet_river_opportunity: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeroStatsPayload {
  pub hand_count: i64,
  pub positions: Vec<String>,
  pub stakes: Vec<String>,
  pub pot_types: Vec<String>,
  pub rows: Vec<HandStatRow>,
}

struct HandLoad {
  id: i64,
  played_at: Option<String>,
  stakes: Option<String>,
  hero_name: Option<String>,
  hero_net: Option<f64>,
  raw_text: Option<String>,
  board_cards: Option<String>,
}

struct ActionLoad {
  street: String,
  actor_name: Option<String>,
  action_type: String,
}

pub fn hero_stats(app: &AppHandle) -> Result<HeroStatsPayload, String> {
  initialize(app)?;
  let conn = open_connection(app)?;

  let mut hand_stmt = conn
    .prepare(
      "SELECT id, played_at, stakes, hero_name, hero_net, raw_text, board_cards
       FROM hands
       ORDER BY COALESCE(played_at, imported_at) ASC, id ASC",
    )
    .map_err(|e| format!("Failed to prepare stats hands: {e}"))?;
  let hand_rows = hand_stmt
    .query_map([], |row| {
      Ok(HandLoad {
        id: row.get(0)?,
        played_at: row.get(1)?,
        stakes: row.get(2)?,
        hero_name: row.get(3)?,
        hero_net: row.get(4)?,
        raw_text: row.get(5)?,
        board_cards: row.get(6)?,
      })
    })
    .map_err(|e| format!("Failed to query stats hands: {e}"))?;

  let mut hands = Vec::new();
  for row in hand_rows {
    hands.push(row.map_err(|e| format!("Failed to read stats hand: {e}"))?);
  }

  let mut pos_stmt = conn
    .prepare("SELECT hand_id, position FROM players WHERE is_hero = 1")
    .map_err(|e| format!("Failed to prepare hero positions: {e}"))?;
  let pos_rows = pos_stmt
    .query_map([], |row| {
      Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?))
    })
    .map_err(|e| format!("Failed to query hero positions: {e}"))?;
  let mut positions_by_hand: HashMap<i64, String> = HashMap::new();
  for row in pos_rows {
    let (hand_id, position) = row.map_err(|e| format!("Failed to read hero position: {e}"))?;
    if let Some(position) = position.filter(|s| !s.trim().is_empty()) {
      positions_by_hand.insert(hand_id, position);
    }
  }

  let mut act_stmt = conn
    .prepare(
      "SELECT hand_id, street, actor_name, action_type
       FROM actions
       ORDER BY hand_id ASC, seq ASC, id ASC",
    )
    .map_err(|e| format!("Failed to prepare stats actions: {e}"))?;
  let act_rows = act_stmt
    .query_map([], |row| {
      Ok((
        row.get::<_, i64>(0)?,
        ActionLoad {
          street: row.get(1)?,
          actor_name: row.get(2)?,
          action_type: row.get(3)?,
        },
      ))
    })
    .map_err(|e| format!("Failed to query stats actions: {e}"))?;
  let mut actions_by_hand: HashMap<i64, Vec<ActionLoad>> = HashMap::new();
  for row in act_rows {
    let (hand_id, action) = row.map_err(|e| format!("Failed to read stats action: {e}"))?;
    actions_by_hand.entry(hand_id).or_default().push(action);
  }

  let mut rows = Vec::with_capacity(hands.len());
  for hand in &hands {
    let actions = actions_by_hand.get(&hand.id).map(Vec::as_slice).unwrap_or(&[]);
    let position = positions_by_hand
      .get(&hand.id)
      .cloned()
      .unwrap_or_else(|| "Unknown".into());
    rows.push(classify_hand(hand, &position, actions));
  }

  let mut positions: Vec<String> = unique_sorted(rows.iter().map(|r| r.position.clone()));
  positions.sort_by_key(|p| position_sort_key(p));
  let stakes = unique_sorted(rows.iter().map(|r| r.stakes.clone()));
  let pot_types = ordered_pot_types(rows.iter().map(|r| r.pot_type.clone()));

  Ok(HeroStatsPayload {
    hand_count: rows.len() as i64,
    positions,
    stakes,
    pot_types,
    rows,
  })
}

fn classify_hand(hand: &HandLoad, position: &str, actions: &[ActionLoad]) -> HandStatRow {
  let hero_name = hand.hero_name.as_deref().unwrap_or("Hero");
  let hero_net = hand.hero_net.unwrap_or(0.0);
  let raw = hand.raw_text.as_deref().unwrap_or("");
  let board_count = count_board_cards(hand.board_cards.as_deref().unwrap_or(""));

  let mut vpip = false;
  let mut preflop_raised = false;
  let mut preflop_called = false;
  let mut three_bet = false;
  let mut three_bet_opportunity = false;
  let mut four_bet = false;
  let mut four_bet_opportunity = false;
  let mut hero_folded_preflop = false;
  let mut hero_folded = false;
  let mut hero_showed = false;
  let mut hero_postflop_action = false;
  let mut preflop_raises = 0i32;
  let mut last_aggressor = ["", "", "", ""]; // preflop, flop, turn, river
  let mut first_bet_made = [false, false, false]; // flop, turn, river
  let mut cbet = [false, false, false];
  let mut cbet_opp = [false, false, false];
  let mut street_seen = [false, false, false];

  for action in actions {
    let street = norm_street(&action.street);
    let kind = action.action_type.trim().to_ascii_lowercase();
    let hero = is_hero_actor(action.actor_name.as_deref(), hero_name);
    let street_idx = street_index(street);

    if street == "flop" && !street_seen[0] {
      street_seen[0] = true;
      cbet_opp[0] = last_aggressor[0] == "hero";
    } else if street == "turn" && !street_seen[1] {
      street_seen[1] = true;
      cbet_opp[1] = last_aggressor[1] == "hero";
    } else if street == "river" && !street_seen[2] {
      street_seen[2] = true;
      cbet_opp[2] = last_aggressor[2] == "hero";
    }

    if hero && street != "preflop" && street != "unknown" {
      hero_postflop_action = true;
    }
    if hero && kind == "fold" {
      hero_folded = true;
      if street == "preflop" {
        hero_folded_preflop = true;
      }
    }
    if hero && (kind == "show" || kind == "shows" || kind == "showed") {
      hero_showed = true;
    }

    let is_raise = kind == "raise";
    let is_bet = kind == "bet" || kind == "all-in";
    let is_call = kind == "call";

    if street == "preflop" && hero {
      if is_call {
        preflop_called = true;
        vpip = true;
      }
      if is_raise || (kind == "bet") {
        vpip = true;
      }
      if is_raise {
        preflop_raised = true;
        if preflop_raises == 1 {
          three_bet = true;
        } else if preflop_raises == 2 {
          four_bet = true;
        }
        preflop_raises += 1;
        last_aggressor[0] = "hero";
      }
    } else if street == "preflop" && !hero && is_raise {
      preflop_raises += 1;
      if preflop_raises == 1 {
        three_bet_opportunity = true;
      } else if preflop_raises == 2 {
        four_bet_opportunity = true;
      }
      last_aggressor[0] = "villain";
    }

    if street_idx >= 1 && street_idx <= 3 {
      let post_idx = (street_idx - 1) as usize;
      if is_bet {
        if !first_bet_made[post_idx] {
          if hero && cbet_opp[post_idx] && kind == "bet" {
            cbet[post_idx] = true;
          }
          first_bet_made[post_idx] = true;
        }
        if let Some(slot) = last_aggressor.get_mut(street_idx) {
          *slot = if hero { "hero" } else { "villain" };
        }
      } else if is_raise {
        if let Some(slot) = last_aggressor.get_mut(street_idx) {
          *slot = if hero { "hero" } else { "villain" };
        }
      }
    }
  }

  // Streets can exist (board dealt) with no stored street actions.
  if board_count >= 3 && !street_seen[0] {
    cbet_opp[0] = last_aggressor[0] == "hero";
  }
  if board_count >= 4 && !street_seen[1] {
    cbet_opp[1] = last_aggressor[1] == "hero";
  }
  if board_count >= 5 && !street_seen[2] {
    cbet_opp[2] = last_aggressor[2] == "hero";
  }

  let saw_flop = hero_postflop_action || (!hero_folded_preflop && board_count >= 3);
  let hero_showed_raw = hero_showed_in_text(raw);
  let show_count = count_show_lines(raw);
  // Match the web parser: showdown is cards shown, not merely a river.
  let went_to_showdown =
    hero_showed || hero_showed_raw || (!hero_folded && show_count >= 1);
  let won_at_showdown = went_to_showdown && hero_net > 0.0;
  let won_when_saw_flop = saw_flop && hero_net > 0.0;

  let (rake_taken, _) = extract_rake_info(raw);
  let rake = if hero_net > 0.0 { rake_taken } else { 0.0 };
  let net_before_rake = hero_net + rake;

  let pot_type = if !saw_flop {
    "Preflop Only".into()
  } else if preflop_raises == 0 {
    "Limped Pot".into()
  } else if preflop_raises == 1 {
    "SRP".into()
  } else if preflop_raises == 2 {
    "3-Bet Pot".into()
  } else if preflop_raises == 3 {
    "4-Bet Pot".into()
  } else {
    "5+ Bet Pot".into()
  };

  HandStatRow {
    id: hand.id,
    played_at: hand.played_at.clone(),
    stakes: hand
      .stakes
      .as_deref()
      .map(str::trim)
      .filter(|s| !s.is_empty())
      .unwrap_or("Unknown")
      .to_string(),
    position: position.to_string(),
    pot_type,
    hero_net,
    rake,
    net_before_rake,
    vpip,
    preflop_raised,
    preflop_called,
    three_bet,
    three_bet_opportunity,
    four_bet,
    four_bet_opportunity,
    saw_flop,
    won_when_saw_flop,
    went_to_showdown,
    won_at_showdown,
    cbet_flop: cbet[0],
    cbet_turn: cbet[1],
    cbet_river: cbet[2],
    cbet_flop_opportunity: cbet_opp[0],
    cbet_turn_opportunity: cbet_opp[1],
    cbet_river_opportunity: cbet_opp[2],
  }
}

fn is_hero_actor(actor: Option<&str>, hero_name: &str) -> bool {
  let Some(actor) = actor else {
    return false;
  };
  let actor = actor.trim();
  if actor.is_empty() {
    return false;
  }
  actor.eq_ignore_ascii_case("hero") || actor.eq_ignore_ascii_case(hero_name.trim())
}

fn norm_street(street: &str) -> &'static str {
  let lower = street.to_ascii_lowercase();
  // Check preflop before flop — "preflop" contains "flop".
  if lower.contains("preflop") || lower.contains("hole") {
    "preflop"
  } else if lower.contains("flop") {
    "flop"
  } else if lower.contains("turn") {
    "turn"
  } else if lower.contains("river") {
    "river"
  } else if lower.contains("showdown") {
    "showdown"
  } else {
    "unknown"
  }
}

fn street_index(street: &str) -> usize {
  match street {
    "preflop" => 0,
    "flop" => 1,
    "turn" => 2,
    "river" => 3,
    _ => 99,
  }
}

fn count_board_cards(board: &str) -> usize {
  board
    .split_whitespace()
    .map(|c| c.trim_matches(|ch: char| ch == '[' || ch == ']' || ch == ',' || ch == '|'))
    .filter(|c| c.len() >= 2)
    .count()
}

fn hero_showed_in_text(raw: &str) -> bool {
  for line in raw.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() {
      continue;
    }
    let lower = trimmed.to_ascii_lowercase();
    let hero_line = lower.starts_with("hero")
      || (lower.starts_with("seat") && lower.contains("hero"));
    if hero_line && (lower.contains("shows") || lower.contains("showed")) {
      return true;
    }
  }
  false
}

fn count_show_lines(raw: &str) -> usize {
  raw.lines().filter(|line| {
    let lower = line.to_ascii_lowercase();
    lower.contains("shows") || lower.contains("showed")
  }).count()
}

fn extract_rake_info(raw: &str) -> (f64, f64) {
  let pot = labelled_amount(raw, "Total pot").unwrap_or(0.0);
  let rake = labelled_amount(raw, "Rake").unwrap_or(0.0)
    + labelled_amount(raw, "Jackpot").unwrap_or(0.0)
    + labelled_amount(raw, "Bingo").unwrap_or(0.0)
    + labelled_amount(raw, "Fortune").unwrap_or(0.0)
    + labelled_amount(raw, "Tax").unwrap_or(0.0);
  (rake, pot)
}

fn labelled_amount(raw: &str, label: &str) -> Option<f64> {
  let lower = raw.to_ascii_lowercase();
  let lab = label.to_ascii_lowercase();
  let idx = lower.find(&lab)?;
  let after = raw.get(idx + label.len()..)?;
  let after = after.trim_start().trim_start_matches(':').trim_start();
  let after = after.trim_start_matches('$').trim_start();
  let mut num = String::new();
  for ch in after.chars() {
    if ch.is_ascii_digit() || ch == '.' {
      num.push(ch);
    } else {
      break;
    }
  }
  if num.is_empty() {
    None
  } else {
    num.parse().ok()
  }
}

fn unique_sorted(values: impl Iterator<Item = String>) -> Vec<String> {
  let mut out: Vec<String> = values.filter(|s| !s.is_empty()).collect();
  out.sort();
  out.dedup();
  out
}

fn ordered_pot_types(values: impl Iterator<Item = String>) -> Vec<String> {
  const ORDER: [&str; 6] = [
    "Preflop Only",
    "Limped Pot",
    "SRP",
    "3-Bet Pot",
    "4-Bet Pot",
    "5+ Bet Pot",
  ];
  let present: std::collections::HashSet<String> = values.collect();
  let mut out: Vec<String> = ORDER
    .iter()
    .filter(|name| present.contains(&name.to_string()))
    .map(|s| (*s).to_string())
    .collect();
  let extras: Vec<String> = present
    .into_iter()
    .filter(|name| !ORDER.contains(&name.as_str()))
    .collect();
  let mut extras = extras;
  extras.sort();
  out.extend(extras);
  out
}

fn position_sort_key(position: &str) -> usize {
  match position {
    "UTG" => 0,
    "UTG+1" => 1,
    "UTG+2" => 2,
    "Hijack" | "HJ" => 3,
    "Cutoff" | "CO" => 4,
    "Button" | "BTN" => 5,
    "Small Blind" | "SB" => 6,
    "Big Blind" | "BB" => 7,
    _ => 50,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn act(street: &str, name: &str, kind: &str) -> ActionLoad {
    ActionLoad {
      street: street.into(),
      actor_name: Some(name.into()),
      action_type: kind.into(),
    }
  }

  fn hand(net: f64, board: &str, raw: &str) -> HandLoad {
    HandLoad {
      id: 1,
      played_at: None,
      stakes: Some("$0.05/$0.10".into()),
      hero_name: Some("Hero".into()),
      hero_net: Some(net),
      raw_text: Some(raw.into()),
      board_cards: Some(board.into()),
    }
  }

  #[test]
  fn three_bet_when_hero_raises_over_open() {
    let actions = [
      act("preflop", "UTG", "raise"),
      act("preflop", "Hero", "raise"),
    ];
    let row = classify_hand(&hand(-1.0, "", ""), "Button", &actions);
    assert!(row.three_bet);
    assert!(row.three_bet_opportunity);
    assert!(row.preflop_raised);
    assert!(row.vpip);
    assert_eq!(row.pot_type, "Preflop Only");
  }

  #[test]
  fn cbet_flop_when_hero_opened() {
    let actions = [
      act("preflop", "Hero", "raise"),
      act("flop", "Hero", "bet"),
    ];
    let row = classify_hand(&hand(0.5, "Ah Kd 2c", "Total pot $1.00 | Rake $0.05"), "Cutoff", &actions);
    assert!(row.cbet_flop_opportunity);
    assert!(row.cbet_flop);
    assert!(row.saw_flop);
    assert!((row.rake - 0.05).abs() < f64::EPSILON);
    assert_eq!(row.pot_type, "SRP");
  }

  #[test]
  fn preflop_is_not_classified_as_flop() {
    assert_eq!(norm_street("preflop"), "preflop");
    assert_eq!(norm_street("*** FLOP ***"), "flop");
  }

  #[test]
  fn labelled_rake_parses_summary_line() {
    let (rake, pot) = extract_rake_info("Total pot $0.6 | Rake $0.03 | Jackpot $0 | Bingo $0");
    assert!((pot - 0.6).abs() < 1e-9);
    assert!((rake - 0.03).abs() < 1e-9);
  }
}
