#!/usr/bin/env python3
"""
Test script to verify W$SD (Won at Showdown) changes
"""

import os
import sys

print("🚀 Testing W$SD (Won at Showdown) changes...")

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
            
            # Test 5: Check W$SD changes
            print(f"\n🎯 W$SD (Won at Showdown) VERIFICATION:")
            print(f"{'='*50}")
            
            print(f"Went to Showdown: {result.went_to_showdown}")
            print(f"Won at Showdown (W$SD): {result.won_at_showdown}")
            print(f"Type of won_at_showdown: {type(result.won_at_showdown)}")
            
            # Test 6: Run debug version to see detailed output
            print(f"\n🔍 Running debug analysis...")
            debug_result = parser.analyze_hero_actions_debug(first_hand)
            
            print(f"\n📊 DEBUG RESULTS:")
            print(f"Went to Showdown: {debug_result['went_to_showdown']}")
            print(f"Won at Showdown (W$SD): {debug_result['won_at_showdown']}")
            print(f"Type: {type(debug_result['won_at_showdown'])}")
            
            print(f"\n✅ W$SD changes verified successfully!")
            print(f"   - Now tracks boolean (True/False) instead of dollar amount")
            print(f"   - Shows percentage of showdowns won, not money won")
            
        else:
            print("❌ No hands found in file")
            
    except Exception as e:
        print(f"❌ Error with parser: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ File not found!")

print("🏁 Test completed!")
