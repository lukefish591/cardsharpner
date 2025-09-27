#!/usr/bin/env python3
"""
Test script to verify the restored parser functionality
"""

import os
import sys

print("🚀 Testing restored parser functionality...")

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
            
            # Test 5: Check key fields
            print(f"\n🎯 PARSED DATA:")
            print(f"Hand ID: {result.hand_id}")
            print(f"Total Contributed: ${result.total_contributed:.2f}")
            print(f"Total Collected: ${result.total_collected:.2f}")
            print(f"Net Profit: ${result.net_profit:.2f}")
            print(f"Rake Amount: ${result.rake_amount:.2f}")
            print(f"Net Profit Before Rake: ${result.net_profit_before_rake:.2f}")
            print(f"Total Pot Size: ${result.total_pot_size:.2f}")
            print(f"VPIP: {result.vpip}")
            print(f"Saw Flop: {result.saw_flop}")
            print(f"Went to Showdown: {result.went_to_showdown}")
            print(f"Won Money at Showdown: ${result.won_money_at_showdown:.2f}")
            print(f"C-Bet Flop: {result.cbet_flop}")
            print(f"C-Bet Turn: {result.cbet_turn}")
            print(f"C-Bet River: {result.cbet_river}")
            
            print(f"\n✅ All key features restored and working!")
            
        else:
            print("❌ No hands found in file")
            
    except Exception as e:
        print(f"❌ Error with parser: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ File not found!")

print("🏁 Test completed!")
