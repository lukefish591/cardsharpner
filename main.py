import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
import glob
import re
from hero_analysis_parser import HeroAnalysisParser
from datetime import datetime, timedelta

# Page configuration
st.set_page_config(
    page_title="CardSharp - Hero Poker Analysis",
    page_icon="♠️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    /* Main metrics styling */
    [data-testid="stMetricValue"] {
        font-size: 24px;
        font-weight: 600;
    }
    
    [data-testid="stMetricLabel"] {
        font-size: 14px;
        font-weight: 500;
        color: #374151;
    }
    
    /* Chart containers with shadows */
    .stPlotlyChart {
        padding: 20px;
        border-radius: 12px;
        margin: 10px 0;
    }
    
    /* Section containers */
    .section-container {
        background: white;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        margin: 15px 0;
    }
    
    .stat-highlight {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 15px;
        border-radius: 10px;
        color: white;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    
    /* Headers */
    h1 {
        color: #1f2937;
        font-weight: 700;
        margin-bottom: 10px;
    }
    
    h2 {
        color: #374151;
        font-weight: 600;
        margin-top: 30px;
        margin-bottom: 15px;
    }
    
    h3 {
        color: #4b5563;
        font-weight: 600;
        margin-top: 20px;
    }
    
    /* Metric cards with hover effect */
    div[data-testid="metric-container"] {
        background: #f9fafb;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        transition: all 0.3s ease;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    
    div[data-testid="metric-container"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border-color: #3b82f6;
    }
    
    /* Sidebar styling */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%);
    }
    
    [data-testid="stSidebar"] img {
        margin-top: 10px;
        margin-bottom: 10px;
        border-radius: 8px;
        background-color: transparent;
        padding: 10px;
    }
    
    /* Fix vertical alignment for hand images */
    .stImage img {
        vertical-align: middle;
        margin-top: 0;
        margin-bottom: 0;
    }
    
    [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] {
        color: white;
    }
    
    [data-testid="stSidebar"] h2 {
        color: white !important;
        font-weight: 700;
    }
    
    [data-testid="stSidebar"] label {
        color: #e0e7ff !important;
    }
    
    [data-testid="stSidebar"] .stCheckbox label {
        color: white !important;
    }
    
    [data-testid="stSidebar"] input {
        background-color: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
    }
    
    /* Button styling */
    .stButton>button {
        background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 24px;
        font-weight: 600;
        box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
        transition: all 0.3s ease;
    }
    
    .stButton>button:hover {
        background: linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%);
        box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
        transform: translateY(-1px);
    }
    
    .profit-positive {
        color: #10b981;
        font-weight: bold;
    }
    
    .profit-negative {
        color: #ef4444;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

class HeroDataAnalyzer:
    def __init__(self):
        self.parser = HeroAnalysisParser()
        self.df = None
    
    def load_data(self, folder_path: str):
        """Load and process hand history data from folder"""
        with st.spinner("Loading and analyzing hand histories..."):
            self.df = self.parser.process_files(folder_path)
        return not self.df.empty
    
    def load_uploaded_files(self, uploaded_files):
        """Load and process hand history data from uploaded files"""
        with st.spinner(f"Processing {len(uploaded_files)} uploaded file(s)..."):
            all_hands = []
            
            for uploaded_file in uploaded_files:
                try:
                    # Read the file content
                    text = uploaded_file.read().decode('utf-8')
                    
                    # Parse the file
                    hands = self.parser.parse_file(text)
                    all_hands.extend(hands)
                    
                except Exception as e:
                    st.warning(f"Error processing {uploaded_file.name}: {e}")
                    continue
            
            if not all_hands:
                st.error("No hands could be processed from uploaded files")
                return False
            
            # Convert to DataFrame (same logic as in parser.process_files)
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
                    'Won_at_Showdown': hand.won_at_showdown,
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
                    'Three_Bet': hand.three_bet,
                    'Four_Bet': hand.four_bet,
                    'Three_Bet_Opportunity': hand.three_bet_opportunity,
                    'Four_Bet_Opportunity': hand.four_bet_opportunity,
                    'Pot_Type': hand.pot_type,
                    'CBet_Flop': hand.cbet_flop,
                    'CBet_Turn': hand.cbet_turn,
                    'CBet_River': hand.cbet_river,
                    'CBet_Flop_Opportunity': hand.cbet_flop_opportunity,
                    'CBet_Turn_Opportunity': hand.cbet_turn_opportunity,
                    'CBet_River_Opportunity': hand.cbet_river_opportunity,
                    'Raw_Text': hand.raw_text
                })
            
            self.df = pd.DataFrame(data)
            self.df = self.df.sort_values('Timestamp')
            
            # Add running totals
            self.df['Running_Profit'] = self.df['Net_Profit'].cumsum()
            self.df['Running_Profit_Before_Rake'] = self.df['Net_Profit_Before_Rake'].cumsum()
            self.df['Running_Rake'] = self.df['Rake_Amount'].cumsum()
            self.df['Hand_Number'] = range(1, len(self.df) + 1)
            
            return True

    
    
    def calculate_key_metrics(self):
        """Calculate key performance metrics"""
        if self.df is None or self.df.empty:
            return {}
        
        total_hands = len(self.df)
        total_profit = self.df['Net_Profit'].sum()
        total_profit_before_rake = self.df['Net_Profit_Before_Rake'].sum()
        total_rake = self.df['Rake_Amount'].sum()
        avg_profit = self.df['Net_Profit'].mean()
        avg_profit_before_rake = self.df['Net_Profit_Before_Rake'].mean()
        avg_rake = self.df['Rake_Amount'].mean()
        total_pot_size = self.df['Total_Pot_Size'].sum()
        rake_percentage = (total_rake / total_pot_size * 100) if total_pot_size > 0 else 0
        
        # VPIP metrics (separate from PFR)
        vpip_hands = self.df['VPIP'].sum()
        vpip_rate = (vpip_hands / total_hands) * 100 if total_hands > 0 else 0
        
        # Flop metrics
        saw_flop = self.df['Saw_Flop'].sum()
        flop_rate = (saw_flop / total_hands) * 100 if total_hands > 0 else 0
        
        won_when_saw_flop = self.df['Won_When_Saw_Flop'].sum()
        flop_win_rate = (won_when_saw_flop / saw_flop) * 100 if saw_flop > 0 else 0
        
        # Showdown metrics (only calculated on hands where Hero saw flop)
        went_to_showdown = self.df['Went_to_Showdown'].sum()
        showdown_rate = (went_to_showdown / saw_flop) * 100 if saw_flop > 0 else 0
        
        # Won at showdown (W$SD) - percentage of showdowns won
        won_at_showdown = self.df['Won_at_Showdown'].sum()
        won_at_showdown_rate = (won_at_showdown / went_to_showdown) * 100 if went_to_showdown > 0 else 0
        
        # Preflop metrics
        preflop_raised = self.df['Preflop_Raised'].sum()
        preflop_raise_rate = (preflop_raised / total_hands) * 100 if total_hands > 0 else 0
        
        preflop_called = self.df['Preflop_Called'].sum()
        preflop_call_rate = (preflop_called / total_hands) * 100 if total_hands > 0 else 0
        
        # 3-bet metrics
        three_bet = self.df['Three_Bet'].sum()
        three_bet_opportunities = self.df['Three_Bet_Opportunity'].sum()
        three_bet_rate = (three_bet / three_bet_opportunities * 100) if three_bet_opportunities > 0 else 0
        
        # 4-bet metrics
        four_bet = self.df['Four_Bet'].sum()
        four_bet_opportunities = self.df['Four_Bet_Opportunity'].sum()
        four_bet_rate = (four_bet / four_bet_opportunities * 100) if four_bet_opportunities > 0 else 0
        
        # C-bet metrics
        cbet_flop = self.df['CBet_Flop'].sum()
        cbet_turn = self.df['CBet_Turn'].sum()
        cbet_river = self.df['CBet_River'].sum()
        
        # C-bet opportunities
        cbet_flop_opportunities = self.df['CBet_Flop_Opportunity'].sum()
        cbet_turn_opportunities = self.df['CBet_Turn_Opportunity'].sum()
        cbet_river_opportunities = self.df['CBet_River_Opportunity'].sum()
        
        # C-bet rates (as percentage of opportunities)
        cbet_flop_rate = (cbet_flop / cbet_flop_opportunities * 100) if cbet_flop_opportunities > 0 else 0
        cbet_turn_rate = (cbet_turn / cbet_turn_opportunities * 100) if cbet_turn_opportunities > 0 else 0
        cbet_river_rate = (cbet_river / cbet_river_opportunities * 100) if cbet_river_opportunities > 0 else 0
        
        return {
            'total_hands': total_hands,
            'total_profit': total_profit,
            'total_profit_before_rake': total_profit_before_rake,
            'total_rake': total_rake,
            'avg_profit': avg_profit,
            'avg_profit_before_rake': avg_profit_before_rake,
            'avg_rake': avg_rake,
            'rake_percentage': rake_percentage,
            'vpip_hands': vpip_hands,
            'vpip_rate': vpip_rate,
            'went_to_showdown': went_to_showdown,
            'showdown_rate': showdown_rate,
            'saw_flop': saw_flop,
            'flop_rate': flop_rate,
            'won_when_saw_flop': won_when_saw_flop,
            'flop_win_rate': flop_win_rate,
            'won_at_showdown': won_at_showdown,
            'won_at_showdown_rate': won_at_showdown_rate,
            'preflop_raised': preflop_raised,
            'preflop_raise_rate': preflop_raise_rate,
            'preflop_called': preflop_called,
            'preflop_call_rate': preflop_call_rate,
            'three_bet': three_bet,
            'three_bet_opportunities': three_bet_opportunities,
            'three_bet_rate': three_bet_rate,
            'four_bet': four_bet,
            'four_bet_opportunities': four_bet_opportunities,
            'four_bet_rate': four_bet_rate,
            'cbet_flop': cbet_flop,
            'cbet_turn': cbet_turn,
            'cbet_river': cbet_river,
            'cbet_flop_opportunities': cbet_flop_opportunities,
            'cbet_turn_opportunities': cbet_turn_opportunities,
            'cbet_river_opportunities': cbet_river_opportunities,
            'cbet_flop_rate': cbet_flop_rate,
            'cbet_turn_rate': cbet_turn_rate,
            'cbet_river_rate': cbet_river_rate
        }
    
    def render_overview_metrics(self, metrics):
        """Render overview metrics organized by category"""
        
        # Sample Stats Section with KK image
        col1, col2 = st.columns([0.2, 4])
        with col1:
            try:
                st.image("Cardsharp hand -KK.png", width=80)
            except:
                pass
        with col2:
            st.markdown("### Sample Stats")
        
        with st.container():
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("Total Hands", f"{metrics['total_hands']:,}")
            
            with col2:
                profit_color = "🟢" if metrics['total_profit'] >= 0 else "🔴"
                st.metric(f"{profit_color} Total Profit (After Rake)", f"${metrics['total_profit']:.2f}")
            
            with col3:
                st.metric("Total Profit (Before Rake)", f"${metrics['total_profit_before_rake']:.2f}")
            
            with col4:
                st.metric("Total Rake Paid", f"${metrics['total_rake']:.2f}")
        
        with st.container():
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                avg_profit_color = "🟢" if metrics['avg_profit'] >= 0 else "🔴"
                st.metric(f"{avg_profit_color} Avg Profit/Hand (After Rake)", f"${metrics['avg_profit']:.2f}")
            
            with col2:
                st.metric("Avg Profit/Hand (Before Rake)", f"${metrics['avg_profit_before_rake']:.2f}")
            
            with col3:
                st.metric("Avg Rake/Hand", f"${metrics['avg_rake']:.2f}")
            
            with col4:
                st.metric(" ", " ")  # Placeholder for alignment
        
        st.markdown("---")
        
        # Playstyle Section with 62s image
        col1, col2 = st.columns([0.2, 4])
        with col1:
            try:
                st.image("Cardhsarp 62s.png", width=80)
            except:
                pass
        with col2:
            st.markdown("### Playstyle")
        
        with st.container():
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("VPIP Rate", f"{metrics['vpip_rate']:.1f}%")
                st.metric("Preflop Raise Rate", f"{metrics['preflop_raise_rate']:.1f}%")
                st.metric("3-Bet Rate", f"{metrics['three_bet_rate']:.1f}%")
                st.metric("4-Bet Rate", f"{metrics['four_bet_rate']:.1f}%")
            
            with col2:
                st.metric("Saw Flop Rate", f"{metrics['flop_rate']:.1f}%")
                st.metric("Flop Win Rate", f"{metrics['flop_win_rate']:.1f}%")
            
            with col3:
                st.metric("Showdown Rate (of Flop)", f"{metrics['showdown_rate']:.1f}%")
                st.metric("W$SD (Won at Showdown)", f"{metrics['won_at_showdown_rate']:.1f}%")
            
            with col4:
                st.metric("C-Bet Flop Rate", f"{metrics['cbet_flop_rate']:.1f}%")
                st.metric("C-Bet Turn Rate", f"{metrics['cbet_turn_rate']:.1f}%")
                st.metric("C-Bet River Rate", f"{metrics['cbet_river_rate']:.1f}%")
    
    
    def render_showdown_analysis_chart(self):
        """Render showdown vs non-showdown winnings analysis with position and stakes filters"""
        if self.df is None or self.df.empty:
            return
        
        # Filters
        col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
        with col1:
            positions = ['All Positions'] + sorted(list(self.df['Position'].unique()))
            selected_position = st.selectbox("Filter by Position:", positions, key="results_position_filter")
        
        with col2:
            stakes = ['All Stakes'] + sorted(list(self.df['Stakes'].unique()))
            selected_stakes = st.selectbox("Filter by Stakes:", stakes, key="results_stakes_filter")
        
        with col3:
            # Define pot types in logical order
            pot_type_order = ['All Pot Types', 'Preflop Only', 'Limped Pot', 'SRP', '3-Bet Pot', '4-Bet Pot', '5+ Bet Pot']
            available_pot_types = ['All Pot Types'] + [pt for pt in pot_type_order[1:] if pt in self.df['Pot_Type'].unique()]
            selected_pot_type = st.selectbox("Filter by Pot Type:", available_pot_types, key="results_pot_type_filter")
        
        # Filter data by position, stakes, and pot type
        filtered_df = self.df.copy()
        
        if selected_position != 'All Positions':
            filtered_df = filtered_df[filtered_df['Position'] == selected_position]
        
        if selected_stakes != 'All Stakes':
            filtered_df = filtered_df[filtered_df['Stakes'] == selected_stakes]
        
        if selected_pot_type != 'All Pot Types':
            filtered_df = filtered_df[filtered_df['Pot_Type'] == selected_pot_type]
        
        if filtered_df.empty:
            filter_desc = []
            if selected_position != 'All Positions':
                filter_desc.append(f"position: {selected_position}")
            if selected_stakes != 'All Stakes':
                filter_desc.append(f"stakes: {selected_stakes}")
            if selected_pot_type != 'All Pot Types':
                filter_desc.append(f"pot type: {selected_pot_type}")
            st.warning(f"No data available for {', '.join(filter_desc)}")
            return
        
        # Calculate showdown vs non-showdown winnings
        filtered_df['Showdown_Profit'] = 0.0
        filtered_df['Non_Showdown_Profit'] = 0.0
        
        # For each hand, categorize profit based on showdown status
        for idx, row in filtered_df.iterrows():
            if row['Went_to_Showdown']:
                # Any hand that went to showdown (win or lose) goes to showdown category
                filtered_df.at[idx, 'Showdown_Profit'] = row['Net_Profit']
            else:
                # No showdown - all profit goes to non-showdown
                filtered_df.at[idx, 'Non_Showdown_Profit'] = row['Net_Profit']
        
        # Calculate cumulative values
        filtered_df['Running_Showdown_Profit'] = filtered_df['Showdown_Profit'].cumsum()
        filtered_df['Running_Non_Showdown_Profit'] = filtered_df['Non_Showdown_Profit'].cumsum()
        filtered_df['Running_Total_Profit'] = filtered_df['Net_Profit'].cumsum()
        
        # Create the chart
        fig = go.Figure()
        
        # Add non-showdown winnings (red line)
        fig.add_trace(
            go.Scatter(
                x=filtered_df['Hand_Number'], 
                y=filtered_df['Running_Non_Showdown_Profit'],
                name='Non-Showdown Winnings',
                line=dict(color='red', width=2),
                hovertemplate='Hand %{x}<br>Non-Showdown: $%{y:.2f}<extra></extra>'
            )
        )
        
        # Add showdown winnings (blue line)
        fig.add_trace(
            go.Scatter(
                x=filtered_df['Hand_Number'], 
                y=filtered_df['Running_Showdown_Profit'],
                name='Multiway Showdown Winnings',
                line=dict(color='blue', width=2),
                hovertemplate='Hand %{x}<br>Showdown: $%{y:.2f}<extra></extra>'
            )
        )
        
        # Add cumulative profit (green line)
        fig.add_trace(
            go.Scatter(
                x=filtered_df['Hand_Number'], 
                y=filtered_df['Running_Total_Profit'],
                name='Cumulative Total Profit',
                line=dict(color='green', width=3),
                hovertemplate='Hand %{x}<br>Total: $%{y:.2f}<extra></extra>'
            )
        )
        
        # Add zero line
        fig.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)
        
        # Update layout with filter info in title
        filter_parts = []
        if selected_position != 'All Positions':
            filter_parts.append(selected_position)
        if selected_stakes != 'All Stakes':
            filter_parts.append(selected_stakes)
        if selected_pot_type != 'All Pot Types':
            filter_parts.append(selected_pot_type)
        
        filter_text = f" - {' | '.join(filter_parts)}" if filter_parts else ""
        fig.update_layout(
            title=f"Showdown vs Non-Showdown Winnings{filter_text}",
            xaxis_title="Hand Number",
            yaxis_title="Cumulative Profit ($)",
            height=500,
            showlegend=True,
            hovermode='x unified'
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Add summary statistics
        total_showdown_profit = filtered_df['Showdown_Profit'].sum()
        total_non_showdown_profit = filtered_df['Non_Showdown_Profit'].sum()
        showdown_hands = (filtered_df['Showdown_Profit'] != 0).sum()
        non_showdown_hands = (filtered_df['Non_Showdown_Profit'] != 0).sum()
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Showdown Hands", f"{showdown_hands}")
        with col2:
            st.metric("Showdown Profit", f"${total_showdown_profit:.2f}")
        with col3:
            st.metric("Non-Showdown Hands", f"{non_showdown_hands}")
        with col4:
            st.metric("Non-Showdown Profit", f"${total_non_showdown_profit:.2f}")
    
    def render_position_analysis(self):
        """Render position-based analysis"""
        if self.df is None or self.df.empty:
            return
        
        position_stats = self.df.groupby('Position').agg({
            'Net_Profit': ['count', 'sum', 'mean'],
            'Went_to_Showdown': 'mean',
            'Won_When_Saw_Flop': 'mean',
            'Preflop_Raised': 'mean',
            'CBet_Flop': 'mean'
        }).round(3)
        
        position_stats.columns = [
            'Hands', 'Total_Profit', 'Avg_Profit', 
            'Showdown_Rate', 'Flop_Win_Rate', 'Preflop_Raise_Rate', 'CBet_Rate'
        ]
        
        st.subheader("Position Analysis")
        st.dataframe(position_stats, use_container_width=True)
    
    def render_stakes_analysis(self):
        """Render stakes-based analysis with bar charts"""
        if self.df is None or self.df.empty:
            return
        
        # Calculate stakes statistics
        stakes_stats = self.df.groupby('Stakes').agg({
            'Net_Profit': ['count', 'sum', 'mean'],
            'Went_to_Showdown': 'mean',
            'Won_When_Saw_Flop': 'mean'
        }).round(3)
        
        stakes_stats.columns = ['Hands', 'Total_Profit', 'Avg_Profit', 'Showdown_Rate', 'Flop_Win_Rate']
        stakes_stats = stakes_stats.reset_index()
        
        # Extract big blind value from stakes string (e.g., "$0.02/$0.05" -> 0.05)
        def extract_bb(stakes_str):
            try:
                # Remove dollar signs and split on forward slash
                parts = stakes_str.replace('$', '').split('/')
                if len(parts) >= 2:
                    return float(parts[1].strip())
                return 1.0  # Default if parsing fails
            except:
                return 1.0
        
        stakes_stats['BB'] = stakes_stats['Stakes'].apply(extract_bb)
        stakes_stats['Profit_BB'] = stakes_stats['Total_Profit'] / stakes_stats['BB']
        
        # Create two bar charts side by side
        col1, col2 = st.columns(2)
        
        with col1:
            # Cash profit bar chart
            fig_cash = px.bar(
                stakes_stats,
                x='Stakes',
                y='Total_Profit',
                title='Profit by Stakes ($)',
                labels={'Stakes': 'Stakes Level', 'Total_Profit': 'Total Profit ($)'},
                color='Total_Profit',
                color_continuous_scale=['red', 'yellow', 'green'],
                text='Total_Profit'
            )
            
            fig_cash.update_traces(texttemplate='$%{text:.2f}', textposition='outside')
            fig_cash.update_layout(
                xaxis_title="Stakes Level",
                yaxis_title="Total Profit ($)",
                showlegend=False,
                height=400
            )
            
            # Add zero line
            fig_cash.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)
            
            st.plotly_chart(fig_cash, use_container_width=True)
        
        with col2:
            # BB profit bar chart
            fig_bb = px.bar(
                stakes_stats,
                x='Stakes',
                y='Profit_BB',
                title='Profit by Stakes (BB)',
                labels={'Stakes': 'Stakes Level', 'Profit_BB': 'Total Profit (BB)'},
                color='Profit_BB',
                color_continuous_scale=['red', 'yellow', 'green'],
                text='Profit_BB'
            )
            
            fig_bb.update_traces(texttemplate='%{text:.1f} BB', textposition='outside')
            fig_bb.update_layout(
                xaxis_title="Stakes Level",
                yaxis_title="Total Profit (BB)",
                showlegend=False,
                height=400
            )
            
            # Add zero line
            fig_bb.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)
            
            st.plotly_chart(fig_bb, use_container_width=True)
        
        # Display summary table below charts
        st.subheader("Stakes Summary")
        display_stats = stakes_stats[['Stakes', 'Hands', 'Total_Profit', 'Profit_BB', 'Avg_Profit']].copy()
        display_stats['Total_Profit'] = display_stats['Total_Profit'].apply(lambda x: f"${x:.2f}")
        display_stats['Profit_BB'] = display_stats['Profit_BB'].apply(lambda x: f"{x:.1f} BB")
        display_stats['Avg_Profit'] = display_stats['Avg_Profit'].apply(lambda x: f"${x:.3f}")
        st.dataframe(display_stats, use_container_width=True, hide_index=True)
    
    
    def render_detailed_data(self):
        """Render detailed hand data with advanced filters and export options"""
        if self.df is None or self.df.empty:
            return
        
        st.subheader("Detailed Hand Data")
        
        # Filters Section
        with st.expander("🔍 Filters", expanded=True):
            # Row 1: Basic filters
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                positions = ['All'] + sorted(list(self.df['Position'].unique()))
                selected_position = st.selectbox("Position", positions, key="detail_position")
            
            with col2:
                stakes = ['All'] + sorted(list(self.df['Stakes'].unique()))
                selected_stakes = st.selectbox("Stakes", stakes, key="detail_stakes")
            
            with col3:
                pot_types = ['All'] + sorted(list(self.df['Pot_Type'].unique()))
                selected_pot_type = st.selectbox("Pot Type", pot_types, key="detail_pot_type")
            
            with col4:
                hole_cards_filter = st.text_input("Hole Cards (e.g., AA, KQ)", "", key="hole_cards_filter",
                                                 help="Filter by specific cards. Examples: AA, KQ, AK, 72")
            
            # Row 2: Numeric and boolean filters
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                min_profit = float(self.df['Net_Profit'].min())
                max_profit = float(self.df['Net_Profit'].max())
                profit_range = st.slider("Profit Range ($)", 
                                        min_value=min_profit, 
                                        max_value=max_profit,
                                        value=(min_profit, max_profit),
                                        key="profit_range_slider")
            
            with col2:
                result_filter = st.selectbox("Result", 
                                           ["All", "Winners Only", "Losers Only", "Breakeven"],
                                           key="result_filter")
            
            with col3:
                flop_filter = st.selectbox("Flop", 
                                          ["All", "Saw Flop", "Didn't See Flop"],
                                          key="flop_filter")
            
            with col4:
                showdown_filter = st.selectbox("Showdown", 
                                             ["All", "Went to Showdown", "No Showdown"],
                                             key="showdown_filter")
            
            # Row 3: Advanced action filters
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                vpip_filter = st.selectbox("VPIP", ["All", "VPIP Only", "Folded Preflop"], key="vpip_filter")
            
            with col2:
                preflop_action = st.selectbox("Preflop Action", 
                                            ["All", "Raised", "Called", "Folded"],
                                            key="preflop_action_filter")
            
            with col3:
                three_bet_filter = st.selectbox("3-Bet", ["All", "3-Bet", "No 3-Bet"], key="three_bet_filter")
            
            with col4:
                cbet_filter = st.selectbox("C-Bet", ["All", "C-Bet Flop", "No C-Bet"], key="cbet_filter")
            
            # Row 4: Date range filter
            if 'Timestamp' in self.df.columns and not self.df['Timestamp'].isna().all():
                col1, col2 = st.columns(2)
                with col1:
                    min_date = pd.to_datetime(self.df['Timestamp']).min().date()
                    max_date = pd.to_datetime(self.df['Timestamp']).max().date()
                    start_date = st.date_input("From Date", min_date, min_value=min_date, max_value=max_date, key="start_date")
                
                with col2:
                    end_date = st.date_input("To Date", max_date, min_value=min_date, max_value=max_date, key="end_date")
        
        # Apply filters
        filtered_df = self.df.copy()
        
        # Basic filters
        if selected_position != 'All':
            filtered_df = filtered_df[filtered_df['Position'] == selected_position]
        
        if selected_stakes != 'All':
            filtered_df = filtered_df[filtered_df['Stakes'] == selected_stakes]
        
        if selected_pot_type != 'All':
            filtered_df = filtered_df[filtered_df['Pot_Type'] == selected_pot_type]
        
        # Hole cards filter
        if hole_cards_filter:
            hole_cards_upper = hole_cards_filter.upper().strip()
            filtered_df = filtered_df[filtered_df['Hole_Cards'].str.contains(hole_cards_upper, na=False, regex=False)]
        
        # Profit range filter
        filtered_df = filtered_df[
            (filtered_df['Net_Profit'] >= profit_range[0]) & 
            (filtered_df['Net_Profit'] <= profit_range[1])
        ]
        
        # Result filter
        if result_filter == "Winners Only":
            filtered_df = filtered_df[filtered_df['Net_Profit'] > 0]
        elif result_filter == "Losers Only":
            filtered_df = filtered_df[filtered_df['Net_Profit'] < 0]
        elif result_filter == "Breakeven":
            filtered_df = filtered_df[filtered_df['Net_Profit'] == 0]
        
        # Flop filter
        if flop_filter == "Saw Flop":
            filtered_df = filtered_df[filtered_df['Saw_Flop'] == True]
        elif flop_filter == "Didn't See Flop":
            filtered_df = filtered_df[filtered_df['Saw_Flop'] == False]
        
        # Showdown filter
        if showdown_filter == "Went to Showdown":
            filtered_df = filtered_df[filtered_df['Went_to_Showdown'] == True]
        elif showdown_filter == "No Showdown":
            filtered_df = filtered_df[filtered_df['Went_to_Showdown'] == False]
        
        # VPIP filter
        if vpip_filter == "VPIP Only":
            filtered_df = filtered_df[filtered_df['VPIP'] == True]
        elif vpip_filter == "Folded Preflop":
            filtered_df = filtered_df[filtered_df['VPIP'] == False]
        
        # Preflop action filter
        if preflop_action == "Raised":
            filtered_df = filtered_df[filtered_df['Preflop_Raised'] == True]
        elif preflop_action == "Called":
            filtered_df = filtered_df[filtered_df['Preflop_Called'] == True]
        elif preflop_action == "Folded":
            filtered_df = filtered_df[(filtered_df['Preflop_Raised'] == False) & 
                                     (filtered_df['Preflop_Called'] == False)]
        
        # 3-Bet filter
        if three_bet_filter == "3-Bet":
            filtered_df = filtered_df[filtered_df['Three_Bet'] == True]
        elif three_bet_filter == "No 3-Bet":
            filtered_df = filtered_df[filtered_df['Three_Bet'] == False]
        
        # C-Bet filter
        if cbet_filter == "C-Bet Flop":
            filtered_df = filtered_df[filtered_df['CBet_Flop'] == True]
        elif cbet_filter == "No C-Bet":
            filtered_df = filtered_df[filtered_df['CBet_Flop'] == False]
        
        # Date range filter
        if 'Timestamp' in filtered_df.columns and not filtered_df['Timestamp'].isna().all():
            filtered_df['Date'] = pd.to_datetime(filtered_df['Timestamp']).dt.date
            filtered_df = filtered_df[
                (filtered_df['Date'] >= start_date) & 
                (filtered_df['Date'] <= end_date)
            ]
        
        # Display filter results summary
        st.info(f"📊 Showing {len(filtered_df):,} of {len(self.df):,} hands")
        
        # Export filtered data section
        col1, col2, col3 = st.columns([2, 2, 2])
        
        with col1:
            if not filtered_df.empty:
                csv_data = filtered_df.to_csv(index=False)
                st.download_button(
                    label="📥 Download Analysis Data (CSV)",
                    data=csv_data,
                    file_name=f"filtered_hands_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv",
                    key="download_filtered_csv",
                    help="Export parsed data for spreadsheet analysis"
                )
        
        with col2:
            if not filtered_df.empty:
                # Export all raw hand histories
                if 'Raw_Text' in filtered_df.columns:
                    all_raw_hands = '\n\n'.join(filtered_df['Raw_Text'].tolist())
                    st.download_button(
                        label="📋 Export Raw Hand Histories (TXT)",
                        data=all_raw_hands,
                        file_name=f"hand_histories_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
                        mime="text/plain",
                        key="download_all_raw_hands",
                        help="Export original hand histories for use in other poker tools"
                    )
        
        with col3:
            # Clear all filters button
            if st.button("🔄 Reset All Filters", key="reset_filters"):
                st.rerun()
        
        st.markdown("---")
        
        # Display data with enhanced columns
        if not filtered_df.empty:
            # Create a display dataframe with formatted values
            display_df = filtered_df[['Hand_ID', 'Timestamp', 'Position', 'Stakes', 'Hole_Cards', 
                                     'Net_Profit', 'Total_Pot_Size', 'Pot_Type', 'VPIP',
                                     'Saw_Flop', 'Went_to_Showdown', 'Won_When_Saw_Flop',
                                     'Preflop_Raised', 'Three_Bet', 'Four_Bet', 'CBet_Flop']].copy()
            
            # Format numeric columns
            display_df['Net_Profit'] = display_df['Net_Profit'].apply(lambda x: f"${x:.2f}")
            display_df['Total_Pot_Size'] = display_df['Total_Pot_Size'].apply(lambda x: f"${x:.2f}")
            
            # Sort by timestamp descending (most recent first)
            display_df = display_df.sort_values('Timestamp', ascending=False)
            
            # Display table
            st.dataframe(
                display_df,
                use_container_width=True,
                height=600
            )
            
            # Individual hand export section with table of download buttons
            st.markdown("---")
            st.subheader("📄 Export Individual Hands")
            
            # Hand ID search
            col1, col2 = st.columns([3, 2])
            with col1:
                search_hand_id = st.text_input(
                    "🔍 Search by Hand ID",
                    placeholder="Enter hand ID to quickly find and download...",
                    key="hand_id_search"
                )
            
            with col2:
                st.markdown("<br>", unsafe_allow_html=True)  # Add spacing to align with input
                if search_hand_id:
                    # Search for the hand
                    matching_hands = filtered_df[filtered_df['Hand_ID'].str.contains(search_hand_id, case=False, na=False)]
                    
                    if not matching_hands.empty:
                        st.success(f"✅ Found {len(matching_hands)} matching hand(s)")
                    else:
                        st.error("❌ No matching hands found")
            
            # If there's a search, show only matching hands
            if search_hand_id:
                search_results = filtered_df[filtered_df['Hand_ID'].str.contains(search_hand_id, case=False, na=False)]
                
                if not search_results.empty:
                    st.markdown("#### Search Results")
                    
                    for idx, (_, row) in enumerate(search_results.iterrows()):
                        hand_id = row['Hand_ID']
                        hole_cards = row['Hole_Cards']
                        net_profit = row['Net_Profit']
                        timestamp = row['Timestamp']
                        position = row['Position']
                        stakes = row['Stakes']
                        profit_emoji = "🟢" if net_profit >= 0 else "🔴"
                        
                        # Create an expander for each matching hand
                        with st.expander(f"**{hand_id}** - {hole_cards} {profit_emoji} ${net_profit:.2f}", expanded=True):
                            col1, col2, col3 = st.columns([2, 2, 1])
                            
                            with col1:
                                st.text(f"Timestamp: {timestamp}")
                                st.text(f"Position: {position}")
                            
                            with col2:
                                st.text(f"Stakes: {stakes}")
                                st.text(f"Cards: {hole_cards}")
                            
                            with col3:
                                # Download button
                                if 'Raw_Text' in row and row['Raw_Text']:
                                    st.download_button(
                                        label="📥 Download",
                                        data=row['Raw_Text'],
                                        file_name=f"hand_{hand_id}.txt",
                                        mime="text/plain",
                                        key=f"download_search_{hand_id}_{idx}",
                                        use_container_width=True
                                    )
                                else:
                                    st.button("❌ N/A", disabled=True, use_container_width=True)
                    
                    st.markdown("---")
            
            st.caption("💡 Or browse recent hands below")
            
            # Limit to showing max 20 hands to avoid too many buttons
            display_limit = min(20, len(filtered_df))
            if len(filtered_df) > display_limit:
                st.info(f"📌 Showing export buttons for the first {display_limit} hands (sorted by most recent). Use filters to narrow down specific hands.")
            
            # Create a grid of export buttons (4 per row)
            sorted_filtered_df = filtered_df.sort_values('Timestamp', ascending=False).head(display_limit)
            
            for idx, (_, row) in enumerate(sorted_filtered_df.iterrows()):
                if idx % 4 == 0:
                    cols = st.columns(4)
                
                col_idx = idx % 4
                with cols[col_idx]:
                    hand_id = row['Hand_ID']
                    hole_cards = row['Hole_Cards']
                    net_profit = row['Net_Profit']
                    profit_emoji = "🟢" if net_profit >= 0 else "🔴"
                    
                    # Display hand info
                    st.markdown(f"**{hole_cards}**")
                    st.caption(f"{profit_emoji} ${net_profit:.2f}")
                    
                    # Export button
                    if 'Raw_Text' in row and row['Raw_Text']:
                        st.download_button(
                            label=f"📥 {hand_id[:8]}...",
                            data=row['Raw_Text'],
                            file_name=f"hand_{hand_id}.txt",
                            mime="text/plain",
                            key=f"download_hand_{hand_id}_{idx}",
                            use_container_width=True
                        )
                    else:
                        st.button(
                            "❌ N/A",
                            disabled=True,
                            use_container_width=True,
                            key=f"no_data_{hand_id}_{idx}"
                        )
        else:
            st.warning("No hands match the current filters. Try adjusting your filter criteria.")
    
    def export_data(self):
        """Export data to CSV"""
        if self.df is None or self.df.empty:
            return
        
        csv = self.df.to_csv(index=False)
        st.download_button(
            label="Download Hero Analysis Data (CSV)",
            data=csv,
            file_name=f"hero_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )

def main():
    # Header with logo
    col1, col2 = st.columns([1, 4])
    with col1:
        try:
            st.image("Cardsharp logo.png", width=120)
        except:
            pass  # If logo not found, just skip it
    with col2:
        st.markdown("# <span style='font-size: 60px;'>♠️ Cardsharp</span>", unsafe_allow_html=True)
        st.markdown("<p style='font-size: 18px; color: #666; margin-top: -10px;'>Powerful opensource analysis</p>", unsafe_allow_html=True)
    
    # Initialize analyzer
    if 'analyzer' not in st.session_state:
        st.session_state.analyzer = HeroDataAnalyzer()
    
    analyzer = st.session_state.analyzer
    
    # Sidebar controls
    with st.sidebar:
        # Logo in sidebar (centered and bigger)
        try:
            col1, col2, col3 = st.columns([0.5, 4, 0.5])
            with col2:
                st.image("Cardsharp logo.png", use_container_width=True)
            st.markdown("<br>", unsafe_allow_html=True)
        except:
            pass  # If logo not found, just skip it
        
        st.header("📁 Load Hand Histories")
        
        # Try Demo button
        st.markdown("**Want to just try with my hand histories?**")
        if st.button("Load a very loosing sample", type="secondary", use_container_width=True):
            if analyzer.load_data("hand_histories"):
                st.success(f"✅ Loaded {len(analyzer.df)} demo hands!")
                st.rerun()
            else:
                st.error("❌ Demo hands not found.")
        
        st.markdown("---")
        
        # Add tabs for different loading methods
        load_method = st.radio(
            "Choose loading method:",
            ["📤 Upload Files", "📂 Load from Path"],
            help="Upload files directly or load from a folder on your computer"
        )
        
        if load_method == "📤 Upload Files":
            st.markdown("---")
            st.markdown("**Drag & drop your hand history files here:**")
            st.caption("📌 Currently only GG Poker hand histories supported")
            uploaded_files = st.file_uploader(
                "Choose .txt files",
                type=['txt'],
                accept_multiple_files=True,
                help="Upload one or more hand history .txt files",
                label_visibility="collapsed"
            )
            
            if uploaded_files:
                st.info(f"📎 {len(uploaded_files)} file(s) selected")
                
                if st.button("🚀 Process Uploaded Files", type="primary"):
                    if analyzer.load_uploaded_files(uploaded_files):
                        st.success(f"✅ Loaded {len(analyzer.df)} hands from {len(uploaded_files)} file(s)!")
                    else:
                        st.error("❌ Failed to process files. Please check the file format.")
        
        else:  # Load from Path
            st.markdown("---")
            st.markdown("**Enter or paste your folder path:**")
            folder_path = st.text_input(
                "Folder path",
                "hand_histories",
                help="Enter the path to folder containing your hand history files",
                label_visibility="collapsed"
            )
            
            # Show folder info if path exists
            if os.path.exists(folder_path):
                try:
                    file_pattern = os.path.join(folder_path, '**', '*.txt')
                    all_files = glob.glob(file_pattern, recursive=True)
                    if all_files:
                        st.success(f"✅ Found {len(all_files)} .txt file(s) in this folder")
                    else:
                        st.warning(f"⚠️ No .txt files found in '{folder_path}'")
                except Exception as e:
                    st.warning(f"⚠️ Could not scan folder: {e}")
            elif folder_path and folder_path != "hand_histories":
                st.error(f"❌ Folder not found: '{folder_path}'")
            
            if st.button("🔄 Load from Path", type="primary"):
                if analyzer.load_data(folder_path):
                    st.success(f"✅ Successfully loaded {len(analyzer.df)} hands!")
                else:
                    st.error("❌ No data found. Please check the folder path.")
        
        st.markdown("---")
        st.header("📊 Analysis Options")
        
        show_overview = st.checkbox("Overview Metrics", value=True)
        show_results = st.checkbox("Results", value=True)
        show_position_analysis = st.checkbox("Position Analysis", value=True)
        show_stakes_analysis = st.checkbox("Stakes Analysis", value=False)
        show_detailed_data = st.checkbox("Detailed Data", value=False)
    
    # Main content
    if analyzer.df is not None and not analyzer.df.empty:
        metrics = analyzer.calculate_key_metrics()
        
        if show_overview:
            st.header("Overview Metrics")
            analyzer.render_overview_metrics(metrics)
            st.markdown("<br>", unsafe_allow_html=True)
        
        if show_results:
            col1, col2 = st.columns([0.15, 4])
            with col1:
                try:
                    st.image("Cardsharp hand -JTs.png", width=70)
                except:
                    pass
            with col2:
                st.header("Results")
            analyzer.render_showdown_analysis_chart()
            st.markdown("<br>", unsafe_allow_html=True)

        if show_position_analysis:
            col1, col2 = st.columns([0.15, 4])
            with col1:
                try:
                    st.image("Cardsharp hand -KQo.png", width=70)
                except:
                    pass
            with col2:
                st.header("Position Analysis")
            analyzer.render_position_analysis()
            st.markdown("<br>", unsafe_allow_html=True)
        
        if show_stakes_analysis:
            col1, col2 = st.columns([0.15, 4])
            with col1:
                try:
                    st.image("Cardsharp hand -64s.png", width=70)
                except:
                    pass
            with col2:
                st.header("Stakes Analysis")
            analyzer.render_stakes_analysis()
            st.markdown("<br>", unsafe_allow_html=True)
        
        if show_detailed_data:
            st.header("Detailed Hand Data")
            analyzer.render_detailed_data()
        
        # Export section
        st.header("Export Data")
        analyzer.export_data()
    
    else:
        # Welcome screen for new users
        st.info("👋 Welcome! Click **🎮 Try Demo Hands** in the sidebar to see Cardsharp in action, or upload your own hand histories to get started.")
        
        st.markdown("<br>", unsafe_allow_html=True)
        
        # About section
        st.markdown("""
        ### I am not paying £60 for a glorified excel spreadsheet, neither should you.
        
        Reviewing your play should be easy, because playing is the hard part. 
        
        Cardsharp is the easiest way to process your hand histories, no expensive, outdated applications required. 
        
        If you have any feedback or suggestions, you can message me on Discord: **mcmuffin7296**

        Shout out Warwick Poker Society too
        """)
        
        st.markdown("---")
        
        # Discord contact


if __name__ == "__main__":
    main()
