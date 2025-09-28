import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from comprehensive_parser import HandData, Player, Action
import logging

logger = logging.getLogger(__name__)


@dataclass
class PlayerStats:
    """Comprehensive player statistics"""
    player_name: str
    hands_played: int = 0
    
    # Preflop stats
    vpip: float = 0.0
    pfr: float = 0.0
    vpip_pfr_gap: float = 0.0
    three_bet: float = 0.0
    four_bet: float = 0.0
    cold_four_bet: float = 0.0
    fold_to_three_bet: float = 0.0
    call_three_bet: float = 0.0
    three_bet_vs_steal: float = 0.0
    steal_attempt: float = 0.0
    steal_defense: float = 0.0
    open_raise: float = 0.0
    limp: float = 0.0
    limp_raise: float = 0.0
    fold_to_raise: float = 0.0
    squeeze: float = 0.0
    
    # Postflop stats
    cbet_flop: float = 0.0
    cbet_turn: float = 0.0
    cbet_river: float = 0.0
    fold_to_cbet_flop: float = 0.0
    fold_to_cbet_turn: float = 0.0
    fold_to_cbet_river: float = 0.0
    donk_bet: float = 0.0
    check_raise_flop: float = 0.0
    check_raise_turn: float = 0.0
    check_raise_river: float = 0.0
    aggression_factor: float = 0.0
    aggression_frequency: float = 0.0
    
    # Showdown stats
    wtsd: float = 0.0  # Went to Showdown
    wsd: float = 0.0   # Won Showdown
    wsd_amount: float = 0.0  # Won $ at Showdown
    
    # Money stats
    net_won: float = 0.0
    bb_per_100: float = 0.0
    vpip_hands: int = 0
    pfr_hands: int = 0
    three_bet_opportunities: int = 0
    cbet_opportunities: int = 0
    
    # Positional stats
    vpip_utg: float = 0.0
    vpip_mp: float = 0.0
    vpip_co: float = 0.0
    vpip_btn: float = 0.0
    vpip_sb: float = 0.0
    vpip_bb: float = 0.0
    
    pfr_utg: float = 0.0
    pfr_mp: float = 0.0
    pfr_co: float = 0.0
    pfr_btn: float = 0.0
    pfr_sb: float = 0.0
    pfr_bb: float = 0.0
    
    # Stack depth stats
    vpip_shallow: float = 0.0  # <=20BB
    vpip_mid: float = 0.0      # 20-50BB
    vpip_deep: float = 0.0     # >100BB
    
    # Bet sizing stats
    bet_size_1_3_pot: float = 0.0
    bet_size_1_2_pot: float = 0.0
    bet_size_2_3_pot: float = 0.0
    bet_size_pot: float = 0.0
    bet_size_overbet: float = 0.0

class PokerStatisticsCalculator:
    """Calculate comprehensive poker statistics from hand data"""
    
    def __init__(self):
        self.player_stats: Dict[str, PlayerStats] = {}
        self.hand_data: List[HandData] = []
    
    def load_hands(self, hands: List[HandData]):
        """Load hand data for analysis"""
        self.hand_data = hands
        self._initialize_player_stats()
    
    def _initialize_player_stats(self):
        """Initialize player statistics for all unique players"""
        all_players = set()
        for hand in self.hand_data:
            for player in hand.players:
                all_players.add(player.name)
        
        for player_name in all_players:
            self.player_stats[player_name] = PlayerStats(player_name=player_name)
    
    def calculate_all_stats(self) -> Dict[str, PlayerStats]:
        """Calculate all statistics for all players"""
        for hand in self.hand_data:
            self._process_hand(hand)
        
        # Calculate final percentages
        self._calculate_final_percentages()
        
        return self.player_stats
    
    def _process_hand(self, hand: HandData):
        """Process a single hand and update player statistics"""
        # Determine which players were eligible for VPIP/PFR
        vpip_eligible = [p for p in hand.players if p.vpip_eligible]
        pfr_eligible = [p for p in hand.players if p.pfr_eligible]
        
        # Process each player in the hand
        for player in hand.players:
            if player.name not in self.player_stats:
                self.player_stats[player.name] = PlayerStats(player_name=player.name)
            
            stats = self.player_stats[player.name]
            stats.hands_played += 1
            
            # Calculate net won for this hand
            net_won = self._calculate_player_net_won(player, hand)
            stats.net_won += net_won
            
            # Update VPIP/PFR
            if player.vpip_eligible:
                stats.vpip_hands += 1
                if self._player_voluntarily_put_money_in_pot(player, hand):
                    stats.vpip += 1
            
            if player.pfr_eligible:
                stats.pfr_hands += 1
                if self._player_raised_preflop(player, hand):
                    stats.pfr += 1
            
            # Process actions for this player
            self._process_player_actions(player, hand, stats)
            
            # Update positional stats
            self._update_positional_stats(player, hand, stats)
            
            # Update stack depth stats
            self._update_stack_depth_stats(player, hand, stats)
    
    def _calculate_player_net_won(self, player: Player, hand: HandData) -> float:
        """Calculate how much a player won/lost in a hand"""
        total_contributed = 0.0
        total_collected = 0.0
        
        for action in hand.actions:
            if action.player == player.name:
                if action.action_type in ['call', 'raise', 'bet', 'post']:
                    total_contributed += action.amount
                elif 'collected' in action.action_type:
                    total_collected += action.amount
        
        return total_collected - total_contributed
    
    def _player_voluntarily_put_money_in_pot(self, player: Player, hand: HandData) -> bool:
        """Check if player voluntarily put money in pot preflop"""
        for action in hand.actions:
            if action.player == player.name and action.street == 'preflop':
                if action.action_type in ['call', 'raise', 'bet'] and action.is_voluntary:
                    return True
        return False
    
    def _player_raised_preflop(self, player: Player, hand: HandData) -> bool:
        """Check if player raised preflop"""
        for action in hand.actions:
            if action.player == player.name and action.street == 'preflop':
                if action.action_type == 'raise':
                    return True
        return False
    
    def _process_player_actions(self, player: Player, hand: HandData, stats: PlayerStats):
        """Process all actions for a player in a hand"""
        player_actions = [a for a in hand.actions if a.player == player.name]
        
        # Preflop actions
        preflop_actions = [a for a in player_actions if a.street == 'preflop']
        self._process_preflop_actions(preflop_actions, stats)
        
        # Postflop actions
        postflop_actions = [a for a in player_actions if a.street != 'preflop']
        self._process_postflop_actions(postflop_actions, stats)
        
        # Showdown stats
        if player.showdown_reached:
            stats.wtsd += 1
            if hand.winner == player.name:
                stats.wsd += 1
                stats.wsd_amount += self._calculate_player_net_won(player, hand)
    
    def _process_preflop_actions(self, actions: List[Action], stats: PlayerStats):
        """Process preflop actions for statistics"""
        # This is a simplified version - in practice, you'd need more complex logic
        # to determine 3-bet opportunities, steal attempts, etc.
        pass
    
    def _process_postflop_actions(self, actions: List[Action], stats: PlayerStats):
        """Process postflop actions for statistics"""
        # Calculate aggression factor
        bets_raises = len([a for a in actions if a.is_aggressive])
        calls = len([a for a in actions if a.action_type == 'call'])
        
        if calls > 0:
            stats.aggression_factor = bets_raises / calls
        else:
            stats.aggression_factor = bets_raises if bets_raises > 0 else 0
        
        # Calculate aggression frequency
        total_actions = len(actions)
        if total_actions > 0:
            stats.aggression_frequency = bets_raises / total_actions
    
    def _update_positional_stats(self, player: Player, hand: HandData, stats: PlayerStats):
        """Update positional statistics"""
        position = player.position.lower()
        
        if player.vpip_eligible:
            if position == 'utg':
                stats.vpip_utg += 1
            elif position == 'hijack' or position == 'mp':
                stats.vpip_mp += 1
            elif position == 'cutoff':
                stats.vpip_co += 1
            elif position == 'button':
                stats.vpip_btn += 1
            elif position == 'small blind':
                stats.vpip_sb += 1
            elif position == 'big blind':
                stats.vpip_bb += 1
    
    def _update_stack_depth_stats(self, player: Player, hand: HandData, stats: PlayerStats):
        """Update stack depth statistics"""
        stack_in_bbs = player.starting_stack / hand.big_blind if hand.big_blind > 0 else 0
        
        if player.vpip_eligible:
            if stack_in_bbs <= 20:
                stats.vpip_shallow += 1
            elif 20 < stack_in_bbs <= 50:
                stats.vpip_mid += 1
            elif stack_in_bbs > 100:
                stats.vpip_deep += 1
    
    def _calculate_final_percentages(self):
        """Calculate final percentage statistics"""
        for player_name, stats in self.player_stats.items():
            # VPIP/PFR
            if stats.vpip_hands > 0:
                stats.vpip = (stats.vpip / stats.vpip_hands) * 100
            if stats.pfr_hands > 0:
                stats.pfr = (stats.pfr / stats.pfr_hands) * 100
            
            stats.vpip_pfr_gap = stats.vpip - stats.pfr
            
            # Showdown stats
            if stats.hands_played > 0:
                stats.wtsd = (stats.wtsd / stats.hands_played) * 100
            if stats.wtsd > 0:
                stats.wsd = (stats.wsd / stats.wtsd) * 100
            
            # BB/100 calculation (simplified)
            if stats.hands_played > 0:
                # This would need big blind value from hands
                stats.bb_per_100 = (stats.net_won / stats.hands_played) * 100
    
    def generate_hud_stats(self, player_name: str) -> Dict[str, Any]:
        """Generate HUD statistics for a specific player"""
        if player_name not in self.player_stats:
            return {}
        
        stats = self.player_stats[player_name]
        
        return {
            'VPIP': f"{stats.vpip:.1f}%",
            'PFR': f"{stats.pfr:.1f}%",
            '3Bet': f"{stats.three_bet:.1f}%",
            'CBet': f"{stats.cbet_flop:.1f}%",
            'Fold to CBet': f"{stats.fold_to_cbet_flop:.1f}%",
            'AF': f"{stats.aggression_factor:.1f}",
            'WTSD': f"{stats.wtsd:.1f}%",
            'W$SD': f"{stats.wsd:.1f}%",
            'BB/100': f"{stats.bb_per_100:.1f}",
            'Hands': stats.hands_played
        }
    
    def generate_positional_report(self, player_name: str) -> pd.DataFrame:
        """Generate positional statistics report"""
        if player_name not in self.player_stats:
            return pd.DataFrame()
        
        stats = self.player_stats[player_name]
        
        data = {
            'Position': ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'],
            'VPIP': [stats.vpip_utg, stats.vpip_mp, stats.vpip_co, 
                    stats.vpip_btn, stats.vpip_sb, stats.vpip_bb],
            'PFR': [stats.pfr_utg, stats.pfr_mp, stats.pfr_co, 
                   stats.pfr_btn, stats.pfr_sb, stats.pfr_bb]
        }
        
        return pd.DataFrame(data)
    
    def generate_leak_report(self, player_name: str) -> List[str]:
        """Generate leak detection report for a player"""
        if player_name not in self.player_stats:
            return []
        
        stats = self.player_stats[player_name]
        leaks = []
        
        # VPIP leaks
        if stats.vpip > 25:
            leaks.append(f"VPIP too high: {stats.vpip:.1f}% (should be <25%)")
        elif stats.vpip < 15:
            leaks.append(f"VPIP too low: {stats.vpip:.1f}% (should be >15%)")
        
        # PFR leaks
        if stats.pfr > stats.vpip * 0.8:
            leaks.append(f"PFR too high relative to VPIP: {stats.pfr:.1f}% vs {stats.vpip:.1f}%")
        elif stats.pfr < stats.vpip * 0.6:
            leaks.append(f"PFR too low relative to VPIP: {stats.pfr:.1f}% vs {stats.vpip:.1f}%")
        
        # 3-bet leaks
        if stats.three_bet > 8:
            leaks.append(f"3-bet too high: {stats.three_bet:.1f}% (should be <8%)")
        elif stats.three_bet < 3:
            leaks.append(f"3-bet too low: {stats.three_bet:.1f}% (should be >3%)")
        
        # C-bet leaks
        if stats.cbet_flop > 80:
            leaks.append(f"C-bet flop too high: {stats.cbet_flop:.1f}% (should be <80%)")
        elif stats.cbet_flop < 50:
            leaks.append(f"C-bet flop too low: {stats.cbet_flop:.1f}% (should be >50%)")
        
        # Aggression leaks
        if stats.aggression_factor > 3:
            leaks.append(f"Too aggressive: AF {stats.aggression_factor:.1f} (should be <3)")
        elif stats.aggression_factor < 1:
            leaks.append(f"Too passive: AF {stats.aggression_factor:.1f} (should be >1)")
        
        return leaks
    
    def export_to_csv(self, filename: str = "poker_stats.csv"):
        """Export all player statistics to CSV"""
        data = []
        for player_name, stats in self.player_stats.items():
            row = {
                'Player': player_name,
                'Hands': stats.hands_played,
                'VPIP': stats.vpip,
                'PFR': stats.pfr,
                'VPIP_PFR_Gap': stats.vpip_pfr_gap,
                '3Bet': stats.three_bet,
                'CBet_Flop': stats.cbet_flop,
                'Fold_to_CBet_Flop': stats.fold_to_cbet_flop,
                'AF': stats.aggression_factor,
                'WTSD': stats.wtsd,
                'WSD': stats.wsd,
                'Net_Won': stats.net_won,
                'BB_per_100': stats.bb_per_100
            }
            data.append(row)
        
        df = pd.DataFrame(data)
        df.to_csv(filename, index=False)
        return df

def create_actions_dataframe(hands: List[HandData]) -> pd.DataFrame:
    """Create a comprehensive actions DataFrame for analysis"""
    actions_data = []
    
    for hand in hands:
        for action in hand.actions:
            actions_data.append({
                'Hand_ID': hand.hand_id,
                'Timestamp': hand.timestamp.isoformat(),
                'Site': hand.site,
                'Stakes': hand.stakes,
                'Table_Name': hand.table_name,
                'Action_Order': action.timestamp,
                'Player': action.player,
                'Action_Type': action.action_type,
                'Amount': action.amount,
                'Total_Bet': action.total_bet,
                'Street': action.street,
                'Position': action.position,
                'Pot_Before': action.pot_before,
                'Pot_After': action.pot_after,
                'Is_Voluntary': action.is_voluntary,
                'Is_Aggressive': action.is_aggressive,
                'Effective_Stack': action.effective_stack,
                'Pot_Odds': action.pot_odds,
                'Bet_Size_Ratio': action.bet_size_ratio
            })
    
    return pd.DataFrame(actions_data)

def create_hands_dataframe(hands: List[HandData]) -> pd.DataFrame:
    """Create a comprehensive hands DataFrame for analysis"""
    hands_data = []
    
    for hand in hands:
        hands_data.append({
            'Hand_ID': hand.hand_id,
            'Site': hand.site,
            'Game_Type': hand.game_type,
            'Variant': hand.variant,
            'Is_Tournament': hand.is_tournament,
            'Tournament_ID': hand.tournament_id,
            'Table_Name': hand.table_name,
            'Timestamp': hand.timestamp.isoformat(),
            'Stakes': hand.stakes,
            'Small_Blind': hand.small_blind,
            'Big_Blind': hand.big_blind,
            'Ante': hand.ante,
            'Button_Seat': hand.button_seat,
            'Number_of_Players': hand.number_of_players,
            'Board_Cards': ' '.join(hand.board_cards),
            'Flop_Cards': ' '.join(hand.flop_cards),
            'Turn_Card': hand.turn_card,
            'River_Card': hand.river_card,
            'Pot_Size': hand.pot_size,
            'Rake': hand.rake,
            'Jackpot': hand.jackpot,
            'Winner': hand.winner,
            'Winning_Hand': hand.winning_hand,
            'Hand_Rank': hand.hand_rank,
            'Went_to_Showdown': hand.went_to_showdown,
            'Is_Heads_Up': hand.is_heads_up,
            'Is_Multiway': hand.is_multiway
        })
    
    return pd.DataFrame(hands_data)
