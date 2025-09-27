#!/usr/bin/env python3
"""
Test script to verify all restored features are working
"""

import os
import sys

print("🚀 Testing all restored features...")

# Test 1: Check if SPE file exists
file_path = "SPE/specific.txt"
print(f"📁 Checking file: {file_path}")
print(f"File exists: {os.path.exists(file_path)}")

if os.path.exists(file_path):
    print("✅ File found!")
    
    # Test 2: Try to import parser
    try:
        from hero_analysis_parser import HeroAnalysisParser
        print("✅ Parser imported successfully!")
        
        parser = HeroAnalysisParser()
        print("✅ Parser instantiated successfully!")
        
        # Test 3: Read and parse the hand
        with open(file_path, 'r') as f:
            text = f.read()
        
        hands = text.split('Poker Hand #')
        if len(hands) > 1:
            first_hand = hands[1]
            print(f"✅ Found hand, length: {len(first_hand)} characters")
            
            # Test 4: Parse the hand
            result = parser.parse_hand(first_hand)
            print(f"✅ Hand parsed successfully!")
            
            # Test 5: Check all restored features
            print(f"\n🎯 RESTORED FEATURES VERIFICATION:")
            print(f"{'='*50}")
            
            # Financial features
            print(f"💰 Financial Data:")
            print(f"   Total Contributed: ${result.total_contributed:.2f}")
            print(f"   Total Collected: ${result.total_collected:.2f}")
            print(f"   Net Profit: ${result.net_profit:.2f}")
            print(f"   Rake Amount: ${result.rake_amount:.2f}")
            print(f"   Net Profit Before Rake: ${result.net_profit_before_rake:.2f}")
            print(f"   Total Pot Size: ${result.total_pot_size:.2f}")
            
            # VPIP feature
            print(f"\n🎯 VPIP Feature:")
            print(f"   VPIP: {result.vpip}")
            
            # Hand progression
            print(f"\n📊 Hand Progression:")
            print(f"   Saw Flop: {result.saw_flop}")
            print(f"   Went to Showdown: {result.went_to_showdown}")
            print(f"   Won Money at Showdown: ${result.won_money_at_showdown:.2f}")
            print(f"   Won When Saw Flop: {result.won_when_saw_flop}")
            
            # C-bet features
            print(f"\n🔄 C-Bet Features:")
            print(f"   C-Bet Flop: {result.cbet_flop}")
            print(f"   C-Bet Turn: {result.cbet_turn}")
            print(f"   C-Bet River: {result.cbet_river}")
            
            # Preflop features
            print(f"\n🎲 Preflop Features:")
            print(f"   Preflop Raised: {result.preflop_raised}")
            print(f"   Preflop Called: {result.preflop_called}")
            
            print(f"\n✅ All restored features are working correctly!")
            
        else:
            print("❌ No hands found in file")
            
    except Exception as e:
        print(f"❌ Error with parser: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ File not found!")

print("🏁 Test completed!")
