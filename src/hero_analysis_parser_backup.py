import os
import glob
import re
import pandas as pd
import logging
from typing import Tuple, List, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class HeroData:
    """Streamlined Hero-specific data for analysis"""
    hand_id: str
    timestamp: datetime
    site: str
    stakes: str
    table_name: str
    position: str
    hole_cards: List[str]
    
    # Key analysis metrics
    went_to_showdown: bool = False
    won_money_at_showdown: float = 0.0
    won_when_saw_flop: bool = False
    saw_flop: bool = False
    
    # Financial data
    total_contributed: float = 0.0
    total_collected: float = 0.0
    net_profit: float = 0.0
    
    # Rake analysis
    rake_amount: float = 0.0
    net_profit_before_rake: float = 0.0
    total_pot_size: float = 0.0
    
    # Hand progression
    preflop_actions: int = 0
    flop_actions: int = 0
    turn_actions: int = 0
    river_actions: int = 0
    
    # Board cards
    flop_cards: List[str] = field(default_factory=list)
    turn_card: str = ""
    river_card: str = ""
    
    # Hand strength indicators
    preflop_raised: bool = False
    preflop_called: bool = False
    vpip: bool = False  # Voluntarily Put money In Pot (excluding blinds)
    cbet_flop: bool = False
    cbet_turn: bool = False
    cbet_river: bool = False

class HeroAnalysisParser:
    """Streamlined parser focused on Hero data analysis only"""
    
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
    
    def extract_hand_id(self, hand_text: str) -> str:
        """Extract hand ID from the header"""
        m = re.search(r'Poker Hand #([A-Z0-9]+)', hand_text)
        return m.group(1) if m else ""
    
    def extract_timestamp(self, hand_text: str) -> datetime:
        """Extract timestamp from the header"""
        m = re.search(r'(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})', hand_text)
        if m:
            return datetime.strptime(m.group(1), '%Y/%m/%d %H:%M:%S')
        return datetime.now()
    
    def extract_table_name(self, hand_text: str) -> str:
        """Extract table name from the header"""
        m = re.search(r"Table '([^']+)'", hand_text)
        return m.group(1) if m else ""
    
    def extract_stakes(self, hand_text: str) -> str:
        """Extract stakes from the header"""
        m = re.search(r'\((\$[\d\.]+\/\$[\d\.]+)\)', hand_text)
        return m.group(1) if m else ""
    
    def extract_hero_position(self, hand_text: str) -> str:
        """Extract Hero's position"""
        # Find Hero's seat
        hero_seat = None
        button_seat = 1
        
        # Extract button seat
        m = re.search(r'Seat #(\d+) is the button', hand_text, re.IGNORECASE)
        if m:
            button_seat = int(m.group(1))
        
        # Find Hero's seat
        m = re.search(r'Seat (\d+): Hero', hand_text, re.IGNORECASE)
        if m:
            hero_seat = int(m.group(1))
        
        if hero_seat:
            positions = ["Button", "Small Blind", "Big Blind", "UTG", "Hijack", "Cutoff"]
            index = (hero_seat - button_seat) % len(positions)
            return positions[index]
        
        return "Unknown"
    
    def extract_hero_hole_cards(self, hand_text: str) -> List[str]:
        """Extract Hero's hole cards"""
        m = re.search(r'Dealt to Hero\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            return m.group(1).strip().split()
        return []
    
    def extract_board_cards(self, hand_text: str) -> Tuple[List[str], List[str], str, str]:
        """Extract board cards with street separation"""
        flop_cards = []
        turn_card = ""
        river_card = ""
        
        # Extract flop
        m = re.search(r'\*\*\* FLOP \*\*\*\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            flop_cards = m.group(1).strip().split()
        
        # Extract turn
        m = re.search(r'\*\*\* TURN \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            turn_card = m.group(1).strip()
        
        # Extract river
        m = re.search(r'\*\*\* RIVER \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            river_card = m.group(1).strip()
        
        board_cards = flop_cards + ([turn_card] if turn_card else []) + ([river_card] if river_card else [])
        return board_cards, flop_cards, turn_card, river_card
    
    def extract_rake_info(self, hand_text: str) -> Tuple[float, float]:
        """Extract total rake amount (including jackpot and other fees) and total pot size from summary"""
        total_rake_amount = 0.0
        total_pot_size = 0.0
        
        # Look for comprehensive summary line with all fees
        # Format: "Total pot $X.XX | Rake $Y.YY | Jackpot $Z.ZZ | Bingo $A.AA | Fortune $B.BB | Tax $C.CC"
        comprehensive_pattern = r'Total pot\s*\$([\d.]+)\s*\|\s*Rake\s*\$([\d.]+)(?:\s*\|\s*Jackpot\s*\$([\d.]+))?(?:\s*\|\s*Bingo\s*\$([\d.]+))?(?:\s*\|\s*Fortune\s*\$([\d.]+))?(?:\s*\|\s*Tax\s*\$([\d.]+))?'
        m = re.search(comprehensive_pattern, hand_text, re.IGNORECASE)
        
        if m:
            total_pot_size = float(m.group(1))
            rake_amount = float(m.group(2))
            jackpot_amount = float(m.group(3)) if m.group(3) else 0.0
            bingo_amount = float(m.group(4)) if m.group(4) else 0.0
            fortune_amount = float(m.group(5)) if m.group(5) else 0.0
            tax_amount = float(m.group(6)) if m.group(6) else 0.0
            
            # Sum all fees as total rake
            total_rake_amount = rake_amount + jackpot_amount + bingo_amount + fortune_amount + tax_amount
        else:
            # Fallback: Look for individual fee patterns
            fee_patterns = [
                (r'Rake\s*\$([\d.]+)', 'rake'),
                (r'Jackpot\s*\$([\d.]+)', 'jackpot'),
                (r'Bingo\s*\$([\d.]+)', 'bingo'),
                (r'Fortune\s*\$([\d.]+)', 'fortune'),
                (r'Tax\s*\$([\d.]+)', 'tax'),
                (r'Rake taken:\s*\$([\d.]+)', 'rake'),
                (r'Rake:\s*\$([\d.]+)', 'rake')
            ]
            
            for pattern, fee_type in fee_patterns:
                m = re.search(pattern, hand_text, re.IGNORECASE)
                if m:
                    amount = float(m.group(1))
                    total_rake_amount += amount
            
            # Try to find total pot size separately
            pot_patterns = [
                r'Total pot\s*\$([\d.]+)',
                r'Pot size\s*\$([\d.]+)',
                r'Total\s*\$([\d.]+)'
            ]
            
            for pattern in pot_patterns:
                m = re.search(pattern, hand_text, re.IGNORECASE)
                if m:
                    total_pot_size = float(m.group(1))
                    break
        
        return total_rake_amount, total_pot_size
    
    def analyze_hero_actions(self, hand_text: str) -> Dict[str, Any]:
        """Clean version of analyze_hero_actions without debug output"""
        hero_pattern = re.compile(r'^(?:Hero\b|Seat\s+\d+:\s*Hero\b)', re.IGNORECASE)
        street_marker = re.compile(r'^\*\*\*')
        
        actions = {
            'total_contributed': 0.0,
            'total_collected': 0.0,
            'preflop_actions': 0,
            'flop_actions': 0,
            'turn_actions': 0,
            'river_actions': 0,
            'preflop_raised': False,
            'preflop_called': False,
            'vpip': False,  # Voluntarily Put money In Pot (excluding blinds)
            'cbet_flop': False,
            'cbet_turn': False,
            'cbet_river': False,
            'went_to_showdown': False,
            'won_money_at_showdown': 0.0,
            'saw_flop': False,
            'rake_amount': 0.0,
            'total_pot_size': 0.0
        }
        
        current_street = 'preflop'
        current_round = 0.0
        
        for line in hand_text.splitlines():
            line = line.strip()
            if not line:
                continue
            
            # Detect street changes
            if street_marker.match(line):
                if "HOLE CARDS" not in line.upper():
                    # Extract street name from markers like "*** FIRST FLOP ***", "*** TURN ***", etc.
                    street_line = line.replace('***', '').replace('*', '').strip()
                    
                    # Normalize street names
                    if 'flop' in street_line.lower():
                        current_street = 'flop'
                    elif 'turn' in street_line.lower():
                        current_street = 'turn'
                    elif 'river' in street_line.lower():
                        current_street = 'river'
                    elif 'showdown' in street_line.lower():
                        current_street = 'showdown'
                    else:
                        current_street = street_line.lower()
                    
                    current_round = 0.0
                continue
            
            # Handle uncalled bet returns FIRST (before Hero action processing)
            # This covers scenarios where Hero bets and villain folds
            if "uncalled bet" in line.lower() and "returned to hero" in line.lower():
                # Multiple patterns to catch different formats
                patterns = [
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to hero',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to Hero',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to HERO',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to Hero\b',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to Hero\s*$'
                ]
                
                for pattern in patterns:
                    m = re.search(pattern, line, re.IGNORECASE)
                    if m:
                        amount = float(m.group(1))
                        actions['total_collected'] += amount
                        break  # Found match, stop searching
            
            elif hero_pattern.search(line):
                # Track street-specific actions
                if current_street == 'preflop':
                    actions['preflop_actions'] += 1
                elif current_street == 'flop':
                    actions['flop_actions'] += 1
                    actions['saw_flop'] = True
                elif current_street == 'turn':
                    actions['turn_actions'] += 1
                elif current_street == 'river':
                    actions['river_actions'] += 1
                
                # Analyze specific actions
                if "collected" in line and "from pot" in line:
                    m = re.search(r'collected\s*\(?\$([\d.]+)\)?', line, re.IGNORECASE)
                    if m:
                        amount = float(m.group(1))
                        actions['total_collected'] += amount
                        actions['won_money_at_showdown'] += amount
                
                elif "posts" in line:
                    m = re.search(r'\$([\d.]+)', line)
                    if m:
                        amount = float(m.group(1))
                        actions['total_contributed'] += amount
                        current_round += amount
                
                elif "calls" in line:
                    actions['preflop_called'] = True
                    actions['vpip'] = True  # VPIP: voluntarily put money in pot
                    m = re.search(r'\$([\d.]+)', line)
                    if m:
                        amount = float(m.group(1))
                        actions['total_contributed'] += amount
                        current_round += amount
                
                elif "bets" in line:
                    actions['vpip'] = True  # VPIP: voluntarily put money in pot
                    m = re.search(r'\$([\d.]+)', line)
                    if m:
                        amount = float(m.group(1))
                        actions['total_contributed'] += amount
                        current_round += amount
                        
                        # Check for continuation bets
                        if current_street == 'flop':
                            actions['cbet_flop'] = True
                        elif current_street == 'turn':
                            actions['cbet_turn'] = True
                        elif current_street == 'river':
                            actions['cbet_river'] = True
                
                elif "raises" in line:
                    actions['preflop_raised'] = True
                    actions['vpip'] = True  # VPIP: voluntarily put money in pot
                    m = re.search(r'to\s*\$([\d.]+)', line, re.IGNORECASE)
                    if m:
                        new_total = float(m.group(1))
                        additional = new_total - current_round
                        if additional < 0:
                            additional = 0
                        actions['total_contributed'] += additional
                        current_round = new_total
                
                elif "shows" in line or "showed" in line:
                    actions['went_to_showdown'] = True
        
        # Check if went to showdown
        if not actions['went_to_showdown']:
            actions['went_to_showdown'] = bool(re.search(r'(?mi)^(?:Hero\b|Seat\s+\d+:\s*Hero\b).*?(shows|showed)', hand_text))
        
        # Extract rake information
        rake_amount, total_pot_size = self.extract_rake_info(hand_text)
        actions['rake_amount'] = rake_amount
        actions['total_pot_size'] = total_pot_size
        
        # Calculate net profit
        actions['net_profit'] = actions['total_collected'] - actions['total_contributed']
        
        # Calculate net profit before rake (only add rake back if Hero collected money)
        if actions['total_collected'] > 0:
            # Hero won money, so rake was taken from their winnings
            actions['net_profit_before_rake'] = actions['net_profit'] + rake_amount
        else:
            # Hero lost, so rake was taken from other players, not from Hero
            actions['net_profit_before_rake'] = actions['net_profit']
        
        # Determine if won when saw flop
        actions['won_when_saw_flop'] = actions['saw_flop'] and actions['net_profit'] > 0
        
        return actions

    def analyze_hero_actions_debug(self, hand_text: str) -> Dict[str, Any]:
        """Debug version of analyze_hero_actions with comprehensive logging"""
        hero_pattern = re.compile(r'^(?:Hero\b|Seat\s+\d+:\s*Hero\b)', re.IGNORECASE)
        street_marker = re.compile(r'^\*\*\*')
        
        actions = {
            'total_contributed': 0.0,
            'total_collected': 0.0,
            'preflop_actions': 0,
            'flop_actions': 0,
            'turn_actions': 0,
            'river_actions': 0,
            'preflop_raised': False,
            'preflop_called': False,
            'vpip': False,  # Voluntarily Put money In Pot (excluding blinds)
            'cbet_flop': False,
            'cbet_turn': False,
            'cbet_river': False,
            'went_to_showdown': False,
            'won_money_at_showdown': 0.0,
            'saw_flop': False,
            'rake_amount': 0.0,
            'total_pot_size': 0.0,
            'action_details': []  # Store detailed action info
        }
        
        current_street = 'preflop'
        current_round = 0.0
        hero_actions_count = 0
        
        print(f"\n COMPREHENSIVE DEBUGGING - PROFIT CALCULATION")
        print(f"{'='*60}")
        print(f" Hand ID: {self.extract_hand_id(hand_text)}")
        print(f"🎯 Hero Position: {self.extract_hero_position(hand_text)}")
        print(f" Hole Cards: {' '.join(self.extract_hero_hole_cards(hand_text))}")
        print(f" Stakes: {self.extract_stakes(hand_text)}")
        print(f"{'='*60}")
        
        for line_num, line in enumerate(hand_text.splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            
            # Detect street changes
            if street_marker.match(line):
                if "HOLE CARDS" not in line.upper():
                    old_street = current_street
                    # Extract street name from markers like "*** FIRST FLOP ***", "*** TURN ***", etc.
                    street_line = line.replace('***', '').replace('*', '').strip()
                    
                    # Normalize street names
                    if 'flop' in street_line.lower():
                        current_street = 'flop'
                    elif 'turn' in street_line.lower():
                        current_street = 'turn'
                    elif 'river' in street_line.lower():
                        current_street = 'river'
                    elif 'showdown' in street_line.lower():
                        current_street = 'showdown'
                    else:
                        current_street = street_line.lower()
                    
                    current_round = 0.0
                    print(f"\n📍 STREET CHANGE: {old_street.upper()} → {current_street.upper()}")
                    print(f"   Round total reset to: ${current_round:.2f}")
                continue
            
            if hero_pattern.search(line):
                hero_actions_count += 1
                print(f"\n🎯 HERO ACTION #{hero_actions_count} (Line {line_num}):")
                print(f"   Raw line: {line}")
                print(f"   Current street: {current_street.upper()}")
                print(f"   Current round total: ${current_round:.2f}")
                print(f"   Total contributed so far: ${actions['total_contributed']:.2f}")
                print(f"   Total collected so far: ${actions['total_collected']:.2f}")
                
                # Track street-specific actions
                if current_street == 'preflop':
                    actions['preflop_actions'] += 1
                elif current_street == 'flop':
                    actions['flop_actions'] += 1
                    actions['saw_flop'] = True
                elif current_street == 'turn':
                    actions['turn_actions'] += 1
                elif current_street == 'river':
                    actions['river_actions'] += 1
                
                # Analyze specific actions with detailed logging
                action_detail = {
                    'line_num': line_num,
                    'street': current_street,
                    'action': line,
                    'amount': 0.0,
                    'type': 'unknown'
                }
                
                if "collected" in line and "from pot" in line:
                    m = re.search(r'collected\s*\(?\$([\d.]+)\)?', line, re.IGNORECASE)
                    if m:
                        amount = float(m.group(1))
                        actions['total_collected'] += amount
                        actions['won_money_at_showdown'] += amount
                        action_detail['amount'] = amount
                        action_detail['type'] = 'collection'
                        print(f"   💰 COLLECTED: ${amount:.2f}")
                        print(f"   📊 Running total collected: ${actions['total_collected']:.2f}")
                        print(f"   🏆 Won at showdown: ${actions['won_money_at_showdown']:.2f}")
                
                elif "posts" in line:
                    m = re.search(r'\$([\d.]+)', line)
                    if m:
                        amount = float(m.group(1))
                        actions['total_contributed'] += amount
                        current_round += amount
                        action_detail['amount'] = amount
                        action_detail['type'] = 'post'
                        print(f"   📮 POST: ${amount:.2f}")
                        print(f"   📊 Round total: ${current_round:.2f}")
                        print(f"   📊 Total contributed: ${actions['total_contributed']:.2f}")
                
                elif "calls" in line:
                    actions['preflop_called'] = True
                    actions['vpip'] = True  # VPIP: voluntarily put money in pot
                    m = re.search(r'\$([\d.]+)', line)
                    if m:
                        amount = float(m.group(1))
                        actions['total_contributed'] += amount
                        current_round += amount
                        action_detail['amount'] = amount
                        action_detail['type'] = 'call'
                        print(f"   📞 CALL: ${amount:.2f}")
                        print(f"   📊 Round total: ${current_round:.2f}")
                        print(f"   📊 Total contributed: ${actions['total_contributed']:.2f}")
                
                elif "bets" in line:
                    actions['vpip'] = True  # VPIP: voluntarily put money in pot
                    m = re.search(r'\$([\d.]+)', line)
                    if m:
                        amount = float(m.group(1))
                        actions['total_contributed'] += amount
                        current_round += amount
                        action_detail['amount'] = amount
                        action_detail['type'] = 'bet'
                        print(f"   🎯 BET: ${amount:.2f}")
                        print(f"   📊 Round total: ${current_round:.2f}")
                        print(f"   📊 Total contributed: ${actions['total_contributed']:.2f}")
                        
                        # Check for continuation bets
                        if current_street == 'flop':
                            actions['cbet_flop'] = True
                            print(f"   🔄 C-BET FLOP detected!")
                        elif current_street == 'turn':
                            actions['cbet_turn'] = True
                            print(f"   🔄 C-BET TURN detected!")
                        elif current_street == 'river':
                            actions['cbet_river'] = True
                            print(f"   🔄 C-BET RIVER detected!")
                
                elif "raises" in line:
                    actions['preflop_raised'] = True
                    actions['vpip'] = True  # VPIP: voluntarily put money in pot
                    m = re.search(r'to\s*\$([\d.]+)', line, re.IGNORECASE)
                    if m:
                        new_total = float(m.group(1))
                        additional = new_total - current_round
                        if additional < 0:
                            additional = 0
                        actions['total_contributed'] += additional
                        current_round = new_total
                        action_detail['amount'] = additional
                        action_detail['type'] = 'raise'
                        print(f"   📈 RAISE: Additional ${additional:.2f}")
                        print(f"   📊 New round total: ${new_total:.2f}")
                        print(f"   📊 Total contributed: ${actions['total_contributed']:.2f}")
                
                elif "folds" in line:
                    action_detail['type'] = 'fold'
                    print(f"   🚫 FOLD")
                
                elif "checks" in line:
                    action_detail['type'] = 'check'
                    print(f"   ✅ CHECK")
                
                elif "shows" in line or "showed" in line:
                    actions['went_to_showdown'] = True
                    action_detail['type'] = 'show'
                    print(f"   🃏 SHOWDOWN: Hero shows cards")
                
                else:
                    print(f"   ❓ UNKNOWN ACTION: {line}")
                
                actions['action_details'].append(action_detail)
            
            # Handle uncalled bet returns FIRST (before Hero action processing)
            # This covers scenarios where Hero bets and villain folds
            elif "uncalled bet" in line.lower() and "returned to hero" in line.lower():
                # Multiple patterns to catch different formats
                patterns = [
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to hero',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to Hero',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to HERO',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to Hero\b',
                    r'uncalled bet\s*\(?\$([\d.]+)\)?\s*returned to Hero\s*$'
                ]
                
                for pattern in patterns:
                    m = re.search(pattern, line, re.IGNORECASE)
                    if m:
                        amount = float(m.group(1))
                        actions['total_collected'] += amount
                        print(f"\n💰 UNCALLED BET RETURN (Line {line_num}):")
                        print(f"   Raw line: {line}")
                        print(f"   Amount returned: ${amount:.2f}")
                        print(f"   📊 Running total collected: ${actions['total_collected']:.2f}")
                        print(f"   ℹ️  Note: This is a refund, not winnings")
                        break  # Found match, stop searching
        
        # Check if went to showdown
        if not actions['went_to_showdown']:
            actions['went_to_showdown'] = bool(re.search(r'(?mi)^(?:Hero\b|Seat\s+\d+:\s*Hero\b).*?(shows|showed)', hand_text))
        
        # Extract rake information
        rake_amount, total_pot_size = self.extract_rake_info(hand_text)
        actions['rake_amount'] = rake_amount
        actions['total_pot_size'] = total_pot_size
        
        # Calculate net profit
        actions['net_profit'] = actions['total_collected'] - actions['total_contributed']
        
        # Calculate net profit before rake (only add rake back if Hero collected money)
        if actions['total_collected'] > 0:
            # Hero won money, so rake was taken from their winnings
            actions['net_profit_before_rake'] = actions['net_profit'] + rake_amount
        else:
            # Hero lost, so rake was taken from other players, not from Hero
            actions['net_profit_before_rake'] = actions['net_profit']
        
        # Determine if won when saw flop
        actions['won_when_saw_flop'] = actions['saw_flop'] and actions['net_profit'] > 0
        
        print(f"\n📊 FINAL CALCULATION SUMMARY:")
        print(f"{'='*60}")
        print(f"🎯 Hero Actions Count: {hero_actions_count}")
        print(f"💰 Total Contributed: ${actions['total_contributed']:.2f}")
        print(f"💰 Total Collected:   ${actions['total_collected']:.2f}")
        print(f"📈 Net Profit:        ${actions['net_profit']:.2f}")
        print(f"💸 Total Rake (All Fees): ${actions['rake_amount']:.2f}")
        print(f"📊 Total Pot Size:    ${actions['total_pot_size']:.2f}")
        print(f"🚀 Profit Before Rake: ${actions['net_profit_before_rake']:.2f}")
        print(f"🏆 Went to Showdown:  {actions['went_to_showdown']}")
        print(f"💵 Won at Showdown:   ${actions['won_money_at_showdown']:.2f}")
        print(f"👀 Saw Flop:          {actions['saw_flop']}")
        print(f"🎉 Won When Saw Flop: {actions['won_when_saw_flop']}")
        print(f"📊 Street Actions:    PF:{actions['preflop_actions']} F:{actions['flop_actions']} T:{actions['turn_actions']} R:{actions['river_actions']}")
        print(f" C-Bets:            F:{actions['cbet_flop']} T:{actions['cbet_turn']} R:{actions['cbet_river']}")
        print(f" Preflop:           Raised:{actions['preflop_raised']} Called:{actions['preflop_called']}")
        
        print(f"\n📋 DETAILED ACTION BREAKDOWN:")
        print(f"{'='*60}")
        for i, action in enumerate(actions['action_details'], 1):
            print(f"{i:2d}. {action['street'].upper():8} | {action['type'].upper():8} | ${action['amount']:6.2f} | Line {action['line_num']:3d}")
        
        return actions
    
    def parse_hand(self, hand_text: str) -> HeroData:
        """Parse a single hand and extract Hero-specific data"""
        try:
            # Extract basic info
            hand_id = self.extract_hand_id(hand_text)
            timestamp = self.extract_timestamp(hand_text)
            site = self.extract_site(hand_text)
            table_name = self.extract_table_name(hand_text)
            stakes = self.extract_stakes(hand_text)
            position = self.extract_hero_position(hand_text)
            hole_cards = self.extract_hero_hole_cards(hand_text)
            
            # Extract board cards
            board_cards, flop_cards, turn_card, river_card = self.extract_board_cards(hand_text)
            
            # Analyze Hero's actions - USE CLEAN VERSION
            action_data = self.analyze_hero_actions(hand_text)
            
            return HeroData(
                hand_id=hand_id,
                timestamp=timestamp,
                site=site,
                stakes=stakes,
                table_name=table_name,
                position=position,
                hole_cards=hole_cards,
                went_to_showdown=action_data['went_to_showdown'],
                won_money_at_showdown=action_data['won_money_at_showdown'],
                won_when_saw_flop=action_data['won_when_saw_flop'],
                saw_flop=action_data['saw_flop'],
                total_contributed=action_data['total_contributed'],
                total_collected=action_data['total_collected'],
                net_profit=action_data['net_profit'],
                rake_amount=action_data['rake_amount'],
                net_profit_before_rake=action_data['net_profit_before_rake'],
                total_pot_size=action_data['total_pot_size'],
                preflop_actions=action_data['preflop_actions'],
                flop_actions=action_data['flop_actions'],
                turn_actions=action_data['turn_actions'],
                river_actions=action_data['river_actions'],
                flop_cards=flop_cards,
                turn_card=turn_card,
                river_card=river_card,
                preflop_raised=action_data['preflop_raised'],
                preflop_called=action_data['preflop_called'],
                vpip=action_data['vpip'],
                cbet_flop=action_data['cbet_flop'],
                cbet_turn=action_data['cbet_turn'],
                cbet_river=action_data['cbet_river']
            )
            
        except Exception as e:
            logger.error(f"Error parsing hand: {e}")
            return HeroData(
                hand_id="",
                timestamp=datetime.now(),
                site="Unknown",
                stakes="",
                table_name="",
                position="Unknown",
                hole_cards=[]
            )
    
    def parse_file(self, text: str) -> List[HeroData]:
        """Parse a file containing multiple hands"""
        try:
            hands = re.split(r'(?=Poker Hand #)', text)
            results = []
            for hand in hands:
                if hand.strip():
                    result = self.parse_hand(hand)
                    results.append(result)
            return results
        except Exception as e:
            logger.error(f"Error parsing file: {e}")
            return []
    
    def process_files(self, folder_path: str) -> pd.DataFrame:
        """Process all hand history files and return a DataFrame"""
        try:
            file_pattern = os.path.join(folder_path, '**', '*.txt')
            all_files = glob.glob(file_pattern, recursive=True)
            
            if not all_files:
                logger.warning(f"No .txt files found in {folder_path}")
                return pd.DataFrame()
            
            logger.info(f"Found {len(all_files)} files to process")
            
            all_hands = []
            
            for filepath in all_files:
                try:
                    logger.info(f"Processing file: {os.path.basename(filepath)}")
                    with open(filepath, 'r', encoding='utf-8') as f:
                        text = f.read()
                    
                    hands = self.parse_file(text)
                    all_hands.extend(hands)
                    
                except Exception as e:
                    logger.error(f"Error processing file {filepath}: {e}")
                    continue
            
            if not all_hands:
                logger.warning("No hands processed")
                return pd.DataFrame()
            
            # Convert to DataFrame
            data = []
            for hand in all_hands:
                data.append({
                    'Hand_ID': hand.hand_id,
                    'Timestamp': hand.timestamp,
                    'Site': hand.site,
                    'Stakes': hand.stakes,
                    'Table_Name': hand.table_name,
                    'Position': hand.position,
                    'Hole_Cards': ' '.join(hand.hole_cards),
                    'Went_to_Showdown': hand.went_to_showdown,
                    'Won_Money_at_Showdown': hand.won_money_at_showdown,
                    'Won_When_Saw_Flop': hand.won_when_saw_flop,
                    'Saw_Flop': hand.saw_flop,
                    'Total_Contributed': hand.total_contributed,
                    'Total_Collected': hand.total_collected,
                    'Net_Profit': hand.net_profit,
                    'Rake_Amount': hand.rake_amount,
                    'Net_Profit_Before_Rake': hand.net_profit_before_rake,
                    'Total_Pot_Size': hand.total_pot_size,
                    'Preflop_Actions': hand.preflop_actions,
                    'Flop_Actions': hand.flop_actions,
                    'Turn_Actions': hand.turn_actions,
                    'River_Actions': hand.river_actions,
                    'Flop_Cards': ' '.join(hand.flop_cards),
                    'Turn_Card': hand.turn_card,
                    'River_Card': hand.river_card,
                    'Preflop_Raised': hand.preflop_raised,
                    'Preflop_Called': hand.preflop_called,
                    'VPIP': hand.vpip,
                    'CBet_Flop': hand.cbet_flop,
                    'CBet_Turn': hand.cbet_turn,
                    'CBet_River': hand.cbet_river
                })
            
            df = pd.DataFrame(data)
            df = df.sort_values('Timestamp')
            
            # Add running totals
            df['Running_Profit'] = df['Net_Profit'].cumsum()
            df['Running_Profit_Before_Rake'] = df['Net_Profit_Before_Rake'].cumsum()
            df['Running_Rake'] = df['Rake_Amount'].cumsum()
            df['Hand_Number'] = range(1, len(df) + 1)
            
            logger.info(f"Successfully processed {len(df)} hands")
            return df
            
        except Exception as e:
            logger.error(f"Error in process_files: {e}")
            return pd.DataFrame()

def main():
    """Main function for testing the parser"""
    parser = HeroAnalysisParser()
    
    # Process files
    df = parser.process_files("hand_histories")
    
    if not df.empty:
        print(f"Processed {len(df)} hands")
        print("\nSample data:")
        print(df.head())
        
        print("\nSummary statistics:")
        print(f"Total hands: {len(df)}")
        print(f"Total profit (after rake): ${df['Net_Profit'].sum():.2f}")
        print(f"Total profit (before rake): ${df['Net_Profit_Before_Rake'].sum():.2f}")
        print(f"Total rake paid: ${df['Rake_Amount'].sum():.2f}")
        print(f"Average rake per hand: ${df['Rake_Amount'].mean():.2f}")
        print(f"Rake percentage: {(df['Rake_Amount'].sum() / df['Total_Pot_Size'].sum() * 100):.2f}%")
        print(f"Went to showdown: {df['Went_to_Showdown'].sum()} ({df['Went_to_Showdown'].mean()*100:.1f}%)")
        print(f"Won when saw flop: {df['Won_When_Saw_Flop'].sum()} ({df['Won_When_Saw_Flop'].mean()*100:.1f}%)")
        print(f"Average profit per hand (after rake): ${df['Net_Profit'].mean():.2f}")
        print(f"Average profit per hand (before rake): ${df['Net_Profit_Before_Rake'].mean():.2f}")
        
        # Save to CSV
        output_file = "hero_analysis_data.csv"
        df.to_csv(output_file, index=False)
        print(f"\nData saved to {output_file}")
    else:
        print("No data processed")

if __name__ == "__main__":
    main()
