import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class PlayerState:
    """Represents a player's state at a given point in the hand"""
    name: str
    seat: int
    stack: float
    position: str
    hole_cards: List[str] = field(default_factory=list)
    is_hero: bool = False
    is_active: bool = True
    is_all_in: bool = False
    current_bet: float = 0.0
    total_invested: float = 0.0
    cards_visible: bool = False  # Whether their cards are visible to Hero

@dataclass
class ActionStep:
    """Represents a single action in the hand"""
    action_number: int
    street: str  # 'preflop', 'flop', 'turn', 'river', 'showdown'
    player: str
    seat: int
    action_type: str  # 'fold', 'call', 'raise', 'bet', 'check', 'post', 'collect'
    amount: float
    total_bet: float  # Total bet amount for this street
    pot_before: float
    pot_after: float
    description: str  # Human-readable description
    board_cards: List[str] = field(default_factory=list)

@dataclass
class HandReplay:
    """Complete hand replay data"""
    hand_id: str
    timestamp: datetime
    table_name: str
    stakes: str
    button_seat: int
    players: List[PlayerState]
    actions: List[ActionStep]
    final_pot: float
    rake: float
    jackpot: float
    winner: str = ""
    winning_hand: str = ""
    board_cards: List[str] = field(default_factory=list)
    flop_cards: List[str] = field(default_factory=list)
    turn_card: str = ""
    river_card: str = ""

class HandReplayer:
    """Parser for creating hand replays with all player actions"""
    
    def __init__(self):
        self.positions_6max = ["Button", "Small Blind", "Big Blind", "UTG", "Hijack", "Cutoff"]
        self.positions_9max = ["Button", "SB", "BB", "UTG", "UTG+1", "MP", "MP+1", "HJ", "CO"]
    
    def parse_hand_for_replay(self, hand_text: str) -> Optional[HandReplay]:
        """Parse a hand history and create a replay object"""
        try:
            # Extract basic info
            hand_id = self._extract_hand_id(hand_text)
            timestamp = self._extract_timestamp(hand_text)
            table_name = self._extract_table_name(hand_text)
            stakes = self._extract_stakes(hand_text)
            button_seat = self._extract_button_seat(hand_text)
            
            # Extract players
            players = self._extract_players(hand_text, button_seat)
            
            # Extract board cards
            board_cards, flop_cards, turn_card, river_card = self._extract_board_cards(hand_text)
            
            # Extract all actions
            actions = self._extract_all_actions(hand_text, players)
            
            # Extract pot info
            final_pot, rake, jackpot = self._extract_pot_info(hand_text)
            
            # Extract winner
            winner, winning_hand = self._extract_winner(hand_text)
            
            return HandReplay(
                hand_id=hand_id,
                timestamp=timestamp,
                table_name=table_name,
                stakes=stakes,
                button_seat=button_seat,
                players=players,
                actions=actions,
                final_pot=final_pot,
                rake=rake,
                jackpot=jackpot,
                winner=winner,
                winning_hand=winning_hand,
                board_cards=board_cards,
                flop_cards=flop_cards,
                turn_card=turn_card,
                river_card=river_card
            )
            
        except Exception as e:
            print(f"Error parsing hand for replay: {e}")
            return None
    
    def _extract_hand_id(self, hand_text: str) -> str:
        """Extract hand ID"""
        m = re.search(r'Poker Hand #([A-Z0-9-]+)', hand_text)
        return m.group(1) if m else ""
    
    def _extract_timestamp(self, hand_text: str) -> datetime:
        """Extract timestamp"""
        m = re.search(r'(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})', hand_text)
        if m:
            return datetime.strptime(m.group(1), '%Y/%m/%d %H:%M:%S')
        return datetime.now()
    
    def _extract_table_name(self, hand_text: str) -> str:
        """Extract table name"""
        m = re.search(r"Table '([^']+)'", hand_text)
        return m.group(1) if m else ""
    
    def _extract_stakes(self, hand_text: str) -> str:
        """Extract stakes"""
        m = re.search(r'\((\$[\d\.]+\/\$[\d\.]+)\)', hand_text)
        return m.group(1) if m else ""
    
    def _extract_button_seat(self, hand_text: str) -> int:
        """Extract button seat"""
        m = re.search(r'Seat #(\d+) is the button', hand_text)
        return int(m.group(1)) if m else 1
    
    def _extract_players(self, hand_text: str, button_seat: int) -> List[PlayerState]:
        """Extract all players and their starting stacks"""
        players = []
        lines = hand_text.split('\n')
        
        for line in lines:
            if line.startswith('Seat ') and 'in chips' in line:
                m = re.search(r'Seat (\d+): ([^\(]+) \(\$([\d.]+) in chips\)', line)
                if m:
                    seat = int(m.group(1))
                    name = m.group(2).strip()
                    stack = float(m.group(3))
                    is_hero = name == 'Hero'
                    
                    # Calculate position
                    position = self._calculate_position(seat, button_seat, len(players) + 1)
                    
                    players.append(PlayerState(
                        name=name,
                        seat=seat,
                        stack=stack,
                        position=position,
                        is_hero=is_hero
                    ))
        
        # Extract hole cards for Hero (and shown cards)
        in_hole_cards = False
        for line in lines:
            if '*** HOLE CARDS ***' in line:
                in_hole_cards = True
                continue
            elif line.startswith('***') and in_hole_cards:
                break
            
            if in_hole_cards and 'Dealt to' in line:
                m = re.search(r'Dealt to ([^\[]+)\s*\[([^\]]*)\]', line)
                if m:
                    player_name = m.group(1).strip()
                    cards_str = m.group(2).strip()
                    
                    for player in players:
                        if player.name == player_name:
                            if cards_str:
                                player.hole_cards = cards_str.split()
                                if player.is_hero:
                                    player.cards_visible = True
                            break
        
        return players
    
    def _calculate_position(self, seat: int, button_seat: int, num_players: int) -> str:
        """Calculate position based on seat and button"""
        if num_players <= 6:
            positions = self.positions_6max
        else:
            positions = self.positions_9max
        
        offset = (seat - button_seat) % num_players
        return positions[min(offset, len(positions) - 1)]
    
    def _extract_board_cards(self, hand_text: str) -> Tuple[List[str], List[str], str, str]:
        """Extract board cards"""
        board_cards = []
        flop_cards = []
        turn_card = ""
        river_card = ""
        
        # Extract flop
        m = re.search(r'\*\*\* (?:FIRST )?FLOP \*\*\*\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            flop_cards = m.group(1).strip().split()
            board_cards.extend(flop_cards)
        
        # Extract turn
        m = re.search(r'\*\*\* (?:FIRST )?TURN \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            turn_card = m.group(1).strip()
            board_cards.append(turn_card)
        
        # Extract river
        m = re.search(r'\*\*\* (?:FIRST )?RIVER \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]', hand_text, re.IGNORECASE)
        if m:
            river_card = m.group(1).strip()
            board_cards.append(river_card)
        
        return board_cards, flop_cards, turn_card, river_card
    
    def _extract_all_actions(self, hand_text: str, players: List[PlayerState]) -> List[ActionStep]:
        """Extract all actions from all players"""
        actions = []
        lines = hand_text.split('\n')
        current_street = 'preflop'
        pot_size = 0.0
        action_number = 0
        current_board = []
        
        # Track current bets for each player on current street
        street_bets = {player.name: 0.0 for player in players}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Detect street changes and update board
            if '*** FLOP ***' in line or '*** FIRST FLOP ***' in line:
                current_street = 'flop'
                m = re.search(r'\[([^\]]+)\]', line)
                if m:
                    current_board = m.group(1).strip().split()
                street_bets = {player.name: 0.0 for player in players}
                continue
            elif '*** TURN ***' in line or '*** FIRST TURN ***' in line:
                current_street = 'turn'
                m = re.search(r'\[[^\]]+\]\s*\[([^\]]+)\]', line)
                if m:
                    current_board.append(m.group(1).strip())
                street_bets = {player.name: 0.0 for player in players}
                continue
            elif '*** RIVER ***' in line or '*** FIRST RIVER ***' in line:
                current_street = 'river'
                m = re.search(r'\[[^\]]+\]\s*\[([^\]]+)\]', line)
                if m:
                    current_board.append(m.group(1).strip())
                street_bets = {player.name: 0.0 for player in players}
                continue
            elif '*** SHOWDOWN ***' in line:
                current_street = 'showdown'
                continue
            elif '*** SUMMARY ***' in line:
                break
            
            # Parse action line
            if ':' in line and any(keyword in line.lower() for keyword in 
                                  ['folds', 'calls', 'raises', 'bets', 'checks', 'posts', 'collected']):
                
                parts = line.split(':', 1)
                player_name = parts[0].strip()
                action_text = parts[1].strip()
                
                # Find player
                player = next((p for p in players if p.name == player_name), None)
                if not player:
                    continue
                
                # Parse action
                action_type = 'unknown'
                amount = 0.0
                description = ""
                
                if 'posts small blind' in action_text:
                    action_type = 'post'
                    m = re.search(r'\$([\d.]+)', action_text)
                    if m:
                        amount = float(m.group(1))
                        street_bets[player_name] = amount
                        pot_size += amount
                    description = f"posts small blind ${amount:.2f}"
                
                elif 'posts big blind' in action_text:
                    action_type = 'post'
                    m = re.search(r'\$([\d.]+)', action_text)
                    if m:
                        amount = float(m.group(1))
                        street_bets[player_name] = amount
                        pot_size += amount
                    description = f"posts big blind ${amount:.2f}"
                
                elif 'folds' in action_text:
                    action_type = 'fold'
                    description = "folds"
                
                elif 'calls' in action_text:
                    action_type = 'call'
                    m = re.search(r'calls \$([\d.]+)', action_text)
                    if m:
                        amount = float(m.group(1))
                        street_bets[player_name] += amount
                        pot_size += amount
                    description = f"calls ${amount:.2f}"
                
                elif 'raises' in action_text:
                    action_type = 'raise'
                    m = re.search(r'raises \$([\d.]+) to \$([\d.]+)', action_text)
                    if m:
                        amount = float(m.group(1))
                        total_raise = float(m.group(2))
                        street_bets[player_name] = total_raise
                        pot_size += amount
                    description = f"raises to ${total_raise:.2f}"
                
                elif 'bets' in action_text:
                    action_type = 'bet'
                    m = re.search(r'bets \$([\d.]+)', action_text)
                    if m:
                        amount = float(m.group(1))
                        street_bets[player_name] = amount
                        pot_size += amount
                    description = f"bets ${amount:.2f}"
                
                elif 'checks' in action_text:
                    action_type = 'check'
                    description = "checks"
                
                elif 'collected' in action_text:
                    action_type = 'collect'
                    m = re.search(r'collected \$([\d.]+)', action_text)
                    if m:
                        amount = float(m.group(1))
                    description = f"collected ${amount:.2f}"
                
                # Create action step
                if action_type != 'unknown':
                    action_number += 1
                    actions.append(ActionStep(
                        action_number=action_number,
                        street=current_street,
                        player=player_name,
                        seat=player.seat,
                        action_type=action_type,
                        amount=amount,
                        total_bet=street_bets[player_name],
                        pot_before=pot_size - amount if amount > 0 else pot_size,
                        pot_after=pot_size,
                        description=description,
                        board_cards=current_board.copy()
                    ))
            
            # Handle uncalled bet returns
            elif 'Uncalled bet' in line and 'returned to' in line:
                m = re.search(r'Uncalled bet \$([\d.]+) returned to ([^$]+)', line)
                if m:
                    amount = float(m.group(1))
                    player_name = m.group(2).strip()
                    pot_size -= amount
                    
                    player = next((p for p in players if p.name == player_name), None)
                    if player:
                        action_number += 1
                        actions.append(ActionStep(
                            action_number=action_number,
                            street=current_street,
                            player=player_name,
                            seat=player.seat,
                            action_type='return',
                            amount=amount,
                            total_bet=0,
                            pot_before=pot_size + amount,
                            pot_after=pot_size,
                            description=f"uncalled bet ${amount:.2f} returned",
                            board_cards=current_board.copy()
                        ))
        
        return actions
    
    def _extract_pot_info(self, hand_text: str) -> Tuple[float, float, float]:
        """Extract pot, rake, and jackpot"""
        pot = 0.0
        rake = 0.0
        jackpot = 0.0
        
        # Look for summary line
        m = re.search(r'Total pot \$([\d.]+)', hand_text)
        if m:
            pot = float(m.group(1))
        
        m = re.search(r'Rake \$([\d.]+)', hand_text)
        if m:
            rake = float(m.group(1))
        
        m = re.search(r'Jackpot \$([\d.]+)', hand_text)
        if m:
            jackpot = float(m.group(1))
        
        return pot, rake, jackpot
    
    def _extract_winner(self, hand_text: str) -> Tuple[str, str]:
        """Extract winner and winning hand"""
        winner = ""
        winning_hand = ""
        
        # Look in summary section
        summary_start = hand_text.find('*** SUMMARY ***')
        if summary_start != -1:
            summary_text = hand_text[summary_start:]
            
            for line in summary_text.split('\n'):
                if 'won' in line and '$' in line:
                    m = re.search(r'Seat \d+: ([^\(]+).*?(?:with|showed) \[?([^\]]*)\]?.*?won', line)
                    if m:
                        winner = m.group(1).strip()
                        winning_hand = m.group(2).strip() if m.group(2) else ""
                        break
                    else:
                        # Simpler pattern
                        m = re.search(r'Seat \d+: ([^\(]+).*?won', line)
                        if m:
                            winner = m.group(1).strip()
                            break
        
        return winner, winning_hand
    
    def get_state_at_action(self, replay: HandReplay, action_index: int) -> Dict:
        """Get the complete game state at a specific action index"""
        # Initialize player states
        player_states = {}
        for player in replay.players:
            player_states[player.name] = {
                'name': player.name,
                'seat': player.seat,
                'position': player.position,
                'stack': player.stack,
                'current_bet': 0.0,
                'total_invested': 0.0,
                'is_active': True,
                'is_hero': player.is_hero,
                'hole_cards': player.hole_cards if player.is_hero else [],
                'cards_visible': player.is_hero
            }
        
        # Apply actions up to action_index
        pot = 0.0
        current_street = 'preflop'
        board_cards = []
        
        for i, action in enumerate(replay.actions):
            if i >= action_index:
                break
            
            current_street = action.street
            board_cards = action.board_cards
            
            player_state = player_states[action.player]
            
            if action.action_type == 'fold':
                player_state['is_active'] = False
            elif action.action_type in ['call', 'bet', 'raise', 'post']:
                player_state['stack'] -= action.amount
                player_state['current_bet'] = action.total_bet
                player_state['total_invested'] += action.amount
            elif action.action_type == 'collect':
                player_state['stack'] += action.amount
            elif action.action_type == 'return':
                player_state['stack'] += action.amount
            
            pot = action.pot_after
        
        # Get current action (if within bounds)
        current_action = replay.actions[action_index] if action_index < len(replay.actions) else None
        
        return {
            'players': list(player_states.values()),
            'pot': pot,
            'street': current_street,
            'board_cards': board_cards,
            'current_action': current_action,
            'action_index': action_index,
            'total_actions': len(replay.actions)
        }

