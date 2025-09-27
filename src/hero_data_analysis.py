import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
import glob
from hero_analysis_parser import HeroAnalysisParser
from datetime import datetime, timedelta

# Page configuration
st.set_page_config(
    page_title="Hero Poker Data Analysis",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .metric-card {
        background: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin: 5px 0;
    }
    
    .stat-highlight {
        background: #e3f2fd;
        padding: 10px;
        border-radius: 5px;
        border-left: 4px solid #2196f3;
    }
    
    .profit-positive {
        color: #4caf50;
        font-weight: bold;
    }
    
    .profit-negative {
        color: #f44336;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

class HeroDataAnalyzer:
    def __init__(self):
        self.parser = HeroAnalysisParser()
        self.df = None
    
    def load_data(self, folder_path: str):
        """Load and process hand history data"""
        with st.spinner("Loading and analyzing hand histories..."):
            self.df = self.parser.process_files(folder_path)
        return not self.df.empty
    
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
        
        # C-bet metrics
        cbet_flop = self.df['CBet_Flop'].sum()
        cbet_turn = self.df['CBet_Turn'].sum()
        cbet_river = self.df['CBet_River'].sum()
        
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
            'cbet_flop': cbet_flop,
            'cbet_turn': cbet_turn,
            'cbet_river': cbet_river
        }
    
    def render_overview_metrics(self, metrics):
        """Render overview metrics"""
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Total Hands", f"{metrics['total_hands']:,}")
            st.metric("Total Profit (After Rake)", f"${metrics['total_profit']:.2f}")
            st.metric("Total Profit (Before Rake)", f"${metrics['total_profit_before_rake']:.2f}")
        
        with col2:
            st.metric("Avg Profit/Hand (After Rake)", f"${metrics['avg_profit']:.2f}")
            st.metric("Avg Profit/Hand (Before Rake)", f"${metrics['avg_profit_before_rake']:.2f}")
            st.metric("Total Rake Paid (Incl. Jackpot)", f"${metrics['total_rake']:.2f}")
        
        with col3:
            st.metric("Avg Rake/Hand (Incl. Jackpot)", f"${metrics['avg_rake']:.2f}")
            st.metric("Rake Percentage", f"{metrics['rake_percentage']:.2f}%")
            st.metric("VPIP Rate", f"{metrics['vpip_rate']:.1f}%")
        
        with col4:
            st.metric("Preflop Raise Rate", f"{metrics['preflop_raise_rate']:.1f}%")
            st.metric("Saw Flop Rate", f"{metrics['flop_rate']:.1f}%")
            st.metric("Showdown Rate (of Flop)", f"{metrics['showdown_rate']:.1f}%")
    
    def render_profit_chart(self):
        """Render profit over time chart"""
        if self.df is None or self.df.empty:
            return
        
        fig = px.line(
            self.df, 
            x='Hand_Number', 
            y='Running_Profit',
            title='Cumulative Profit Over Time',
            labels={'Hand_Number': 'Hand Number', 'Running_Profit': 'Cumulative Profit ($)'}
        )
        
        # Add zero line
        fig.add_hline(y=0, line_dash="dash", line_color="red", opacity=0.5)
        
        fig.update_layout(
            xaxis_title="Hand Number",
            yaxis_title="Cumulative Profit ($)",
            hovermode='x unified'
        )
        
        st.plotly_chart(fig, width="stretch")
    
    def render_rake_analysis_chart(self):
        """Render rake analysis chart comparing profit with and without rake"""
        if self.df is None or self.df.empty:
            return
        
        # Create subplot with two y-axes
        fig = make_subplots(
            rows=2, cols=1,
            subplot_titles=('Cumulative Profit: After Rake vs Before Rake', 'Total Rake Paid Over Time (Incl. Jackpot)'),
            vertical_spacing=0.1
        )
        
        # Add profit lines
        fig.add_trace(
            go.Scatter(
                x=self.df['Hand_Number'], 
                y=self.df['Running_Profit'],
                name='Profit (After Rake)',
                line=dict(color='red', width=2)
            ),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Scatter(
                x=self.df['Hand_Number'], 
                y=self.df['Running_Profit_Before_Rake'],
                name='Profit (Before Rake)',
                line=dict(color='green', width=2)
            ),
            row=1, col=1
        )
        
        # Add zero line
        fig.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5, row=1, col=1)
        
        # Add rake line
        fig.add_trace(
            go.Scatter(
                x=self.df['Hand_Number'], 
                y=self.df['Running_Rake'],
                name='Cumulative Rake Paid (Incl. Jackpot)',
                line=dict(color='orange', width=2),
                fill='tonexty'
            ),
            row=2, col=1
        )
        
        fig.update_layout(
            height=600,
            showlegend=True,
            hovermode='x unified'
        )
        
        fig.update_xaxes(title_text="Hand Number", row=2, col=1)
        fig.update_yaxes(title_text="Cumulative Profit ($)", row=1, col=1)
        fig.update_yaxes(title_text="Cumulative Rake ($)", row=2, col=1)
        
        st.plotly_chart(fig, width="stretch")
    
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
        st.dataframe(position_stats, width="stretch")
    
    def render_stakes_analysis(self):
        """Render stakes-based analysis"""
        if self.df is None or self.df.empty:
            return
        
        stakes_stats = self.df.groupby('Stakes').agg({
            'Net_Profit': ['count', 'sum', 'mean'],
            'Went_to_Showdown': 'mean',
            'Won_When_Saw_Flop': 'mean'
        }).round(3)
        
        stakes_stats.columns = ['Hands', 'Total_Profit', 'Avg_Profit', 'Showdown_Rate', 'Flop_Win_Rate']
        
        st.subheader("Stakes Analysis")
        st.dataframe(stakes_stats, width="stretch")
    
    def render_hand_strength_analysis(self):
        """Render hand strength analysis"""
        if self.df is None or self.df.empty:
            return
        
        # Analyze by hole cards (simplified)
        df_with_cards = self.df[self.df['Hole_Cards'] != ''].copy()
        
        if df_with_cards.empty:
            st.info("No hole card data available for analysis")
            return
        
        # Group by card suits and values for basic analysis
        df_with_cards['Card1'] = df_with_cards['Hole_Cards'].str.split().str[0]
        df_with_cards['Card2'] = df_with_cards['Hole_Cards'].str.split().str[1]
        
        # Create hand type categories
        def categorize_hand(card1, card2):
            if pd.isna(card1) or pd.isna(card2):
                return "Unknown"
            
            # Extract values and suits
            val1, suit1 = card1[:-1], card1[-1]
            val2, suit2 = card2[:-1], card2[-1]
            
            # Convert face cards to numbers
            face_values = {'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}
            val1_num = face_values.get(val1, int(val1))
            val2_num = face_values.get(val2, int(val2))
            
            if suit1 == suit2:
                if val1_num == val2_num:
                    return "Pocket Pair"
                else:
                    return "Suited"
            else:
                if val1_num == val2_num:
                    return "Pocket Pair"
                else:
                    return "Offsuit"
        
        df_with_cards['Hand_Type'] = df_with_cards.apply(
            lambda row: categorize_hand(row['Card1'], row['Card2']), axis=1
        )
        
        hand_type_stats = df_with_cards.groupby('Hand_Type').agg({
            'Net_Profit': ['count', 'sum', 'mean'],
            'Went_to_Showdown': 'mean',
            'Won_When_Saw_Flop': 'mean'
        }).round(3)
        
        hand_type_stats.columns = ['Hands', 'Total_Profit', 'Avg_Profit', 'Showdown_Rate', 'Flop_Win_Rate']
        
        st.subheader("Hand Type Analysis")
        st.dataframe(hand_type_stats, width="stretch")
    
    def render_detailed_data(self):
        """Render detailed hand data"""
        if self.df is None or self.df.empty:
            return
        
        st.subheader("Detailed Hand Data")
        
        # Filters
        col1, col2, col3 = st.columns(3)
        
        with col1:
            positions = ['All'] + list(self.df['Position'].unique())
            selected_position = st.selectbox("Filter by Position", positions)
        
        with col2:
            stakes = ['All'] + list(self.df['Stakes'].unique())
            selected_stakes = st.selectbox("Filter by Stakes", stakes)
        
        with col3:
            show_showdown_only = st.checkbox("Show showdown hands only")
        
        # Apply filters
        filtered_df = self.df.copy()
        
        if selected_position != 'All':
            filtered_df = filtered_df[filtered_df['Position'] == selected_position]
        
        if selected_stakes != 'All':
            filtered_df = filtered_df[filtered_df['Stakes'] == selected_stakes]
        
        if show_showdown_only:
            filtered_df = filtered_df[filtered_df['Went_to_Showdown'] == True]
        
        # Display data
        st.dataframe(
            filtered_df[['Hand_ID', 'Timestamp', 'Position', 'Stakes', 'Hole_Cards', 
                       'Net_Profit', 'Went_to_Showdown', 'Won_When_Saw_Flop', 
                       'Preflop_Raised', 'CBet_Flop']],
            width="stretch"
        )
    
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
    st.title("📊 Hero Poker Data Analysis")
    st.markdown("Streamlined poker data analysis focused on Hero performance metrics")
    
    # Initialize analyzer
    if 'analyzer' not in st.session_state:
        st.session_state.analyzer = HeroDataAnalyzer()
    
    analyzer = st.session_state.analyzer
    
    # Sidebar controls
    with st.sidebar:
        st.header("📁 Data Controls")
        
        folder_path = st.text_input("Hand History Folder:", "hand_histories")

        folder_path = f"data/{folder_path}"
        
        if st.button("🔄 Load Data"):
            if analyzer.load_data(folder_path):
                st.success(f"Loaded {len(analyzer.df)} hands")
            else:
                st.error("No data found. Please check the folder path.")
        
        st.header("📊 Analysis Options")
        
        show_overview = st.checkbox("Overview Metrics", value=True)
        show_profit_chart = st.checkbox("Profit Chart", value=True)
        show_rake_analysis = st.checkbox("Rake Analysis", value=True)
        show_position_analysis = st.checkbox("Position Analysis", value=True)
        show_stakes_analysis = st.checkbox("Stakes Analysis", value=False)
        show_hand_analysis = st.checkbox("Hand Type Analysis", value=False)
        show_detailed_data = st.checkbox("Detailed Data", value=False)
    
    # Main content
    if analyzer.df is not None and not analyzer.df.empty:
        metrics = analyzer.calculate_key_metrics()
        
        if show_overview:
            st.header("📈 Overview Metrics")
            analyzer.render_overview_metrics(metrics)
            
            # Additional Statistics Section
            st.header("🎯 Detailed Statistics")
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("VPIP Rate", f"{metrics['vpip_rate']:.1f}%")
                st.metric("Preflop Raise Rate", f"{metrics['preflop_raise_rate']:.1f}%")
                st.metric("Preflop Call Rate", f"{metrics['preflop_call_rate']:.1f}%")
            
            with col2:
                st.metric("Saw Flop Rate", f"{metrics['flop_rate']:.1f}%")
                st.metric("Flop Win Rate", f"{metrics['flop_win_rate']:.1f}%")
                st.metric("C-Bet Flop Rate", f"{(metrics['cbet_flop'] / metrics['total_hands'] * 100) if metrics['total_hands'] > 0 else 0:.1f}%")
            
            with col3:
                st.metric("Showdown Rate (of Flop)", f"{metrics['showdown_rate']:.1f}%")
                st.metric("W$SD (Won at Showdown)", f"{metrics['won_at_showdown_rate']:.1f}%")
                st.metric("Won at Showdown Count", f"{metrics['won_at_showdown']} times")
            
            with col4:
                st.metric("C-Bet Turn Rate", f"{(metrics['cbet_turn'] / metrics['total_hands'] * 100) if metrics['total_hands'] > 0 else 0:.1f}%")
                st.metric("C-Bet River Rate", f"{(metrics['cbet_river'] / metrics['total_hands'] * 100) if metrics['total_hands'] > 0 else 0:.1f}%")
                st.metric("Total Hands", f"{metrics['total_hands']:,}")
        
        if show_profit_chart:
            st.header("💰 Profit Analysis")
            analyzer.render_profit_chart()
        
        if show_rake_analysis:
            st.header("💸 Rake Analysis")
            analyzer.render_rake_analysis_chart()
        
        if show_position_analysis:
            st.header("📍 Position Analysis")
            analyzer.render_position_analysis()
        
        if show_stakes_analysis:
            st.header("💵 Stakes Analysis")
            analyzer.render_stakes_analysis()
        
        if show_hand_analysis:
            st.header("🃏 Hand Type Analysis")
            analyzer.render_hand_strength_analysis()
        
        if show_detailed_data:
            st.header("📋 Detailed Hand Data")
            analyzer.render_detailed_data()
        
        # Export section
        st.header("💾 Export Data")
        analyzer.export_data()
    
    else:
        st.info("Please load hand histories using the sidebar controls.")
        
        # Show features
        st.subheader("🚀 Features")
        st.markdown("""
        - **Hero-Focused Analysis**: Only tracks your performance, not opponents
        - **Key Metrics**: Showdown rates, flop win rates, profit tracking
        - **Position Analysis**: Performance breakdown by table position
        - **Stakes Analysis**: Performance across different stake levels
        - **Hand Type Analysis**: Performance by hole card types
        - **Export Capabilities**: Download data for further analysis
        - **Streamlined Interface**: Focus on data analysis, not hand replay
        """)

if __name__ == "__main__":
    main()
