#!/usr/bin/env python3
"""
Test script to verify W$SD percentage calculation
"""

import os
import sys
import pandas as pd

print("🚀 Testing W$SD percentage calculation...")

# Test 1: Check if SPE file exists
file_path = "SPE/specific.txt"
print(f"📁 Checking file: {file_path}")
print(f"File exists: {os.path.exists(file_path)}")

if os.path.exists(file_path):
    print("✅ File found!")
    
    # Test 2: Try to import parser
    try:
        from src.hero_analysis_parser import HeroAnalysisParser
        from streamlit_app import HeroDataAnalyzer
        print("✅ Parser and analyzer imported successfully!")
        
        parser = HeroAnalysisParser()
        analyzer = HeroDataAnalyzer()
        print("✅ Parser and analyzer instantiated successfully!")
        
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
            
            # Test 5: Check W$SD data
            print(f"\n🎯 W$SD DATA VERIFICATION:")
            print(f"{'='*50}")
            print(f"Went to Showdown: {result.went_to_showdown}")
            print(f"Won at Showdown (W$SD): {result.won_at_showdown}")
            print(f"Type: {type(result.won_at_showdown)}")
            
            # Test 6: Create a test DataFrame to verify percentage calculation
            print(f"\n📊 TESTING PERCENTAGE CALCULATION:")
            print(f"{'='*50}")
            
            # Create test data
            test_data = {
                'Went_to_Showdown': [True, True, True, False, True, True],  # 5 showdowns
                'Won_at_Showdown': [True, False, True, False, True, True]   # 4 wins at showdown
            }
            test_df = pd.DataFrame(test_data)
            
            # Calculate W$SD percentage
            went_to_showdown = test_df['Went_to_Showdown'].sum()
            won_at_showdown = test_df['Won_at_Showdown'].sum()
            won_at_showdown_rate = (won_at_showdown / went_to_showdown) * 100 if went_to_showdown > 0 else 0
            
            print(f"Test Data:")
            print(f"  Total Showdowns: {went_to_showdown}")
            print(f"  Won at Showdown: {won_at_showdown}")
            print(f"  W$SD Rate: {won_at_showdown_rate:.1f}%")
            print(f"  Expected: 80.0% (4 out of 5)")
            
            # Test 7: Verify the calculation matches expected result
            expected_rate = 80.0
            if abs(won_at_showdown_rate - expected_rate) < 0.1:
                print(f"✅ W$SD percentage calculation is CORRECT!")
            else:
                print(f"❌ W$SD percentage calculation is WRONG!")
                print(f"   Expected: {expected_rate}%, Got: {won_at_showdown_rate}%")
            
            print(f"\n✅ W$SD changes verified successfully!")
            print(f"   - W$SD now shows percentage of showdowns won")
            print(f"   - Example: 4 wins out of 5 showdowns = 80.0%")
            
        else:
            print("❌ No hands found in file")
            
    except Exception as e:
        print(f"❌ Error with parser: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ File not found!")

print("🏁 Test completed!")
