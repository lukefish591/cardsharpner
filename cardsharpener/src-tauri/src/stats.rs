//! Hero stats from imported SQLite rows — gathered data only.
//!
//! Flags are materialized into `hand_stats` at import (and startup backfill).
//! Live queries use SQL aggregates and never SELECT `raw_text`.
//! No GTO, theory, or range-chart baselines.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsFilter {
  #[serde(default)]
  pub position: String,
  #[serde(default)]
  pub stakes: String,
  #[serde(default)]
  pub pot_type: String,
  #[serde(default)]
  pub date_from: String,
  #[serde(default)]
  pub date_to: String,
  #[serde(default)]
  pub exclude_rake: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsOverview {
  pub db_hand_count: i64,
  pub filtered_hands: i64,
  pub total_profit: f64,
  pub total_profit_before_rake: f64,
  pub total_rake: f64,
  pub avg_profit: f64,
  pub avg_profit_before_rake: f64,
  pub avg_rake: f64,
  pub positions: Vec<String>,
  pub stakes: Vec<String>,
  pub pot_types: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsPlaystyle {
  pub vpip_rate: f64,
  pub preflop_raise_rate: f64,
  pub three_bet_rate: f64,
  pub four_bet_rate: f64,
  pub flop_rate: f64,
  pub flop_win_rate: f64,
  pub showdown_rate: f64,
  pub won_at_showdown_rate: f64,
  pub cbet_flop_rate: f64,
  pub cbet_turn_rate: f64,
  pub cbet_river_rate: f64,
  pub showdown_hands: i64,
  pub showdown_profit: f64,
  pub non_showdown_hands: i64,
  pub non_showdown_profit: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurvePoint {
  pub hand_number: i64,
  pub total: f64,
  pub showdown: f64,
  pub non_showdown: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EquityCurvePayload {
  pub points: Vec<CurvePoint>,
  pub sampled_from: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakdownRow {
  pub key: String,
  pub hands: i64,
  pub total_profit: f64,
  pub avg_profit: f64,
  pub profit_bb: Option<f64>,
  pub showdown_rate: f64,
  pub flop_win_rate: f64,
  pub preflop_raise_rate: f64,
  pub cbet_rate: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsBreakdowns {
  pub by_position: Vec<BreakdownRow>,
  pub by_stakes: Vec<BreakdownRow>,
}

pub(crate) struct HandLoad {
  pub id: i64,
  pub played_at: Option<String>,
  pub stakes: Option<String>,
  pub hero_name: Option<String>,
  pub hero_net: Option<f64>,
  pub raw_text: Option<String>,
  pub board_cards: Option<String>,
}

pub(crate) struct ActionLoad {
  pub street: String,
  pub actor_name: Option<String>,
  pub action_type: String,
}

const CURVE_TARGET: usize = 600;

fn filter_tuple(filter: &StatsFilter) -> (String, String, String, String, String) {
  let date_from = filter.date_from.trim().to_string();
  let date_to = if filter.date_to.trim().is_empty() {
    String::new()
  } else {
    format!("{}z", filter.date_to.trim())
  };
  (
    filter.position.trim().to_string(),
    filter.stakes.trim().to_string(),
    filter.pot_type.trim().to_string(),
    date_from,
    date_to,
  )
}

const FILTER_SQL: &str = "
  (?1 = '' OR position = ?1)
  AND (?2 = '' OR stakes = ?2)
  AND (?3 = '' OR pot_type = ?3)
  AND (?4 = '' OR COALESCE(played_at, '') >= ?4)
  AND (?5 = '' OR COALESCE(played_at, '') <= ?5)
";

fn profit_sql(filter: &StatsFilter) -> &'static str {
  if filter.exclude_rake {
    "net_before_rake"
  } else {
    "hero_net"
  }
}

fn rate(numer: f64, denom: f64) -> f64 {
  if denom > 0.0 {
    (numer / denom) * 100.0
  } else {
    0.0
  }
}

pub(crate) fn insert_row(conn: &Connection, row: &HandStatRow) -> Result<(), String> {
  conn
    .execute(
      "INSERT OR REPLACE INTO hand_stats (
         hand_id, played_at, stakes, position, pot_type,
         hero_net, rake, net_before_rake,
         vpip, preflop_raised, preflop_called,
         three_bet, three_bet_opportunity,
         four_bet, four_bet_opportunity,
         saw_flop, won_when_saw_flop,
         went_to_showdown, won_at_showdown,
         cbet_flop, cbet_turn, cbet_river,
         cbet_flop_opportunity, cbet_turn_opportunity, cbet_river_opportunity
       ) VALUES (
         ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
         ?9, ?10, ?11, ?12, ?13, ?14, ?15,
         ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25
       )",
      params![
        row.id,
        row.played_at,
        row.stakes,
        row.position,
        row.pot_type,
        row.hero_net,
        row.rake,
        row.net_before_rake,
        flag(row.vpip),
        flag(row.preflop_raised),
        flag(row.preflop_called),
        flag(row.three_bet),
        flag(row.three_bet_opportunity),
        flag(row.four_bet),
        flag(row.four_bet_opportunity),
        flag(row.saw_flop),
        flag(row.won_when_saw_flop),
        flag(row.went_to_showdown),
        flag(row.won_at_showdown),
        flag(row.cbet_flop),
        flag(row.cbet_turn),
        flag(row.cbet_river),
        flag(row.cbet_flop_opportunity),
        flag(row.cbet_turn_opportunity),
        flag(row.cbet_river_opportunity),
      ],
    )
    .map_err(|e| format!("Failed to write hand_stats for {}: {e}", row.id))?;
  Ok(())
}

fn flag(value: bool) -> i64 {
  if value {
    1
  } else {
    0
  }
}

/// One-time (or leftover) classify pass. Loads `raw_text` only for hands missing stats.
pub fn backfill_missing(conn: &mut Connection) -> Result<i64, String> {
  let pending: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM hands h
       LEFT JOIN hand_stats s ON s.hand_id = h.id
       WHERE s.hand_id IS NULL",
      [],
      |r| r.get(0),
    )
    .map_err(|e| format!("Failed to count pending hand_stats: {e}"))?;
  if pending == 0 {
    return Ok(0);
  }

  let mut hand_stmt = conn
    .prepare(
      "SELECT h.id, h.played_at, h.stakes, h.hero_name, h.hero_net, h.raw_text, h.board_cards
       FROM hands h
       LEFT JOIN hand_stats s ON s.hand_id = h.id
       WHERE s.hand_id IS NULL
       ORDER BY h.id ASC",
    )
    .map_err(|e| format!("Failed to prepare stats backfill: {e}"))?;
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
    .map_err(|e| format!("Failed to query backfill hands: {e}"))?;
  let mut hands = Vec::new();
  for row in hand_rows {
    hands.push(row.map_err(|e| format!("Failed to read backfill hand: {e}"))?);
  }
  drop(hand_stmt);

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
  drop(pos_stmt);

  let mut act_stmt = conn
    .prepare(
      "SELECT a.hand_id, a.street, a.actor_name, a.action_type
       FROM actions a
       LEFT JOIN hand_stats s ON s.hand_id = a.hand_id
       WHERE s.hand_id IS NULL
       ORDER BY a.hand_id ASC, a.seq ASC, a.id ASC",
    )
    .map_err(|e| format!("Failed to prepare backfill actions: {e}"))?;
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
    .map_err(|e| format!("Failed to query backfill actions: {e}"))?;
  let mut actions_by_hand: HashMap<i64, Vec<ActionLoad>> = HashMap::new();
  for row in act_rows {
    let (hand_id, action) = row.map_err(|e| format!("Failed to read backfill action: {e}"))?;
    actions_by_hand.entry(hand_id).or_default().push(action);
  }
  drop(act_stmt);

  let tx = conn
    .transaction()
    .map_err(|e| format!("Failed to start stats backfill transaction: {e}"))?;
  let mut written = 0i64;
  for hand in &hands {
    let actions = actions_by_hand
      .get(&hand.id)
      .map(Vec::as_slice)
      .unwrap_or(&[]);
    let position = positions_by_hand
      .get(&hand.id)
      .cloned()
      .unwrap_or_else(|| "Unknown".into());
    let row = classify_hand(hand, &position, actions);
    insert_row(&tx, &row)?;
    written += 1;
  }
  tx.commit()
    .map_err(|e| format!("Failed to commit stats backfill: {e}"))?;
  Ok(written)
}

pub fn ensure_stats(conn: &mut Connection) -> Result<i64, String> {
  backfill_missing(conn)
}

pub fn overview(conn: &Connection, filter: &StatsFilter) -> Result<StatsOverview, String> {
  let (position, stakes, pot_type, date_from, date_to) = filter_tuple(filter);
  let db_hand_count: i64 = conn
    .query_row("SELECT COUNT(*) FROM hands", [], |r| r.get(0))
    .map_err(|e| format!("Failed to count hands: {e}"))?;

  let sql = format!(
    "SELECT
        COUNT(*) as filtered_hands,
        COALESCE(SUM(hero_net), 0),
        COALESCE(SUM(net_before_rake), 0),
        COALESCE(SUM(rake), 0)
     FROM hand_stats
     WHERE {FILTER_SQL}"
  );
  let (filtered_hands, total_profit, total_profit_before_rake, total_rake) = conn
    .query_row(
      &sql,
      params![position, stakes, pot_type, date_from, date_to],
      |row| {
        Ok((
          row.get::<_, i64>(0)?,
          row.get::<_, f64>(1)?,
          row.get::<_, f64>(2)?,
          row.get::<_, f64>(3)?,
        ))
      },
    )
    .map_err(|e| format!("Failed to load stats overview: {e}"))?;

  let n = filtered_hands.max(1) as f64;
  let avg_denom = if filtered_hands == 0 { 1.0 } else { n };
  let (avg_profit, avg_profit_before_rake, avg_rake) = if filtered_hands == 0 {
    (0.0, 0.0, 0.0)
  } else {
    (
      total_profit / avg_denom,
      total_profit_before_rake / avg_denom,
      total_rake / avg_denom,
    )
  };

  let mut pos_stmt = conn
    .prepare("SELECT DISTINCT position FROM hand_stats WHERE position IS NOT NULL AND position != ''")
    .map_err(|e| format!("Failed to list positions: {e}"))?;
  let positions = unique_sorted(
    pos_stmt
      .query_map([], |row| row.get::<_, String>(0))
      .map_err(|e| format!("Failed to query positions: {e}"))?
      .filter_map(|r| r.ok()),
  );
  let mut positions = positions;
  positions.sort_by_key(|p| position_sort_key(p));

  let mut stakes_stmt = conn
    .prepare("SELECT DISTINCT stakes FROM hand_stats WHERE stakes IS NOT NULL AND stakes != ''")
    .map_err(|e| format!("Failed to list stakes: {e}"))?;
  let stakes_list = unique_sorted(
    stakes_stmt
      .query_map([], |row| row.get::<_, String>(0))
      .map_err(|e| format!("Failed to query stakes: {e}"))?
      .filter_map(|r| r.ok()),
  );

  let mut pot_stmt = conn
    .prepare("SELECT DISTINCT pot_type FROM hand_stats WHERE pot_type IS NOT NULL AND pot_type != ''")
    .map_err(|e| format!("Failed to list pot types: {e}"))?;
  let pot_types = ordered_pot_types(
    pot_stmt
      .query_map([], |row| row.get::<_, String>(0))
      .map_err(|e| format!("Failed to query pot types: {e}"))?
      .filter_map(|r| r.ok()),
  );

  Ok(StatsOverview {
    db_hand_count,
    filtered_hands,
    total_profit,
    total_profit_before_rake,
    total_rake,
    avg_profit,
    avg_profit_before_rake,
    avg_rake,
    positions,
    stakes: stakes_list,
    pot_types,
  })
}

pub fn playstyle(conn: &Connection, filter: &StatsFilter) -> Result<StatsPlaystyle, String> {
  let (position, stakes, pot_type, date_from, date_to) = filter_tuple(filter);
  let profit = profit_sql(filter);
  let sql = format!(
    "SELECT
        COUNT(*),
        COALESCE(SUM(vpip), 0),
        COALESCE(SUM(preflop_raised), 0),
        COALESCE(SUM(three_bet), 0),
        COALESCE(SUM(three_bet_opportunity), 0),
        COALESCE(SUM(four_bet), 0),
        COALESCE(SUM(four_bet_opportunity), 0),
        COALESCE(SUM(saw_flop), 0),
        COALESCE(SUM(won_when_saw_flop), 0),
        COALESCE(SUM(went_to_showdown), 0),
        COALESCE(SUM(won_at_showdown), 0),
        COALESCE(SUM(cbet_flop), 0),
        COALESCE(SUM(cbet_flop_opportunity), 0),
        COALESCE(SUM(cbet_turn), 0),
        COALESCE(SUM(cbet_turn_opportunity), 0),
        COALESCE(SUM(cbet_river), 0),
        COALESCE(SUM(cbet_river_opportunity), 0),
        COALESCE(SUM(CASE WHEN went_to_showdown = 1 THEN {profit} ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN went_to_showdown = 0 THEN {profit} ELSE 0 END), 0)
     FROM hand_stats
     WHERE {FILTER_SQL}"
  );
  conn
    .query_row(&sql, params![position, stakes, pot_type, date_from, date_to], |row| {
      let total: i64 = row.get(0)?;
      let vpip: i64 = row.get(1)?;
      let pfr: i64 = row.get(2)?;
      let three_bet: i64 = row.get(3)?;
      let three_opp: i64 = row.get(4)?;
      let four_bet: i64 = row.get(5)?;
      let four_opp: i64 = row.get(6)?;
      let saw_flop: i64 = row.get(7)?;
      let flop_win: i64 = row.get(8)?;
      let went_sd: i64 = row.get(9)?;
      let won_sd: i64 = row.get(10)?;
      let cbet_f: i64 = row.get(11)?;
      let cbet_f_opp: i64 = row.get(12)?;
      let cbet_t: i64 = row.get(13)?;
      let cbet_t_opp: i64 = row.get(14)?;
      let cbet_r: i64 = row.get(15)?;
      let cbet_r_opp: i64 = row.get(16)?;
      let sd_profit: f64 = row.get(17)?;
      let nsd_profit: f64 = row.get(18)?;
      Ok(StatsPlaystyle {
        vpip_rate: rate(vpip as f64, total as f64),
        preflop_raise_rate: rate(pfr as f64, total as f64),
        three_bet_rate: rate(three_bet as f64, three_opp as f64),
        four_bet_rate: rate(four_bet as f64, four_opp as f64),
        flop_rate: rate(saw_flop as f64, total as f64),
        flop_win_rate: rate(flop_win as f64, saw_flop as f64),
        showdown_rate: rate(went_sd as f64, saw_flop as f64),
        won_at_showdown_rate: rate(won_sd as f64, went_sd as f64),
        cbet_flop_rate: rate(cbet_f as f64, cbet_f_opp as f64),
        cbet_turn_rate: rate(cbet_t as f64, cbet_t_opp as f64),
        cbet_river_rate: rate(cbet_r as f64, cbet_r_opp as f64),
        showdown_hands: went_sd,
        showdown_profit: sd_profit,
        non_showdown_hands: total - went_sd,
        non_showdown_profit: nsd_profit,
      })
    })
    .map_err(|e| format!("Failed to load playstyle stats: {e}"))
}

pub fn equity_curve(conn: &Connection, filter: &StatsFilter) -> Result<EquityCurvePayload, String> {
  let (position, stakes, pot_type, date_from, date_to) = filter_tuple(filter);
  let profit = profit_sql(filter);
  let sql = format!(
    "SELECT {profit}, went_to_showdown
     FROM hand_stats
     WHERE {FILTER_SQL}
     ORDER BY COALESCE(played_at, ''), hand_id ASC"
  );
  let mut stmt = conn
    .prepare(&sql)
    .map_err(|e| format!("Failed to prepare equity curve: {e}"))?;
  let rows = stmt
    .query_map(params![position, stakes, pot_type, date_from, date_to], |row| {
      Ok((row.get::<_, f64>(0)?, row.get::<_, i64>(1)? != 0))
    })
    .map_err(|e| format!("Failed to query equity curve: {e}"))?;

  let mut total = 0.0;
  let mut showdown = 0.0;
  let mut non_showdown = 0.0;
  let mut points = Vec::new();
  for (i, row) in rows.enumerate() {
    let (net, went_sd) = row.map_err(|e| format!("Failed to read curve row: {e}"))?;
    total += net;
    if went_sd {
      showdown += net;
    } else {
      non_showdown += net;
    }
    points.push(CurvePoint {
      hand_number: (i as i64) + 1,
      total,
      showdown,
      non_showdown,
    });
  }
  let sampled_from = points.len() as i64;
  Ok(EquityCurvePayload {
    points: downsample_curve(points, CURVE_TARGET),
    sampled_from,
  })
}

pub fn downsample_curve(points: Vec<CurvePoint>, target: usize) -> Vec<CurvePoint> {
  if points.len() <= target || target < 3 {
    return points;
  }
  let last = points.len() - 1;
  let inner = target - 2;
  let mut out = Vec::with_capacity(target);
  out.push(points[0].clone());
  for i in 1..=inner {
    let idx = (i * last) / (inner + 1);
    if idx > 0 && idx < last {
      let next_num = points[idx].hand_number;
      if out.last().map(|p| p.hand_number) != Some(next_num) {
        out.push(points[idx].clone());
      }
    }
  }
  out.push(points[last].clone());
  out
}

pub fn breakdowns(conn: &Connection, filter: &StatsFilter) -> Result<StatsBreakdowns, String> {
  Ok(StatsBreakdowns {
    by_position: group_breakdown(conn, filter, "position", true)?,
    by_stakes: group_breakdown(conn, filter, "stakes", false)?,
  })
}

fn group_breakdown(
  conn: &Connection,
  filter: &StatsFilter,
  column: &str,
  sort_positions: bool,
) -> Result<Vec<BreakdownRow>, String> {
  let (position, stakes, pot_type, date_from, date_to) = filter_tuple(filter);
  if column != "position" && column != "stakes" {
    return Err("Invalid breakdown column".into());
  }
  let profit = profit_sql(filter);
  let sql = format!(
    "SELECT
        {column},
        COUNT(*),
        COALESCE(SUM({profit}), 0),
        COALESCE(SUM(went_to_showdown), 0),
        COALESCE(SUM(saw_flop), 0),
        COALESCE(SUM(won_when_saw_flop), 0),
        COALESCE(SUM(preflop_raised), 0),
        COALESCE(SUM(cbet_flop), 0),
        COALESCE(SUM(cbet_flop_opportunity), 0)
     FROM hand_stats
     WHERE {FILTER_SQL}
     GROUP BY {column}"
  );
  let mut stmt = conn
    .prepare(&sql)
    .map_err(|e| format!("Failed to prepare {column} breakdown: {e}"))?;
  let rows = stmt
    .query_map(params![position, stakes, pot_type, date_from, date_to], |row| {
      let key: String = row
        .get::<_, Option<String>>(0)?
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown".into());
      let hands: i64 = row.get(1)?;
      let total_profit: f64 = row.get(2)?;
      let went_sd: i64 = row.get(3)?;
      let saw_flop: i64 = row.get(4)?;
      let flop_win: i64 = row.get(5)?;
      let pfr: i64 = row.get(6)?;
      let cbet: i64 = row.get(7)?;
      let cbet_opp: i64 = row.get(8)?;
      let bb = extract_bb(&key);
      Ok(BreakdownRow {
        key,
        hands,
        total_profit,
        avg_profit: if hands > 0 {
          total_profit / hands as f64
        } else {
          0.0
        },
        profit_bb: bb.map(|v| total_profit / v),
        showdown_rate: rate(went_sd as f64, saw_flop as f64),
        flop_win_rate: rate(flop_win as f64, saw_flop as f64),
        preflop_raise_rate: rate(pfr as f64, hands as f64),
        cbet_rate: rate(cbet as f64, cbet_opp as f64),
      })
    })
    .map_err(|e| format!("Failed to query {column} breakdown: {e}"))?;

  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| format!("Failed to read breakdown row: {e}"))?);
  }
  if sort_positions {
    out.sort_by_key(|row| position_sort_key(&row.key));
  } else {
    out.sort_by(|a, b| a.key.cmp(&b.key));
  }
  Ok(out)
}

fn extract_bb(stakes: &str) -> Option<f64> {
  let cleaned = stakes.replace('$', "");
  let parts: Vec<&str> = cleaned.split('/').collect();
  if parts.len() < 2 {
    return None;
  }
  let bb = parts[1].trim().parse::<f64>().ok()?;
  if bb > 0.0 {
    Some(bb)
  } else {
    None
  }
}

pub(crate) fn classify_hand(hand: &HandLoad, position: &str, actions: &[ActionLoad]) -> HandStatRow {
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

  #[test]
  fn profit_sql_switches_with_exclude_rake() {
    assert_eq!(profit_sql(&StatsFilter::default()), "hero_net");
    assert_eq!(
      profit_sql(&StatsFilter {
        exclude_rake: true,
        ..StatsFilter::default()
      }),
      "net_before_rake"
    );
  }

  fn curve_fixture() -> Connection {
    let conn = Connection::open_in_memory().expect("memory db");
    conn
      .execute_batch(
        "CREATE TABLE hands (id INTEGER PRIMARY KEY);
         CREATE TABLE hand_stats (
           hand_id INTEGER PRIMARY KEY,
           played_at TEXT,
           stakes TEXT,
           position TEXT,
           pot_type TEXT,
           hero_net REAL NOT NULL DEFAULT 0,
           rake REAL NOT NULL DEFAULT 0,
           net_before_rake REAL NOT NULL DEFAULT 0,
           vpip INTEGER NOT NULL DEFAULT 0,
           preflop_raised INTEGER NOT NULL DEFAULT 0,
           preflop_called INTEGER NOT NULL DEFAULT 0,
           three_bet INTEGER NOT NULL DEFAULT 0,
           three_bet_opportunity INTEGER NOT NULL DEFAULT 0,
           four_bet INTEGER NOT NULL DEFAULT 0,
           four_bet_opportunity INTEGER NOT NULL DEFAULT 0,
           saw_flop INTEGER NOT NULL DEFAULT 0,
           won_when_saw_flop INTEGER NOT NULL DEFAULT 0,
           went_to_showdown INTEGER NOT NULL DEFAULT 0,
           won_at_showdown INTEGER NOT NULL DEFAULT 0,
           cbet_flop INTEGER NOT NULL DEFAULT 0,
           cbet_turn INTEGER NOT NULL DEFAULT 0,
           cbet_river INTEGER NOT NULL DEFAULT 0,
           cbet_flop_opportunity INTEGER NOT NULL DEFAULT 0,
           cbet_turn_opportunity INTEGER NOT NULL DEFAULT 0,
           cbet_river_opportunity INTEGER NOT NULL DEFAULT 0
         );
         INSERT INTO hands (id) VALUES (1), (2);
         INSERT INTO hand_stats (hand_id, played_at, position, stakes, pot_type, hero_net, rake, net_before_rake, went_to_showdown)
         VALUES
           (1, '2024-01-01', 'Button', '$0.05/$0.10', 'SRP', 1.00, 0.10, 1.10, 1),
           (2, '2024-01-02', 'Cutoff', '$0.05/$0.10', 'SRP', -0.50, 0.00, -0.50, 0);",
      )
      .expect("fixture");
    conn
  }

  #[test]
  fn equity_curve_uses_net_before_rake_when_excluded() {
    let conn = curve_fixture();
    let after = equity_curve(&conn, &StatsFilter::default()).expect("after rake");
    let before = equity_curve(
      &conn,
      &StatsFilter {
        exclude_rake: true,
        ..StatsFilter::default()
      },
    )
    .expect("before rake");
    assert_eq!(after.points.len(), 2);
    assert!((after.points[1].total - 0.50).abs() < 1e-9);
    assert!((after.points[1].showdown - 1.00).abs() < 1e-9);
    assert!((before.points[1].total - 0.60).abs() < 1e-9);
    assert!((before.points[1].showdown - 1.10).abs() < 1e-9);
    assert!((before.points[1].non_showdown + 0.50).abs() < 1e-9);
  }

  #[test]
  fn playstyle_profit_follows_exclude_rake() {
    let conn = curve_fixture();
    let after = playstyle(&conn, &StatsFilter::default()).expect("after");
    let before = playstyle(
      &conn,
      &StatsFilter {
        exclude_rake: true,
        ..StatsFilter::default()
      },
    )
    .expect("before");
    assert!((after.showdown_profit - 1.00).abs() < 1e-9);
    assert!((before.showdown_profit - 1.10).abs() < 1e-9);
    assert!((after.non_showdown_profit + 0.50).abs() < 1e-9);
    assert!((before.non_showdown_profit + 0.50).abs() < 1e-9);
  }

  #[test]
  fn downsample_keeps_ends_and_target_size() {
    let points: Vec<CurvePoint> = (1..=2000)
      .map(|n| CurvePoint {
        hand_number: n,
        total: n as f64,
        showdown: 0.0,
        non_showdown: n as f64,
      })
      .collect();
    let sampled = downsample_curve(points, 600);
    assert!(sampled.len() >= 400 && sampled.len() <= 800);
    assert_eq!(sampled.first().map(|p| p.hand_number), Some(1));
    assert_eq!(sampled.last().map(|p| p.hand_number), Some(2000));
  }
}
