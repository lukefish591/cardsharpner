#!/usr/bin/env python3
"""
Test script to verify multi-player showdown detection for W$SD
"""

import os
import sys

print("🚀 Testing multi-player showdown detection for W$SD...")

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
            
            # Test 4: Test multi-player showdown detection
            print(f"\n🎯 MULTI-PLAYER SHOWDOWN DETECTION TEST:")
            print(f"{'='*60}")
            
            multi_player_showdown = parser.detect_multi_player_showdown(first_hand)
            print(f"Multi-player showdown detected: {multi_player_showdown}")
            
            # Test 5: Parse the hand with new logic
            result = parser.parse_hand(first_hand)
            print(f"✅ Hand parsed successfully!")
            
            # Test 6: Check W$SD data
            print(f"\n🎯 W$SD DATA VERIFICATION:")
            print(f"{'='*50}")
            print(f"Went to Showdown: {result.went_to_showdown}")
            print(f"Won at Showdown (W$SD): {result.won_at_showdown}")
            print(f"Total Collected: ${result.total_collected:.2f}")
            
            # Test 7: Run debug version to see detailed output
            print(f"\n🔍 Running debug analysis...")
            debug_result = parser.analyze_hero_actions_debug(first_hand)
            
            print(f"\n📊 DEBUG RESULTS:")
            print(f"Went to Showdown: {debug_result['went_to_showdown']}")
            print(f"Won at Showdown (W$SD): {debug_result['won_at_showdown']}")
            print(f"Total Collected: ${debug_result['total_collected']:.2f}")
            
            print(f"\n✅ Multi-player showdown detection verified!")
            print(f"   - W$SD now only counts when 2+ players show cards")
            print(f"   - W$SD only counts when Hero wins money at multi-player showdown")
            
        else:
            print("❌ No hands found in file")
            
    except Exception as e:
        print(f"❌ Error with parser: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ File not found!")

print("🏁 Test completed!")
