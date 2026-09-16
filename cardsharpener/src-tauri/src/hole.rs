//! Hero hole-card filter: exact suits (`Ah Kd`) and combo notation (`AKs` / `AKo`).

const RANKS: [char; 13] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: [char; 4] = ['c', 'd', 'h', 's'];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Card {
  pub rank: char,
  pub suit: char,
}

impl Card {
  pub fn code(self) -> String {
    format!("{}{}", self.rank.to_ascii_lowercase(), self.suit)
  }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HoleFilter {
  Exact(Card, Card),
  HasCard(Card),
  Pair(char),
  Combo {
    a: char,
    b: char,
    suited: Option<bool>,
  },
}

fn is_rank(ch: char) -> bool {
  RANKS.contains(&ch.to_ascii_uppercase())
}

fn is_suit(ch: char) -> bool {
  SUITS.contains(&ch.to_ascii_lowercase())
}

fn parse_card_chars(rank: char, suit: char) -> Option<Card> {
  if is_rank(rank) && is_suit(suit) {
    Some(Card {
      rank: rank.to_ascii_uppercase(),
      suit: suit.to_ascii_lowercase(),
    })
  } else {
    None
  }
}

fn parse_card_token(token: &str) -> Option<Card> {
  let chars: Vec<char> = token.chars().collect();
  match chars.as_slice() {
    [r, s] => parse_card_chars(*r, *s),
    _ => None,
  }
}

pub fn parse_cards(raw: &str) -> Vec<Card> {
  let tokens: Vec<&str> = raw
    .split(|c: char| c.is_whitespace() || matches!(c, ',' | '/' | '|'))
    .filter(|t| !t.is_empty())
    .collect();
  let from_tokens: Vec<Card> = tokens.iter().filter_map(|t| parse_card_token(t)).collect();
  if from_tokens.len() >= 1 && from_tokens.len() == tokens.len() {
    return from_tokens;
  }

  let compact: String = raw.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
  let chars: Vec<char> = compact.chars().collect();
  let mut walked = Vec::new();
  let mut i = 0;
  while i + 1 < chars.len() {
    if let Some(card) = parse_card_chars(chars[i], chars[i + 1]) {
      walked.push(card);
      i += 2;
    } else {
      return Vec::new();
    }
  }
  if i == chars.len() {
    walked
  } else {
    Vec::new()
  }
}

fn combo(a: char, b: char, suited: Option<bool>) -> HoleFilter {
  let a = a.to_ascii_uppercase();
  let b = b.to_ascii_uppercase();
  if a == b {
    HoleFilter::Pair(a)
  } else {
    HoleFilter::Combo { a, b, suited }
  }
}

pub fn parse_hole_filter(raw: &str) -> Option<HoleFilter> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return None;
  }

  let cards = parse_cards(trimmed);
  if cards.len() >= 2 {
    return Some(HoleFilter::Exact(cards[0], cards[1]));
  }
  if cards.len() == 1 {
    return Some(HoleFilter::HasCard(cards[0]));
  }

  let compact: String = trimmed
    .chars()
    .filter(|c| c.is_ascii_alphanumeric())
    .map(|c| c.to_ascii_uppercase())
    .collect();
  let chars: Vec<char> = compact.chars().collect();
  match chars.as_slice() {
    [r1, r2, 'S'] if is_rank(*r1) && is_rank(*r2) => Some(combo(*r1, *r2, Some(true))),
    [r1, r2, 'O'] if is_rank(*r1) && is_rank(*r2) => Some(combo(*r1, *r2, Some(false))),
    [r1, r2] if is_rank(*r1) && is_rank(*r2) => Some(combo(*r1, *r2, None)),
    _ => None,
  }
}

pub fn hole_cards_match(stored: &str, query: &str) -> bool {
  let Some(filter) = parse_hole_filter(query) else {
    return false;
  };
  let cards = parse_cards(stored);
  match filter {
    HoleFilter::Exact(a, b) => contains_card(&cards, a) && contains_card(&cards, b),
    HoleFilter::HasCard(card) => contains_card(&cards, card),
    HoleFilter::Pair(rank) => cards.iter().filter(|c| c.rank == rank).count() >= 2,
    HoleFilter::Combo { a, b, suited } => {
      let first = cards.iter().copied().find(|c| c.rank == a);
      let second = cards
        .iter()
        .copied()
        .find(|c| c.rank == b && first != Some(*c));
      match (first, second) {
        (Some(left), Some(right)) => match suited {
          Some(true) => left.suit == right.suit,
          Some(false) => left.suit != right.suit,
          None => true,
        },
        _ => false,
      }
    }
  }
}

fn contains_card(cards: &[Card], wanted: Card) -> bool {
  cards.iter().any(|c| *c == wanted)
}

fn norm_sql() -> &'static str {
  "lower(replace(replace(replace(coalesce(h.hero_cards, ''), ' ', ''), ',', ''), '-', ''))"
}

fn has_card_sql(card: Card) -> String {
  format!("instr({}, '{}') > 0", norm_sql(), card.code())
}

fn has_rank_sql(rank: char) -> String {
  let parts: Vec<String> = SUITS
    .iter()
    .map(|suit| has_card_sql(Card { rank, suit: *suit }))
    .collect();
  format!("({})", parts.join(" OR "))
}

/// Safe SQL fragment (only rank/suit letters) or `None` if the query is not a hole pattern.
pub fn hole_filter_sql(query: &str) -> Option<String> {
  let filter = parse_hole_filter(query)?;
  Some(match filter {
    HoleFilter::Exact(a, b) => format!("({} AND {})", has_card_sql(a), has_card_sql(b)),
    HoleFilter::HasCard(card) => has_card_sql(card),
    HoleFilter::Pair(rank) => {
      let bits: Vec<String> = SUITS
        .iter()
        .map(|suit| format!("(CASE WHEN {} THEN 1 ELSE 0 END)", has_card_sql(Card { rank, suit: *suit })))
        .collect();
      format!("(({}) >= 2)", bits.join(" + "))
    }
    HoleFilter::Combo { a, b, suited: Some(true) } => {
      let pairs: Vec<String> = SUITS
        .iter()
        .map(|suit| {
          format!(
            "({} AND {})",
            has_card_sql(Card { rank: a, suit: *suit }),
            has_card_sql(Card { rank: b, suit: *suit })
          )
        })
        .collect();
      format!("({})", pairs.join(" OR "))
    }
    HoleFilter::Combo { a, b, suited: Some(false) } => {
      let mut pairs = Vec::new();
      for left in SUITS {
        for right in SUITS {
          if left == right {
            continue;
          }
          pairs.push(format!(
            "({} AND {})",
            has_card_sql(Card { rank: a, suit: left }),
            has_card_sql(Card { rank: b, suit: right })
          ));
        }
      }
      format!("({})", pairs.join(" OR "))
    }
    HoleFilter::Combo { a, b, suited: None } => {
      format!("({} AND {})", has_rank_sql(a), has_rank_sql(b))
    }
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_exact_suits_and_combos() {
    assert_eq!(
      parse_hole_filter("Ah Kd").unwrap(),
      HoleFilter::Exact(
        Card { rank: 'A', suit: 'h' },
        Card { rank: 'K', suit: 'd' }
      )
    );
    assert_eq!(
      parse_hole_filter("ahkd").unwrap(),
      HoleFilter::Exact(
        Card { rank: 'A', suit: 'h' },
        Card { rank: 'K', suit: 'd' }
      )
    );
    assert!(matches!(
      parse_hole_filter("AKs").unwrap(),
      HoleFilter::Combo { a: 'A', b: 'K', suited: Some(true) }
    ));
    assert!(matches!(
      parse_hole_filter("ako").unwrap(),
      HoleFilter::Combo { a: 'A', b: 'K', suited: Some(false) }
    ));
    assert!(matches!(
      parse_hole_filter("AK").unwrap(),
      HoleFilter::Combo { a: 'A', b: 'K', suited: None }
    ));
    assert_eq!(parse_hole_filter("AA").unwrap(), HoleFilter::Pair('A'));
    assert!(matches!(parse_hole_filter("qc").unwrap(), HoleFilter::HasCard(_)));
  }

  #[test]
  fn matches_exact_and_generic() {
    assert!(hole_cards_match("Ah Kd", "Ah Kd"));
    assert!(hole_cards_match("Kd Ah", "AhKd"));
    assert!(!hole_cards_match("As Kd", "Ah Kd"));

    assert!(hole_cards_match("Ah Kh", "AKs"));
    assert!(!hole_cards_match("Ah Kd", "AKs"));
    assert!(hole_cards_match("Ah Kd", "AKo"));
    assert!(!hole_cards_match("Ah Kh", "AKo"));
    assert!(hole_cards_match("Ah Kh", "AK"));
    assert!(hole_cards_match("Ah Kd", "AK"));

    assert!(hole_cards_match("Ah Ad", "AA"));
    assert!(!hole_cards_match("Ah Kd", "AA"));
    assert!(hole_cards_match("Qc Jd", "qc"));
  }
}
