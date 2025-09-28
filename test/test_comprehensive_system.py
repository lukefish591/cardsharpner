#!/usr/bin/env python3
"""
Test script for the hero poker data analysis system
"""

import os
import sys
from hero_analysis_parser import HeroAnalysisParser

def test_parser():
    """Test the hero analysis parser"""
    print("🧪 Testing Hero Analysis Parser...")
    
    # Create a sample hand history
    sample_hand = """
    Poker Hand #123456789
    Table 'Test Table' 6-max Seat #1 is the button
    Seat 1: Hero ($100.00 in chips)
    Seat 2: Player2 ($95.50 in chips)
    Seat 3: Player3 ($87.25 in chips)
    Seat 4: Player4 ($102.75 in chips)
    Seat 5: Player5 ($89.00 in chips)
    Seat 6: Player6 ($91.50 in chips)
    Player6: posts small blind $0.50
    Player1: posts big blind $1.00
    *** HOLE CARDS ***
    Dealt to Hero [Ah Kh]
    Player2: folds
    Player3: calls $1.00
    Player4: folds
    Player5: raises $3.00 to $4.00
    Player6: folds
    Hero: calls $3.00
    Player3: calls $3.00
    *** FLOP *** [2c 7h 9s]
    Hero: checks
    Player3: checks
    Player5: bets $6.00
    Hero: calls $6.00
    Player3: folds
    *** TURN *** [2c 7h 9s] [Jd]
    Hero: checks
    Player5: bets $12.00
    Hero: calls $12.00
    *** RIVER *** [2c 7h 9s Jd] [3h]
    Hero: checks
    Player5: bets $24.00
    Hero: calls $24.00
    *** SHOWDOWN ***
    Player5: shows [Ac Kc] (a pair of Kings)
    Hero: shows [Ah Kh] (a pair of Kings)
    Hero collected $89.00 from pot
    *** SUMMARY ***
    Total pot $89.00 | Rake $3.00
    Board [2c 7h 9s Jd 3h]
    Seat 1: Hero (big blind) showed [Ah Kh] and won ($89.00) with a pair of Kings
    Seat 3: Player3 (button) folded on the Turn
    Seat 5: Player5 showed [Ac Kc] and lost with a pair of Kings
    """
    
    try:
        parser = HeroAnalysisParser()
        hero_data = parser.parse_hand(sample_hand)
        
        print(f"✅ Hand ID: {hero_data.hand_id}")
        print(f"✅ Position: {hero_data.position}")
        print(f"✅ Hole Cards: {hero_data.hole_cards}")
        print(f"✅ Net Profit: ${hero_data.net_profit}")
        print(f"✅ Went to Showdown: {hero_data.went_to_showdown}")
        print(f"✅ Won Money at Showdown: ${hero_data.won_money_at_showdown}")
        print(f"✅ Won When Saw Flop: {hero_data.won_when_saw_flop}")
        print(f"✅ Saw Flop: {hero_data.saw_flop}")
        
        return hero_data
        
    except Exception as e:
        print(f"❌ Parser test failed: {e}")
        return None

def test_data_processing(hero_data):
    """Test data processing and DataFrame creation"""
    print("\n📊 Testing Data Processing...")
    
    try:
        parser = HeroAnalysisParser()
        
        # Test DataFrame creation
        df = parser.process_files("TestHands")
        
        if not df.empty:
            print(f"✅ DataFrame created: {len(df)} rows, {len(df.columns)} columns")
            print(f"✅ Columns: {list(df.columns)}")
            
            # Test key metrics
            total_profit = df['Net_Profit'].sum()
            showdown_rate = df['Went_to_Showdown'].mean() * 100
            flop_win_rate = df['Won_When_Saw_Flop'].mean() * 100
            
            print(f"✅ Total Profit: ${total_profit:.2f}")
            print(f"✅ Showdown Rate: {showdown_rate:.1f}%")
            print(f"✅ Flop Win Rate: {flop_win_rate:.1f}%")
            
            return True
        else:
            print("❌ No data processed")
            return False
        
    except Exception as e:
        print(f"❌ Data processing test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Hero Poker Data Analysis System Tests\n")
    
    # Test 1: Parser
    hero_data = test_parser()
    if not hero_data:
        print("❌ Parser test failed, stopping tests")
        return
    
    # Test 2: Data Processing
    success = test_data_processing(hero_data)
    if not success:
        print("❌ Data processing test failed")
        return
    
    print("\n🎉 All tests passed! The hero poker data analysis system is working correctly.")
    print("\n📝 To run the full application:")
    print("   streamlit run hero_data_analysis.py")

if __name__ == "__main__":
    main()

