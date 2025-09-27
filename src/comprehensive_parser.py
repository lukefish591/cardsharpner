import os
import glob
import re
import pandas as pd
import logging
from typing import Tuple, List, Optional, Dict, Any, NamedTuple
from dataclasses import dataclass, field
from datetime import datetime
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class Player:
    """Comprehensive player data for analysis"""
    name: str
    seat: int
    starting_stack: float
    ending_stack: float
    position: str
    hole_cards: List[str] = field(default_factory=list)
    is_hero: bool = False
    is_active: bool = True
    is_all_in: bool = False
    total_contributed: float = 0.0
    final_hand: str = ""
    hand_rank: str = ""
    vpip_eligible: bool = False  # Was in position to voluntarily put money in pot
    pfr_eligible: bool = False   # Was in position to raise preflop
    showdown_reached: bool = False
    mucked_cards: bool = False
    showed_cards: bool = False

@dataclass
class Action:
    """Comprehensive action data"""
    player: str
    action_type: str  # 'fold', 'call', 'raise', 'bet', 'check', 'all-in', 'post'
    amount: float
    total_bet: float
    street: str  # 'preflop', 'flop', 'turn', 'river'
    pot_before: float
    pot_after: float
    timestamp: int
    time_to_act: Optional[float] = None  # Seconds to act (if available)
    is_voluntary: bool = True  # False for blinds/antes
    is_aggressive: bool = False  # True for bets/raises
    position: str = ""
    effective_stack: float = 0.0
    pot_odds: float = 0.0
    implied_odds: float = 0.0
    bet_size_ratio: float = 0.0  # Bet size as ratio of pot
    is_value_bet: bool = False
    is_bluff: bool = False

@dataclass
class HandData:
    """Comprehensive hand data for analysis"""
    # Basic identifiers
    hand_id: str
    site: str = ""
    game_type: str = "Hold'em"
    variant: str = "6-max"  # HU, 6-max, 9-max, etc.
    is_tournament: bool = False
    tournament_id: str = ""
    table_name: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    
    # Game structure
    stakes: str = ""
    small_blind: float = 0.0
    big_blind: float = 0.0
    ante: float = 0.0
    button_seat: int = 1
    number_of_players: int = 6
    
    # Players and actions
    players: List[Player] = field(default_factory=list)
    actions: List[Action] = field(default_factory=list)
    
    # Board and results
    board_cards: List[str] = field(default_factory=list)
    flop_cards: List[str] = field(default_factory=list)
    turn_card: str = ""
    river_card: str = ""
    
    # Money flow
    pot_size: float = 0.0
    rake: float = 0.0
    jackpot: float = 0.0
    side_pots: List[Dict] = field(default_factory=list)
    
    # Showdown
    winner: str = ""
    winning_hand: str = ""
    hand_rank: str = ""
    showdown_players: List[str] = field(default_factory=list)
    
    # Derived context
    hero_seat: Optional[int] = None
    hero_hole_cards: List[str] = field(default_factory=list)
    went_to_showdown: bool = False
    is_heads_up: bool = False
    is_multiway: bool = False
    
    # Tournament specific
    tournament_phase: str = ""  # early, mid, late, bubble, final_table
    m_ratio: float = 0.0
    icm_pressure: float = 0.0
    stack_in_bbs: float = 0.0

class ComprehensiveParser:
    """Enhanced parser that extracts all data needed for comprehensive poker analysis"""
    
    def __init__(self):
        self.site_patterns = {
            'PokerStars': r'PokerStars',
            '888poker': r'888poker|888 Poker',
            'ACR': r'Americas Cardroom|ACR',
            'GGPoker': r'GGPoker|GG Poker',
            'PartyPoker': r'PartyPoker|Party Poker',
            'Winamax': r'Winamax',
            'Unibet': r'Unibet',
            'Bet365': r'Bet365',
            'William Hill': r'William Hill'
        }
    
    def extract_site(self, hand_text: str) -> str:
        """Extract poker site from hand text"""
        for site, pattern in self.site_patterns.items():
            if re.search(pattern, hand_text, re.IGNORECASE):
                return site
        return "Unknown"
    
    def extract_game_type(self, hand_text: str) -> Tuple[str, str]:
        """Extract game type and variant"""
        # Game type
        if re.search(r'Hold\'em', hand_text, re.IGNORECASE):
            game_type = "Hold'em"
        elif re.search(r'Omaha', hand_text, re.IGNORECASE):
            game_type = "Omaha"
        elif re.search(r'Stud', hand_text, re.IGNORECASE):
            game_type = "Stud"
        else:
            game_type = "Hold'em"
        
        # Variant
        if re.search(r'heads-up|HU', hand_text, re.IGNORECASE):
            variant = "HU"
        elif re.search(r'6-max|6max', hand_text, re.IGNORECASE):
            variant = "6-max"
        elif re.search(r'9-max|9max', hand_text, re.IGNORECASE):
            variant = "9-max"
        else:
            # Try to determine from seat count
            seats = re.findall(r'Seat \d+:', hand_text)
            if len(seats) <= 2:
                variant = "HU"
            elif len(seats) <= 6:
                variant = "6-max"
            else:
                variant = "9-max"
        
        return game_type, variant
    
    def extract_tournament_info(self, hand_text: str) -> Tuple[bool, str]:
        """Extract tournament information"""
        is_tournament = bool(re.search(r'tournament|tourney|tour', hand_text, re.IGNORECASE))
        tournament_id = ""
        
        if is_tournament:
            m = re.search(r'tournament #(\d+)', hand_text, re.IGNORECASE)
            if m:
                tournament_id = m.group(1)
        
        return is_tournament, tournament_id
    
    def extract_blinds_and_antes(self, hand_text: str) -> Tuple[float, float, float]:
        """Extract blind and ante structure"""
        small_blind = 0.0
        big_blind = 0.0
        ante = 0.0
        
        # Extract from stakes format like ($0.1/$0.25)
        m = re.search(r'\((\$[\d\.]+)\/(\$[\d\.]+)\)', hand_text)
        if m:
            small_blind = float(m.group(1).replace('$', ''))
            big_blind = float(m.group(2).replace('$', ''))
        
        # Extract ante
        m = re.search(r'ante \$([\d\.]+)', hand_text, re.IGNORECASE)
        if m:
            ante = float(m.group(1))
        
        return small_blind, big_blind, ante
    
    def extract_players_comprehensive(self, hand_text: str) -> List[Player]:
        """Extract comprehensive player information"""
        players = []
        lines = hand_text.split('\n')
        
        # Find all seat lines
        for line in lines:
            if line.startswith('Seat ') and 'in chips' in line:
                # Extract seat number, name, and chips
                m = re.search(r'Seat (\d+): ([^(]+) \(\$([\d.]+) in chips\)', line)
                if m:
                    seat = int(m.group(1))
                    name = m.group(2).strip()
                    starting_stack = float(m.group(3))
                    is_hero = 'Hero' in name
                    
                    players.append(Player(
                        name=name,
                        seat=seat,
                        starting_stack=starting_stack,
                        ending_stack=starting_stack,  # Will be updated later
                        position="",  # Will be calculated later
                        is_hero=is_hero
                    ))
        
        return players
    
    def calculate_positions(self, players: List[Player], button_seat: int) -> List[Player]:
        """Calculate positions for all players"""
        positions = ["Button", "Small Blind", "Big Blind", "UTG", "Hijack", "Cutoff"]
        
        for player in players:
            if player.seat and button_seat:
                index = (player.seat - button_seat) % len(positions)
                player.position = positions[index]
        
        return players
    
    def extract_hole_cards_comprehensive(self, hand_text: str, players: List[Player]) -> List[Player]:
        """Extract hole cards and determine VPIP/PFR eligibility"""
        lines = hand_text.split('\n')
        in_hole_cards = False
        
        for line in lines:
            if '*** HOLE CARDS ***' in line:
                in_hole_cards = True
                continue
            elif line.startswith('***') and in_hole_cards:
                break
            
            if in_hole_cards and 'Dealt to' in line:
                # Extract player name and cards
                m = re.search(r'Dealt to ([^[]+)\s*\[([^\]]*)\]', line)
                if m:
                    player_name = m.group(1).strip()
                    cards_str = m.group(2).strip()
                    
                    # Find the player and assign cards
                    for player in players:
                        if player.name == player_name:
                            if cards_str:
                                player.hole_cards = cards_str.split()
                                player.vpip_eligible = True
                                player.pfr_eligible = True
                            break
        
        return players
    
    def extract_actions_comprehensive(self, hand_text: str, players: List[Player], hand_data: HandData) -> List[Action]:
        """Extract comprehensive action data with derived metrics"""
        actions = []
        lines = hand_text.split('\n')
        current_street = 'preflop'
        pot_size = 0.0
        action_count = 0
        
        # Track current bets for each player
        current_bets = {player.name: 0.0 for player in players}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Detect street changes
            if '*** FLOP ***' in line:
                current_street = 'flop'
                continue
            elif '*** TURN ***' in line:
                current_street = 'turn'
                continue
            elif '*** RIVER ***' in line:
                current_street = 'river'
                continue
            elif '*** SHOWDOWN ***' in line:
                break
            
            # Skip non-action lines
            if not any(keyword in line for keyword in ['folds', 'calls', 'raises', 'bets', 'checks', 'all-in', 'posts']):
                continue
            
            # Extract action
            action = self.parse_action_comprehensive(line, current_street, pot_size, current_bets, action_count, players, hand_data)
            if action:
                actions.append(action)
                pot_size = action.pot_after
                current_bets[action.player] = action.total_bet
                action_count += 1
        
        return actions
    
    def parse_action_comprehensive(self, line: str, street: str, pot_before: float, current_bets: Dict[str, float], action_count: int, players: List[Player], hand_data: HandData) -> Optional[Action]:
        """Parse a single action with comprehensive metrics"""
        try:
            # Extract player name
            if ':' not in line:
                return None
                
            player = line.split(':')[0].strip()
            action_text = line.split(':', 1)[1].strip()
            
            # Find player object
            player_obj = next((p for p in players if p.name == player), None)
            if not player_obj:
                return None
            
            # Determine action type and amount
            action_type = 'unknown'
            amount = 0.0
            total_bet = current_bets.get(player, 0.0)
            
            if 'folds' in action_text:
                action_type = 'fold'
            elif 'calls' in action_text:
                action_type = 'call'
                m = re.search(r'calls \$([\d.]+)', action_text)
                if m:
                    amount = float(m.group(1))
                    total_bet += amount
            elif 'raises' in action_text:
                action_type = 'raise'
                m = re.search(r'raises \$([\d.]+) to \$([\d.]+)', action_text)
                if m:
                    amount = float(m.group(1))
                    total_bet = float(m.group(2))
            elif 'bets' in action_text:
                action_type = 'bet'
                m = re.search(r'bets \$([\d.]+)', action_text)
                if m:
                    amount = float(m.group(1))
                    total_bet += amount
            elif 'checks' in action_text:
                action_type = 'check'
            elif 'all-in' in action_text:
                action_type = 'all-in'
                m = re.search(r'all-in \$([\d.]+)', action_text)
                if m:
                    amount = float(m.group(1))
                    total_bet += amount
            elif 'posts' in action_text:
                action_type = 'post'
                m = re.search(r'posts (?:small blind|big blind) \$([\d.]+)', action_text)
                if m:
                    amount = float(m.group(1))
                    total_bet += amount
            
            # Calculate pot after action
            pot_after = pot_before + amount
            
            # Calculate derived metrics
            is_voluntary = action_type not in ['post']  # Blinds/antes are not voluntary
            is_aggressive = action_type in ['bet', 'raise', 'all-in']
            bet_size_ratio = amount / pot_before if pot_before > 0 else 0
            pot_odds = amount / (pot_after + amount) if pot_after > 0 else 0
            
            # Calculate effective stack
            effective_stack = min(player_obj.starting_stack, max(p.starting_stack for p in players if p.name != player))
            
            return Action(
                player=player,
                action_type=action_type,
                amount=amount,
                total_bet=total_bet,
                street=street,
                pot_before=pot_before,
                pot_after=pot_after,
                timestamp=action_count,
                is_voluntary=is_voluntary,
                is_aggressive=is_aggressive,
                position=player_obj.position,
                effective_stack=effective_stack,
                pot_odds=pot_odds,
                bet_size_ratio=bet_size_ratio
            )
            
        except Exception as e:
            logger.error(f"Error parsing action line '{line}': {e}")
            return None
    
    def extract_board_cards_comprehensive(self, hand_text: str) -> Tuple[List[str], List[str], str, str]:
        """Extract board cards with street separation"""
        board_cards = []
        flop_cards = []
        turn_card = ""
        river_card = ""
        
        # Extract flop
        m = re.search(r'\*\*\* FLOP \*\*\*\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            flop_cards = m.group(1).strip().split()
            board_cards.extend(flop_cards)
        
        # Extract turn
        m = re.search(r'\*\*\* TURN \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            turn_card = m.group(1).strip()
            board_cards.append(turn_card)
        
        # Extract river
        m = re.search(r'\*\*\* RIVER \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            river_card = m.group(1).strip()
            board_cards.append(river_card)
        
        return board_cards, flop_cards, turn_card, river_card
    
    def extract_showdown_info_comprehensive(self, hand_text: str, players: List[Player]) -> Tuple[str, str, str, List[str], bool]:
        """Extract comprehensive showdown information"""
        winner = ""
        winning_hand = ""
        hand_rank = ""
        showdown_players = []
        went_to_showdown = False
        
        # Look for showdown section
        showdown_start = hand_text.find('*** SHOWDOWN ***')
        if showdown_start != -1:
            went_to_showdown = True
            showdown_text = hand_text[showdown_start:]
            
            # Find all players who showed cards
            for line in showdown_text.split('\n'):
                if 'shows' in line and 'with' in line:
                    m = re.search(r'([^:]+): shows \[([^\]]+)\] \(([^)]+)\)', line)
                    if m:
                        player_name = m.group(1).strip()
                        cards = m.group(2).strip()
                        hand_description = m.group(3).strip()
                        
                        showdown_players.append(player_name)
                        
                        # Update player object
                        for player in players:
                            if player.name == player_name:
                                player.showed_cards = True
                                player.final_hand = cards
                                player.hand_rank = hand_description
                                break
                        
                        if not winner:  # First player shown is usually the winner
                            winner = player_name
                            winning_hand = cards
                            hand_rank = hand_description
        
        # Look for winner in summary
        summary_start = hand_text.find('*** SUMMARY ***')
        if summary_start != -1:
            summary_text = hand_text[summary_start:]
            
            for line in summary_text.split('\n'):
                if 'won' in line and '$' in line:
                    m = re.search(r'Seat \d+: ([^(]+) .*? won \(\$([\d.]+)\)', line)
                    if m:
                        winner = m.group(1).strip()
                        break
        
        return winner, winning_hand, hand_rank, showdown_players, went_to_showdown
    
    def calculate_derived_metrics(self, hand_data: HandData) -> HandData:
        """Calculate derived metrics and context"""
        # Determine if heads up or multiway
        active_players = len([p for p in hand_data.players if p.is_active])
        hand_data.is_heads_up = active_players == 2
        hand_data.is_multiway = active_players > 2
        
        # Find hero
        hero = next((p for p in hand_data.players if p.is_hero), None)
        if hero:
            hand_data.hero_seat = hero.seat
            hand_data.hero_hole_cards = hero.hole_cards
        
        # Calculate stack sizes in BBs
        if hand_data.big_blind > 0:
            for player in hand_data.players:
                player.stack_in_bbs = player.starting_stack / hand_data.big_blind
        
        # Update player showdown status
        for player in hand_data.players:
            if player.name in hand_data.showdown_players:
                player.showdown_reached = True
        
        return hand_data
    
    def parse_hand_comprehensive(self, hand_text: str) -> HandData:
        """Parse a hand with comprehensive data extraction"""
        try:
            # Extract basic info
            hand_id = self.extract_hand_id(hand_text)
            site = self.extract_site(hand_text)
            game_type, variant = self.extract_game_type(hand_text)
            is_tournament, tournament_id = self.extract_tournament_info(hand_text)
            table_name = self.extract_table_name(hand_text)
            timestamp = self.extract_timestamp(hand_text)
            
            # Extract game structure
            small_blind, big_blind, ante = self.extract_blinds_and_antes(hand_text)
            button_seat = self.extract_button_seat(hand_text)
            
            # Extract players
            players = self.extract_players_comprehensive(hand_text)
            players = self.calculate_positions(players, button_seat)
            players = self.extract_hole_cards_comprehensive(hand_text, players)
            
            # Create hand data object
            hand_data = HandData(
                hand_id=hand_id,
                site=site,
                game_type=game_type,
                variant=variant,
                is_tournament=is_tournament,
                tournament_id=tournament_id,
                table_name=table_name,
                timestamp=timestamp,
                stakes=f"${small_blind}/${big_blind}",
                small_blind=small_blind,
                big_blind=big_blind,
                ante=ante,
                button_seat=button_seat,
                number_of_players=len(players),
                players=players
            )
            
            # Extract actions
            actions = self.extract_actions_comprehensive(hand_text, players, hand_data)
            hand_data.actions = actions
            
            # Extract board cards
            board_cards, flop_cards, turn_card, river_card = self.extract_board_cards_comprehensive(hand_text)
            hand_data.board_cards = board_cards
            hand_data.flop_cards = flop_cards
            hand_data.turn_card = turn_card
            hand_data.river_card = river_card
            
            # Extract pot and money info
            pot_size, rake, jackpot = self.extract_pot_info(hand_text)
            hand_data.pot_size = pot_size
            hand_data.rake = rake
            hand_data.jackpot = jackpot
            
            # Extract showdown info
            winner, winning_hand, hand_rank, showdown_players, went_to_showdown = self.extract_showdown_info_comprehensive(hand_text, players)
            hand_data.winner = winner
            hand_data.winning_hand = winning_hand
            hand_data.hand_rank = hand_rank
            hand_data.showdown_players = showdown_players
            hand_data.went_to_showdown = went_to_showdown
            
            # Calculate derived metrics
            hand_data = self.calculate_derived_metrics(hand_data)
            
            return hand_data
            
        except Exception as e:
            logger.error(f"Error parsing hand: {e}")
            return HandData(hand_id="", timestamp=datetime.now())
    
    # Helper methods (implement these)
    def extract_hand_id(self, hand_text: str) -> str:
        m = re.search(r'Poker Hand #([A-Z0-9]+)', hand_text)
        return m.group(1) if m else ""
    
    def extract_table_name(self, hand_text: str) -> str:
        m = re.search(r"Table '([^']+)'", hand_text)
        return m.group(1) if m else ""
    
    def extract_timestamp(self, hand_text: str) -> datetime:
        m = re.search(r'(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})', hand_text)
        if m:
            return datetime.strptime(m.group(1), '%Y/%m/%d %H:%M:%S')
        return datetime.now()
    
    def extract_button_seat(self, hand_text: str) -> int:
        m = re.search(r'Seat #(\d+) is the button', hand_text, re.IGNORECASE)
        return int(m.group(1)) if m else 1
    
    def extract_pot_info(self, hand_text: str) -> Tuple[float, float, float]:
        pot_size = 0.0
        rake = 0.0
        jackpot = 0.0
        
        m = re.search(r'Total pot \$([\d.]+)', hand_text)
        if m:
            pot_size = float(m.group(1))
        
        m = re.search(r'Rake \$([\d.]+)', hand_text, re.IGNORECASE)
        if m:
            rake = float(m.group(1))
        
        m = re.search(r'Jackpot \$([\d.]+)', hand_text, re.IGNORECASE)
        if m:
            jackpot = float(m.group(1))
        
        return pot_size, rake, jackpot

def parse_file_comprehensive(text: str) -> List[HandData]:
    """Parse a file containing multiple hands with comprehensive data"""
    try:
        parser = ComprehensiveParser()
        hands = re.split(r'(?=Poker Hand #)', text)
        results = []
        for hand in hands:
            if hand.strip():
                result = parser.parse_hand_comprehensive(hand)
                results.append(result)
        return results
    except Exception as e:
        logger.error(f"Error parsing file: {e}")
        return []

# Legacy compatibility
def parse_hand(hand_text: str) -> Tuple[float, str, float, bool, float, float, float, bool, str, str, str, Optional[int], str, bool]:
    """Legacy parse_hand function for backward compatibility"""
    try:
        parser = ComprehensiveParser()
        hand_data = parser.parse_hand_comprehensive(hand_text)
        
        # Calculate profit for Hero
        hero = next((p for p in hand_data.players if p.is_hero), None)
        if not hero:
            return (0.0, "No Hero found", 0.0, False, 0.0, 0.0, 0.0, False, "", "", "", None, "", False)
        
        # Calculate profit from actions
        total_contributed = 0.0
        collected = 0.0
        
        for action in hand_data.actions:
            if action.player == hero.name:
                if action.action_type in ['call', 'raise', 'bet', 'post']:
                    total_contributed += action.amount
                elif 'collected' in action.action_type:
                    collected += action.amount
        
        profit = collected - total_contributed
        
        # Extract basic info
        hero_hole_cards = " ".join(hero.hole_cards) if hero.hole_cards else ""
        board_cards = "; ".join([f"Flop: {' '.join(hand_data.flop_cards)}", 
                                f"Turn: {hand_data.turn_card}",
                                f"River: {hand_data.river_card}"])
        stakes = hand_data.stakes
        hero_seat = hero.seat
        hero_position = hero.position
        preflop_hero_last_raise = any(action.action_type == 'raise' and action.street == 'preflop' 
                                    for action in reversed(hand_data.actions) if action.player == hero.name)
        
        debug_str = f"Comprehensive parser: {len(hand_data.actions)} actions, {len(hand_data.players)} players"
        
        return (profit, debug_str, hand_data.rake, hand_data.went_to_showdown, 
                hand_data.rake if profit > 0 else 0.0, hand_data.jackpot, 
                hand_data.jackpot if profit > 0 else 0.0, hand_data.went_to_showdown,
                hero_hole_cards, board_cards, stakes, hero_seat, hero_position, preflop_hero_last_raise)
        
    except Exception as e:
        logger.error(f"Error in legacy parse_hand: {e}")
        return (0.0, f"Error: {e}", 0.0, False, 0.0, 0.0, 0.0, False, "", "", "", None, "", False)

def parse_file(text: str) -> List[Tuple]:
    """Legacy parse_file function for backward compatibility"""
    try:
        hands = re.split(r'(?=Poker Hand #)', text)
        results = []
        for hand in hands:
            if hand.strip():
                result = parse_hand(hand)
                results.append(result)
        return results
    except Exception as e:
        logger.error(f"Error parsing file: {e}")
        return []
