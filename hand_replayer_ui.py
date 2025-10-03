import streamlit as st
import pandas as pd
from hand_replayer import HandReplayer, HandReplay
from typing import Dict, List

def render_poker_table(state: Dict):
    """Render the poker table with players and current game state"""
    
    # Create a visual poker table layout
    st.markdown(f"""
    <div style='background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); 
                padding: 30px; 
                border-radius: 20px; 
                margin: 20px 0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);'>
        <div style='background: #059669; 
                    border-radius: 50%; 
                    width: 100%; 
                    padding: 40px; 
                    text-align: center;
                    border: 8px solid #047857;
                    box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.2);'>
            <h2 style='color: white; margin: 10px 0;'>POT: ${state['pot']:.2f}</h2>
            <div style='margin: 20px 0;'>
                {render_board_cards(state['board_cards'])}
            </div>
            <p style='color: #d1fae5; font-size: 18px; margin: 5px 0;'>
                {state['street'].upper()}
            </p>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Render players around the table
    render_players_grid(state['players'])
    
    # Show current action
    if state['current_action']:
        render_current_action(state['current_action'])

def render_board_cards(cards: List[str]) -> str:
    """Render board cards as HTML"""
    if not cards:
        return "<p style='color: #d1fae5; font-style: italic;'>No cards dealt yet</p>"
    
    card_html = ""
    for card in cards:
        card_html += f"<span style='background: white; color: black; padding: 8px 12px; margin: 0 5px; border-radius: 5px; font-weight: bold; font-size: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);'>{card}</span>"
    
    return card_html

def render_players_grid(players: List[Dict]):
    """Render players in a grid layout around the table"""
    # Sort by seat number
    sorted_players = sorted(players, key=lambda x: x['seat'])
    
    # Create columns for player positions
    # Top row (seats 4, 5, 6)
    cols_top = st.columns([1, 1, 1])
    top_seats = [p for p in sorted_players if p['seat'] in [4, 5, 6]]
    for i, player in enumerate(top_seats):
        with cols_top[i]:
            render_player_card(player)
    
    # Middle row (seats 3 and 1)
    cols_mid = st.columns([1, 2, 1])
    left_player = next((p for p in sorted_players if p['seat'] == 3), None)
    right_player = next((p for p in sorted_players if p['seat'] == 1), None)
    
    with cols_mid[0]:
        if left_player:
            render_player_card(left_player)
    with cols_mid[2]:
        if right_player:
            render_player_card(right_player)
    
    # Bottom row (seat 2)
    cols_bot = st.columns([1, 1, 1])
    bottom_player = next((p for p in sorted_players if p['seat'] == 2), None)
    with cols_bot[1]:
        if bottom_player:
            render_player_card(bottom_player)

def render_player_card(player: Dict):
    """Render a single player card"""
    # Determine card background color
    if not player['is_active']:
        bg_color = "#6b7280"  # Gray for folded
        text_color = "#d1d5db"
    elif player['is_hero']:
        bg_color = "#10b981"  # Green for hero
        text_color = "white"
    else:
        bg_color = "#3b82f6"  # Blue for active players
        text_color = "white"
    
    # Render hole cards if visible
    cards_html = ""
    if player['hole_cards'] and player['cards_visible']:
        for card in player['hole_cards']:
            cards_html += f"<span style='background: white; color: black; padding: 4px 8px; margin: 2px; border-radius: 3px; font-weight: bold; font-size: 14px;'>{card}</span>"
    elif player['hole_cards'] and not player['cards_visible']:
        cards_html = "<span style='background: #374151; color: #6b7280; padding: 4px 8px; margin: 2px; border-radius: 3px;'>🂠 🂠</span>"
    
    # Current bet indicator
    bet_html = ""
    if player['current_bet'] > 0:
        bet_html = f"<div style='background: #fbbf24; color: #78350f; padding: 5px 10px; border-radius: 5px; margin-top: 5px; font-weight: bold;'>Bet: ${player['current_bet']:.2f}</div>"
    
    st.markdown(f"""
    <div style='background: {bg_color}; 
                color: {text_color}; 
                padding: 15px; 
                border-radius: 10px; 
                text-align: center;
                border: 3px solid {"#fbbf24" if player['is_hero'] else "#1f2937"};
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                margin: 5px;
                min-height: 140px;'>
        <div style='font-weight: bold; font-size: 16px; margin-bottom: 5px;'>
            {player['name']} {"👤" if player['is_hero'] else ""}
        </div>
        <div style='font-size: 12px; opacity: 0.8; margin-bottom: 8px;'>
            {player['position']} | Seat {player['seat']}
        </div>
        <div style='font-weight: bold; font-size: 18px; margin-bottom: 5px;'>
            ${player['stack']:.2f}
        </div>
        <div style='margin: 5px 0;'>
            {cards_html}
        </div>
        {bet_html}
    </div>
    """, unsafe_allow_html=True)

def render_current_action(action):
    """Render the current action being displayed"""
    # Determine action color
    action_colors = {
        'fold': '#ef4444',
        'call': '#3b82f6',
        'raise': '#f59e0b',
        'bet': '#f59e0b',
        'check': '#6b7280',
        'post': '#8b5cf6',
        'collect': '#10b981',
        'return': '#14b8a6'
    }
    
    color = action_colors.get(action.action_type, '#6b7280')
    
    st.markdown(f"""
    <div style='background: {color}; 
                color: white; 
                padding: 20px; 
                border-radius: 10px; 
                text-align: center;
                margin: 20px 0;
                font-size: 20px;
                font-weight: bold;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);'>
        {action.player} {action.description}
    </div>
    """, unsafe_allow_html=True)

def render_action_history(replay: HandReplay, current_index: int):
    """Render the action history up to current point"""
    st.subheader("Action History")
    
    if current_index == 0:
        st.info("Hand is starting. Click 'Next' to see the first action.")
        return
    
    # Show actions up to current index
    actions_to_show = replay.actions[:current_index]
    
    # Group by street
    streets = ['preflop', 'flop', 'turn', 'river', 'showdown']
    
    for street in streets:
        street_actions = [a for a in actions_to_show if a.street == street]
        if street_actions:
            with st.expander(f"**{street.upper()}** ({len(street_actions)} actions)", expanded=(street == actions_to_show[-1].street if actions_to_show else False)):
                for action in street_actions:
                    # Highlight current action
                    if action.action_number == current_index:
                        st.markdown(f"**→ {action.action_number}. {action.player}: {action.description}** (Pot: ${action.pot_after:.2f})")
                    else:
                        st.text(f"{action.action_number}. {action.player}: {action.description} (Pot: ${action.pot_after:.2f})")

def render_hand_info(replay: HandReplay):
    """Render hand information header"""
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Hand ID", replay.hand_id[-10:])
    
    with col2:
        st.metric("Table", replay.table_name)
    
    with col3:
        st.metric("Stakes", replay.stakes)
    
    with col4:
        st.metric("Final Pot", f"${replay.final_pot:.2f}")

def render_hand_replayer(replay: HandReplay):
    """Main replayer interface"""
    
    # Initialize session state for action index
    if 'action_index' not in st.session_state:
        st.session_state.action_index = 0
    
    # Reset action index when switching hands
    if 'current_hand_id' not in st.session_state or st.session_state.current_hand_id != replay.hand_id:
        st.session_state.action_index = 0
        st.session_state.current_hand_id = replay.hand_id
    
    # Ensure action_index is within bounds
    if st.session_state.action_index > len(replay.actions):
        st.session_state.action_index = len(replay.actions)
    
    # Hand information
    render_hand_info(replay)
    
    st.markdown("---")
    
    # Get current state
    replayer = HandReplayer()
    state = replayer.get_state_at_action(replay, st.session_state.action_index)
    
    # Main table visualization
    render_poker_table(state)
    
    # Navigation controls
    st.markdown("### 🎮 Replay Controls")
    st.caption("Use the buttons or slider to navigate through the hand action by action")
    col1, col2, col3, col4, col5 = st.columns([1, 1, 1, 1, 2])
    
    with col1:
        if st.button("⏮️ Start", use_container_width=True):
            st.session_state.action_index = 0
            st.rerun()
    
    with col2:
        if st.button("⬅️ Previous", use_container_width=True):
            if st.session_state.action_index > 0:
                st.session_state.action_index -= 1
                st.rerun()
    
    with col3:
        if st.button("➡️ Next", use_container_width=True):
            if st.session_state.action_index < len(replay.actions):
                st.session_state.action_index += 1
                st.rerun()
    
    with col4:
        if st.button("⏭️ End", use_container_width=True):
            st.session_state.action_index = len(replay.actions)
            st.rerun()
    
    with col5:
        # Slider for quick navigation
        new_index = st.slider(
            "Action",
            0,
            len(replay.actions),
            st.session_state.action_index,
            label_visibility="collapsed"
        )
        if new_index != st.session_state.action_index:
            st.session_state.action_index = new_index
            st.rerun()
    
    # Progress indicator
    progress = st.session_state.action_index / len(replay.actions) if len(replay.actions) > 0 else 0
    st.progress(progress)
    st.caption(f"Action {st.session_state.action_index} of {len(replay.actions)}")
    
    st.markdown("---")
    
    # Action history in sidebar or expander
    render_action_history(replay, st.session_state.action_index)
    
    # Winner info (if at end)
    if st.session_state.action_index >= len(replay.actions):
        if replay.winner:
            st.success(f"🏆 **Winner: {replay.winner}**")
            if replay.winning_hand:
                st.info(f"Winning Hand: {replay.winning_hand}")
        
        # Show final summary
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Final Pot", f"${replay.final_pot:.2f}")
        with col2:
            st.metric("Rake", f"${replay.rake:.2f}")
        with col3:
            if replay.jackpot > 0:
                st.metric("Jackpot", f"${replay.jackpot:.2f}")

def get_hands_for_selection(analyzer) -> List[Dict]:
    """Get list of hands for selection in replayer"""
    if analyzer.df is None or analyzer.df.empty:
        return []
    
    hands = []
    for _, row in analyzer.df.iterrows():
        hands.append({
            'hand_id': row['Hand_ID'],
            'timestamp': row['Timestamp'],
            'position': row['Position'],
            'hole_cards': row['Hole_Cards'],
            'profit': row['Net_Profit'],
            'pot_type': row.get('Pot_Type', 'Unknown'),
            'went_to_showdown': row['Went_to_Showdown']
        })
    
    return hands

