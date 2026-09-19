//! Hero stats from imported SQLite rows — gathered data only.
//!
//! Flags are stamped into `hand_stats` at import. A versioned rematerialize
//! rewrites existing rows when classification rules change, then missing-row
//! backfill covers anything still empty. Live queries use SQL aggregates and
//! never SELECT `raw_text`. No GTO, theory, or range-chart baselines.
//!
//! Playstyle flags follow the PokerTracker + Hold’em Manager consensus where
//! those products agree. VPIP/PFR walk denominators, 4-bet scope (cold 4-bet,
//! 5-bet+ not rolled in), and W$SD chops stay on the previous Cardsharpener
//! rules until those A/B questions are answered.

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
  pub three_bet_rate: Option<f64>,
  pub four_bet_rate: Option<f64>,
  pub flop_rate: f64,
  pub flop_win_rate: Option<f64>,
  pub showdown_rate: Option<f64>,
  pub won_at_showdown_rate: Option<f64>,
  pub cbet_flop_rate: Option<f64>,
  pub cbet_turn_rate: Option<f64>,
  pub cbet_river_rate: Option<f64>,
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
  pub showdown_rate: Option<f64>,
  pub flop_win_rate: Option<f64>,
  pub preflop_raise_rate: f64,
  pub cbet_rate: Option<f64>,
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
  pub hero_starting_stack: Option<f64>,
}

pub(crate) struct ActionLoad {
  pub street: String,
  pub actor_name: Option<String>,
  pub action_type: String,
  pub amount: Option<f64>,
  pub is_all_in: bool,
}

/// Bump when `classify_hand` rules change so existing DBs rematerialize.
const STATS_LOGIC_MIGRATION: i64 = 3;

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

fn rate(numer: f64, denom: f64) -> Option<f64> {
  if denom > 0.0 {
    Some((numer / denom) * 100.0)
  } else {
    None
  }
}

fn hands_rate(numer: f64, denom: f64) -> f64 {
  rate(numer, denom).unwrap_or(0.0)
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

fn stats_logic_applied(conn: &Connection) -> Result<bool, String> {
  let applied: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM schema_migrations WHERE id = ?1",
      params![STATS_LOGIC_MIGRATION],
      |r| r.get(0),
    )
    .map_err(|e| format!("Failed to read stats logic version: {e}"))?;
  Ok(applied > 0)
}

fn mark_stats_logic(conn: &Connection) -> Result<(), String> {
  conn
    .execute(
      "INSERT OR IGNORE INTO schema_migrations (id) VALUES (?1)",
      params![STATS_LOGIC_MIGRATION],
    )
    .map_err(|e| format!("Failed to record stats logic version: {e}"))?;
  Ok(())
}

/// Rewrite every `hand_stats` row with the current classify rules.
pub fn rematerialize_all(conn: &mut Connection) -> Result<i64, String> {
  classify_and_write(conn, false)
}

/// Classify pass for hands that still have no `hand_stats` row.
pub fn backfill_missing(conn: &mut Connection) -> Result<i64, String> {
  classify_and_write(conn, true)
}

pub fn rematerialize_if_stale(conn: &mut Connection) -> Result<i64, String> {
  if stats_logic_applied(conn)? {
    return Ok(0);
  }
  let written = rematerialize_all(conn)?;
  mark_stats_logic(conn)?;
  Ok(written)
}

pub fn ensure_stats(conn: &mut Connection) -> Result<i64, String> {
  let remat = rematerialize_if_stale(conn)?;
  let missing = backfill_missing(conn)?;
  Ok(remat + missing)
}

struct HeroMeta {
  position: String,
  starting_stack: Option<f64>,
}

fn classify_and_write(conn: &mut Connection, missing_only: bool) -> Result<i64, String> {
  let label = if missing_only { "backfill" } else { "rematerialize" };
  if missing_only {
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
  }

  let hand_sql = if missing_only {
    "SELECT h.id, h.played_at, h.stakes, h.hero_name, h.hero_net, h.raw_text, h.board_cards
     FROM hands h
     LEFT JOIN hand_stats s ON s.hand_id = h.id
     WHERE s.hand_id IS NULL
     ORDER BY h.id ASC"
  } else {
    "SELECT h.id, h.played_at, h.stakes, h.hero_name, h.hero_net, h.raw_text, h.board_cards
     FROM hands h
     ORDER BY h.id ASC"
  };
  let mut hand_stmt = conn
    .prepare(hand_sql)
    .map_err(|e| format!("Failed to prepare stats {label}: {e}"))?;
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
        hero_starting_stack: None,
      })
    })
    .map_err(|e| format!("Failed to query {label} hands: {e}"))?;
  let mut hands = Vec::new();
  for row in hand_rows {
    hands.push(row.map_err(|e| format!("Failed to read {label} hand: {e}"))?);
  }
  drop(hand_stmt);

  let mut pos_stmt = conn
    .prepare("SELECT hand_id, position, starting_stack FROM players WHERE is_hero = 1")
    .map_err(|e| format!("Failed to prepare hero positions: {e}"))?;
  let pos_rows = pos_stmt
    .query_map([], |row| {
      Ok((
        row.get::<_, i64>(0)?,
        row.get::<_, Option<String>>(1)?,
        row.get::<_, Option<f64>>(2)?,
      ))
    })
    .map_err(|e| format!("Failed to query hero positions: {e}"))?;
  let mut hero_by_hand: HashMap<i64, HeroMeta> = HashMap::new();
  for row in pos_rows {
    let (hand_id, position, starting_stack) =
      row.map_err(|e| format!("Failed to read hero position: {e}"))?;
    let position = position
      .filter(|s| !s.trim().is_empty())
      .unwrap_or_else(|| "Unknown".into());
    hero_by_hand.insert(
      hand_id,
      HeroMeta {
        position,
        starting_stack,
      },
    );
  }
  drop(pos_stmt);

  let act_sql = if missing_only {
    "SELECT a.hand_id, a.street, a.actor_name, a.action_type, a.amount, a.is_all_in
     FROM actions a
     LEFT JOIN hand_stats s ON s.hand_id = a.hand_id
     WHERE s.hand_id IS NULL
     ORDER BY a.hand_id ASC, a.seq ASC, a.id ASC"
  } else {
    "SELECT a.hand_id, a.street, a.actor_name, a.action_type, a.amount, a.is_all_in
     FROM actions a
     ORDER BY a.hand_id ASC, a.seq ASC, a.id ASC"
  };
  let mut act_stmt = conn
    .prepare(act_sql)
    .map_err(|e| format!("Failed to prepare {label} actions: {e}"))?;
  let act_rows = act_stmt
    .query_map([], |row| {
      let is_all_in: i64 = row.get(5)?;
      Ok((
        row.get::<_, i64>(0)?,
        ActionLoad {
          street: row.get(1)?,
          actor_name: row.get(2)?,
          action_type: row.get(3)?,
          amount: row.get(4)?,
          is_all_in: is_all_in != 0,
        },
      ))
    })
    .map_err(|e| format!("Failed to query {label} actions: {e}"))?;
  let mut actions_by_hand: HashMap<i64, Vec<ActionLoad>> = HashMap::new();
  for row in act_rows {
    let (hand_id, action) = row.map_err(|e| format!("Failed to read {label} action: {e}"))?;
    actions_by_hand.entry(hand_id).or_default().push(action);
  }
  drop(act_stmt);

  let tx = conn
    .transaction()
    .map_err(|e| format!("Failed to start stats {label} transaction: {e}"))?;
  let mut written = 0i64;
  for hand in &hands {
    let actions = actions_by_hand
      .get(&hand.id)
      .map(Vec::as_slice)
      .unwrap_or(&[]);
    let meta = hero_by_hand.get(&hand.id);
    let position = meta
      .map(|m| m.position.as_str())
      .unwrap_or("Unknown");
    let load = HandLoad {
      id: hand.id,
      played_at: hand.played_at.clone(),
      stakes: hand.stakes.clone(),
      hero_name: hand.hero_name.clone(),
      hero_net: hand.hero_net,
      raw_text: hand.raw_text.clone(),
      board_cards: hand.board_cards.clone(),
      hero_starting_stack: meta.and_then(|m| m.starting_stack),
    };
    let row = classify_hand(&load, position, actions);
    insert_row(&tx, &row)?;
    written += 1;
  }
  tx.commit()
    .map_err(|e| format!("Failed to commit stats {label}: {e}"))?;
  Ok(written)
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
        vpip_rate: hands_rate(vpip as f64, total as f64),
        preflop_raise_rate: hands_rate(pfr as f64, total as f64),
        three_bet_rate: rate(three_bet as f64, three_opp as f64),
        four_bet_rate: rate(four_bet as f64, four_opp as f64),
        flop_rate: hands_rate(saw_flop as f64, total as f64),
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
        preflop_raise_rate: hands_rate(pfr as f64, hands as f64),
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
  let mut hero_has_limped = false;
  let mut hero_all_in = false;
  let mut hero_invested = 0.0;
  let mut preflop_raises = 0i32;
  let mut last_aggressor = ["", "", "", ""]; // preflop, flop, turn, river
  let mut first_bet_made = [false, false, false]; // flop, turn, river
  let mut cbet = [false, false, false];
  let mut cbet_opp = [false, false, false];
  let mut street_seen = [false, false, false];
  let mut hero_acted_street = [false, false, false];

  for action in actions {
    let street = norm_street(&action.street);
    let kind = action.action_type.trim().to_ascii_lowercase();
    let hero = is_hero_actor(action.actor_name.as_deref(), hero_name);
    let street_idx = street_index(street);
    let amount = action.amount.unwrap_or(0.0);
    let facing_all_in = action.is_all_in || kind == "all-in";

    if street == "flop" && !street_seen[0] {
      street_seen[0] = true;
      cbet_opp[0] = last_aggressor[0] == "hero" && !hero_all_in;
    } else if street == "turn" && !street_seen[1] {
      street_seen[1] = true;
      cbet_opp[1] = cbet[0] && !hero_all_in;
    } else if street == "river" && !street_seen[2] {
      street_seen[2] = true;
      cbet_opp[2] = cbet[1] && !hero_all_in;
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
    if hero && facing_all_in {
      hero_all_in = true;
    }

    let is_pf_raise = is_preflop_raise_action(&kind);
    let is_raise = kind == "raise";
    let is_bet = kind == "bet" || kind == "all-in";
    let is_call = kind == "call";

    if street == "preflop" && hero {
      if kind == "post" && amount > 0.0 {
        hero_invested += amount;
      }
      if is_call {
        preflop_called = true;
        vpip = true;
        if amount > 0.0 {
          hero_invested += amount;
        }
        if preflop_raises == 0 {
          hero_has_limped = true;
        }
      }
      if is_pf_raise {
        vpip = true;
        preflop_raised = true;
        if amount > 0.0 {
          hero_invested += amount;
        }
        // Limp-reraise is VPIP + PFR, not a 3-bet.
        if preflop_raises == 1 && !hero_has_limped {
          three_bet = true;
        } else if preflop_raises == 2 {
          four_bet = true;
        }
        preflop_raises += 1;
        last_aggressor[0] = "hero";
      }
    } else if street == "preflop" && !hero && is_pf_raise {
      preflop_raises += 1;
      let can_raise = hero_can_raise(
        hero_folded || hero_folded_preflop,
        hero_all_in,
        hand.hero_starting_stack,
        hero_invested,
        action.amount,
        facing_all_in,
      );
      if preflop_raises == 1 {
        if can_raise && !hero_has_limped {
          three_bet_opportunity = true;
        }
      } else if preflop_raises == 2 {
        if can_raise {
          four_bet_opportunity = true;
        }
      }
      last_aggressor[0] = "villain";
    }

    if street_idx >= 1 && street_idx <= 3 {
      let post_idx = (street_idx - 1) as usize;
      if hero && !matches!(kind.as_str(), "show" | "shows" | "showed" | "collect" | "return") {
        hero_acted_street[post_idx] = true;
      }
      if is_bet {
        if !first_bet_made[post_idx] {
          if hero && cbet_opp[post_idx] && (kind == "bet" || kind == "all-in") {
            cbet[post_idx] = true;
          }
          if !hero && !hero_acted_street[post_idx] {
            // Donk in front of Hero kills the c-bet chance.
            cbet_opp[post_idx] = false;
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
  // All-in preflop runouts are not a flop c-bet chance. Turn/river require
  // Hero actually c-bet the previous street (delayed c-bet is a different stat).
  if board_count >= 3 && !street_seen[0] {
    cbet_opp[0] = last_aggressor[0] == "hero" && !hero_all_in;
  }
  if board_count >= 4 && !street_seen[1] {
    cbet_opp[1] = cbet[0] && !hero_all_in;
  }
  if board_count >= 5 && !street_seen[2] {
    cbet_opp[2] = cbet[1] && !hero_all_in;
  }

  let saw_flop = hero_postflop_action || (!hero_folded_preflop && board_count >= 3);
  let hero_showed_raw = hero_showed_in_text(raw);
  // WTSD: Hero’s cards tabled — not “anyone showed.”
  let went_to_showdown = hero_showed || hero_showed_raw;
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

fn is_preflop_raise_action(kind: &str) -> bool {
  kind == "raise" || kind == "bet"
}

fn hero_can_raise(
  hero_folded: bool,
  hero_all_in: bool,
  hero_starting_stack: Option<f64>,
  hero_invested: f64,
  facing_amount: Option<f64>,
  facing_all_in: bool,
) -> bool {
  if hero_folded || hero_all_in {
    return false;
  }
  if !facing_all_in {
    return true;
  }
  let Some(stack) = hero_starting_stack.filter(|s| *s > 0.0) else {
    return true;
  };
  let left = stack - hero_invested;
  if left <= 1e-9 {
    return false;
  }
  if let Some(amt) = facing_amount.filter(|a| *a > 0.0) {
    return left > amt + 1e-9;
  }
  true
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
      amount: None,
      is_all_in: false,
    }
  }

  fn act_amt(street: &str, name: &str, kind: &str, amount: f64, all_in: bool) -> ActionLoad {
    ActionLoad {
      street: street.into(),
      actor_name: Some(name.into()),
      action_type: kind.into(),
      amount: Some(amount),
      is_all_in: all_in,
    }
  }

  fn hand(net: f64, board: &str, raw: &str) -> HandLoad {
    hand_with_stack(net, board, raw, None)
  }

  fn hand_with_stack(net: f64, board: &str, raw: &str, stack: Option<f64>) -> HandLoad {
    HandLoad {
      id: 1,
      played_at: None,
      stakes: Some("$0.05/$0.10".into()),
      hero_name: Some("Hero".into()),
      hero_net: Some(net),
      raw_text: Some(raw.into()),
      board_cards: Some(board.into()),
      hero_starting_stack: stack,
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
  fn folded_then_villain_opens_is_not_three_bet_opportunity() {
    let actions = [
      act("preflop", "Hero", "fold"),
      act("preflop", "BTN", "raise"),
    ];
    let row = classify_hand(&hand(-0.05, "", ""), "UTG", &actions);
    assert!(!row.three_bet_opportunity);
    assert!(!row.three_bet);
    assert!(!row.vpip);
    assert!(!row.preflop_raised);
  }

  #[test]
  fn limp_reraise_is_vpip_pfr_not_three_bet() {
    let actions = [
      act("preflop", "Hero", "call"),
      act("preflop", "BTN", "raise"),
      act("preflop", "Hero", "raise"),
    ];
    let row = classify_hand(&hand(-1.0, "", ""), "UTG", &actions);
    assert!(row.vpip);
    assert!(row.preflop_raised);
    assert!(!row.three_bet);
    assert!(!row.three_bet_opportunity);
  }

  #[test]
  fn squeeze_counts_as_three_bet() {
    let actions = [
      act("preflop", "UTG", "raise"),
      act("preflop", "MP", "call"),
      act("preflop", "Hero", "raise"),
    ];
    let row = classify_hand(&hand(-2.0, "", ""), "Button", &actions);
    assert!(row.three_bet);
    assert!(row.three_bet_opportunity);
    assert!(row.preflop_raised);
  }

  #[test]
  fn covering_shove_is_not_three_bet_opportunity() {
    let actions = [
      act("preflop", "Hero", "post"),
      act_amt("preflop", "UTG", "raise", 10.0, true),
    ];
    let row = classify_hand(
      &hand_with_stack(-0.10, "", "", Some(10.0)),
      "Big Blind",
      &actions,
    );
    assert!(!row.three_bet_opportunity);
    assert!(!row.three_bet);
  }

  #[test]
  fn short_shove_with_chips_behind_is_three_bet_opportunity() {
    let actions = [
      act("preflop", "Hero", "post"),
      act_amt("preflop", "UTG", "raise", 2.0, true),
    ];
    let row = classify_hand(
      &hand_with_stack(-0.10, "", "", Some(10.0)),
      "Big Blind",
      &actions,
    );
    assert!(row.three_bet_opportunity);
    assert!(!row.three_bet);
  }

  #[test]
  fn four_bet_opportunity_requires_hero_still_to_act() {
    let folded = [
      act("preflop", "Hero", "fold"),
      act("preflop", "UTG", "raise"),
      act("preflop", "BTN", "raise"),
    ];
    let folded_row = classify_hand(&hand(-0.05, "", ""), "UTG+1", &folded);
    assert!(!folded_row.four_bet_opportunity);
    assert!(!folded_row.four_bet);

    let facing = [
      act("preflop", "Hero", "raise"),
      act("preflop", "BTN", "raise"),
    ];
    let facing_row = classify_hand(&hand(-1.5, "", ""), "Cutoff", &facing);
    assert!(facing_row.four_bet_opportunity);
    assert!(!facing_row.four_bet);
    assert!(facing_row.preflop_raised);
    assert!(!facing_row.three_bet);
  }

  #[test]
  fn cold_four_bet_still_counts() {
    let actions = [
      act("preflop", "UTG", "raise"),
      act("preflop", "MP", "raise"),
      act("preflop", "Hero", "raise"),
    ];
    let row = classify_hand(&hand(-3.0, "", ""), "Button", &actions);
    assert!(row.three_bet_opportunity);
    assert!(row.four_bet_opportunity);
    assert!(!row.three_bet);
    assert!(row.four_bet);
  }

  #[test]
  fn five_bet_does_not_roll_into_four_bet() {
    let actions = [
      act("preflop", "UTG", "raise"),
      act("preflop", "MP", "raise"),
      act("preflop", "BTN", "raise"),
      act("preflop", "Hero", "raise"),
    ];
    let row = classify_hand(&hand(-8.0, "", ""), "Big Blind", &actions);
    assert!(row.three_bet_opportunity);
    assert!(row.four_bet_opportunity);
    assert!(!row.three_bet);
    assert!(!row.four_bet);
    assert!(row.preflop_raised);
  }

  #[test]
  fn preflop_bet_counts_as_pfr() {
    let actions = [act("preflop", "Hero", "bet")];
    let row = classify_hand(&hand(-0.25, "", ""), "Button", &actions);
    assert!(row.vpip);
    assert!(row.preflop_raised);
    assert!(!row.three_bet);
  }

  #[test]
  fn flop_cbet_skipped_when_hero_already_all_in() {
    let actions = [
      act_amt("preflop", "Hero", "raise", 10.0, true),
    ];
    let row = classify_hand(&hand(0.5, "Ah Kd 2c 7s 3d", ""), "Cutoff", &actions);
    assert!(row.saw_flop);
    assert!(!row.cbet_flop_opportunity);
    assert!(!row.cbet_flop);
    assert!(!row.cbet_turn_opportunity);
    assert!(!row.cbet_river_opportunity);
  }

  #[test]
  fn donk_kills_flop_cbet_chance() {
    let actions = [
      act("preflop", "Hero", "raise"),
      act("flop", "BB", "bet"),
      act("flop", "Hero", "raise"),
    ];
    let row = classify_hand(&hand(-1.0, "Ah Kd 2c", ""), "Button", &actions);
    assert!(!row.cbet_flop_opportunity);
    assert!(!row.cbet_flop);
  }

  #[test]
  fn check_raise_is_not_a_cbet() {
    let actions = [
      act("preflop", "Hero", "raise"),
      act("flop", "Hero", "check"),
      act("flop", "BB", "bet"),
      act("flop", "Hero", "raise"),
    ];
    let row = classify_hand(&hand(-1.0, "Ah Kd 2c", ""), "Button", &actions);
    assert!(row.cbet_flop_opportunity);
    assert!(!row.cbet_flop);
  }

  #[test]
  fn turn_cbet_requires_flop_cbet() {
    let barreled = [
      act("preflop", "Hero", "raise"),
      act("flop", "Hero", "bet"),
      act("turn", "Hero", "bet"),
    ];
    let barreled_row = classify_hand(&hand(1.0, "Ah Kd 2c 7s", ""), "Button", &barreled);
    assert!(barreled_row.cbet_flop);
    assert!(barreled_row.cbet_turn_opportunity);
    assert!(barreled_row.cbet_turn);

    let delayed = [
      act("preflop", "Hero", "raise"),
      act("flop", "Hero", "check"),
      act("flop", "BB", "check"),
      act("turn", "Hero", "bet"),
    ];
    let delayed_row = classify_hand(&hand(0.5, "Ah Kd 2c 7s", ""), "Button", &delayed);
    assert!(delayed_row.cbet_flop_opportunity);
    assert!(!delayed_row.cbet_flop);
    assert!(!delayed_row.cbet_turn_opportunity);
    assert!(!delayed_row.cbet_turn);

    let raised_donk = [
      act("preflop", "Hero", "raise"),
      act("flop", "BB", "bet"),
      act("flop", "Hero", "raise"),
      act("turn", "Hero", "bet"),
    ];
    let raised_donk_row = classify_hand(&hand(0.5, "Ah Kd 2c 7s", ""), "Button", &raised_donk);
    assert!(!raised_donk_row.cbet_flop);
    assert!(!raised_donk_row.cbet_turn_opportunity);
    assert!(!raised_donk_row.cbet_turn);
  }

  #[test]
  fn river_cbet_requires_turn_cbet() {
    let actions = [
      act("preflop", "Hero", "raise"),
      act("flop", "Hero", "bet"),
      act("turn", "Hero", "check"),
      act("turn", "BB", "check"),
      act("river", "Hero", "bet"),
    ];
    let row = classify_hand(&hand(0.5, "Ah Kd 2c 7s 3d", ""), "Button", &actions);
    assert!(row.cbet_flop);
    assert!(row.cbet_turn_opportunity);
    assert!(!row.cbet_turn);
    assert!(!row.cbet_river_opportunity);
    assert!(!row.cbet_river);
  }

  #[test]
  fn wtsd_requires_hero_cards_tabled() {
    let showed = classify_hand(
      &hand(1.0, "Ah Kd 2c", "Hero : shows [Ac Qc]"),
      "Button",
      &[act("preflop", "Hero", "raise"), act("showdown", "Hero", "show")],
    );
    assert!(showed.went_to_showdown);
    assert!(showed.won_at_showdown);

    let villain_only = classify_hand(
      &hand(1.0, "Ah Kd 2c", "Villain : shows [Ah Kh]"),
      "Button",
      &[act("preflop", "Hero", "raise")],
    );
    assert!(!villain_only.went_to_showdown);
    assert!(!villain_only.won_at_showdown);
  }

  #[test]
  fn empty_opportunity_sample_is_none() {
    let conn = curve_fixture();
    let style = playstyle(&conn, &StatsFilter::default()).expect("playstyle");
    assert_eq!(style.three_bet_rate, None);
    assert_eq!(style.four_bet_rate, None);
    assert_eq!(style.cbet_flop_rate, None);
    assert_eq!(style.cbet_turn_rate, None);
    assert_eq!(style.cbet_river_rate, None);
    assert_eq!(style.flop_win_rate, None);
    assert_eq!(style.showdown_rate, None);
  }

  fn rematerialize_fixture() -> Connection {
    let conn = Connection::open_in_memory().expect("memory db");
    conn
      .execute_batch(
        "CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, applied_at TEXT);
         CREATE TABLE hands (
           id INTEGER PRIMARY KEY,
           played_at TEXT,
           stakes TEXT,
           hero_name TEXT,
           hero_net REAL,
           raw_text TEXT,
           board_cards TEXT
         );
         CREATE TABLE players (
           id INTEGER PRIMARY KEY,
           hand_id INTEGER,
           position TEXT,
           starting_stack REAL,
           is_hero INTEGER
         );
         CREATE TABLE actions (
           id INTEGER PRIMARY KEY,
           hand_id INTEGER,
           seq INTEGER,
           street TEXT,
           actor_name TEXT,
           action_type TEXT,
           amount REAL,
           is_all_in INTEGER DEFAULT 0
         );
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
         INSERT INTO schema_migrations (id) VALUES (1), (2);
         INSERT INTO hands (id, stakes, hero_name, hero_net, raw_text, board_cards)
         VALUES (1, '$0.05/$0.10', 'Hero', -0.05, '', '');
         INSERT INTO players (hand_id, position, starting_stack, is_hero)
         VALUES (1, 'UTG', 10.0, 1);
         INSERT INTO actions (hand_id, seq, street, actor_name, action_type, amount, is_all_in)
         VALUES
           (1, 1, 'preflop', 'Hero', 'fold', 0, 0),
           (1, 2, 'preflop', 'BTN', 'raise', 0.25, 0);
         INSERT INTO hand_stats (hand_id, stakes, position, pot_type, hero_net, three_bet_opportunity)
         VALUES (1, '$0.05/$0.10', 'UTG', 'Preflop Only', -0.05, 1);",
      )
      .expect("fixture");
    conn
  }

  #[test]
  fn rematerialize_rewrites_stale_three_bet_opportunity() {
    let mut conn = rematerialize_fixture();
    let written = ensure_stats(&mut conn).expect("ensure");
    assert!(written >= 1);
    let opp: i64 = conn
      .query_row(
        "SELECT three_bet_opportunity FROM hand_stats WHERE hand_id = 1",
        [],
        |r| r.get(0),
      )
      .expect("opp");
    assert_eq!(opp, 0);
    let applied: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE id = 3",
        [],
        |r| r.get(0),
      )
      .expect("migration");
    assert_eq!(applied, 1);
    assert_eq!(ensure_stats(&mut conn).expect("second pass"), 0);
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
