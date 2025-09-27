#!/usr/bin/env python3
"""
Test script to verify the new c-bet logic
"""

import os
import sys


print("🚀 Testing new c-bet logic...")

# Test 1: Check if SPE file exists
file_path = "SPE/specific.txt"
print(f"📁 Checking file: {file_path}")
print(f"File exists: {os.path.exists(file_path)}")

if os.path.exists(file_path):
    print("✅ File found!")
    
    # Test 2: Try to import parser
    try:
        from src.hero_analysis_parser import HeroAnalysisParser
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
            
            # Test 4: Parse the hand with new c-bet logic
            result = parser.parse_hand(first_hand)
            print(f"✅ Hand parsed successfully!")
            
            # Test 5: Check c-bet data
            print(f"\n🎯 C-BET DATA VERIFICATION:")
            print(f"{'='*50}")
            print(f"C-Bet Flop Opportunity: {result.cbet_flop_opportunity}")
            print(f"C-Bet Flop: {result.cbet_flop}")
            print(f"C-Bet Turn Opportunity: {result.cbet_turn_opportunity}")
            print(f"C-Bet Turn: {result.cbet_turn}")
            print(f"C-Bet River Opportunity: {result.cbet_river_opportunity}")
            print(f"C-Bet River: {result.cbet_river}")
            
            # Test 6: Run debug version to see detailed output
            print(f"\n🔍 Running debug analysis...")
            debug_result = parser.analyze_hero_actions_debug(first_hand)
            
            print(f"\n📊 DEBUG C-BET RESULTS:")
            print(f"C-Bet Flop Opportunity: {debug_result['cbet_flop_opportunity']}")
            print(f"C-Bet Flop: {debug_result['cbet_flop']}")
            print(f"C-Bet Turn Opportunity: {debug_result['cbet_turn_opportunity']}")
            print(f"C-Bet Turn: {debug_result['cbet_turn']}")
            print(f"C-Bet River Opportunity: {debug_result['cbet_river_opportunity']}")
            print(f"C-Bet River: {debug_result['cbet_river']}")
            
            print(f"\n✅ C-bet logic test completed!")
            
        else:
            print("❌ No hands found in file")
            
    except Exception as e:
        print(f"❌ Error with parser: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ File not found!")

print("🏁 Test completed!")
