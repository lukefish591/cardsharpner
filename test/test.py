import re
import os

print("🚀 Starting SPE file debug test...")

# Test 1: Check if SPE file exists
file_path = "SPE/specific.txt"
print(f"📁 Checking file: {file_path}")
print(f"File exists: {os.path.exists(file_path)}")

if os.path.exists(file_path):
    print("✅ File found!")
    
    # Test 2: Try to read file
    try:
        with open(file_path, 'r') as f:
            text = f.read()
        print(f"✅ File read successfully! Length: {len(text)} characters")
        
        # Test 3: Check for hands
        hands = re.split(r'(?=Poker Hand #)', text)
        print(f"✅ Found {len(hands)} hands")
        
        if len(hands) > 1:
            first_hand = hands[1]
            print(f"✅ First hand length: {len(first_hand)} characters")
            print(f"✅ First 200 chars: {first_hand[:200]}...")
            
            # Test 4: Try to import parser and run enhanced debug
            try:
                from src.hero_analysis_parser import HeroAnalysisParser
                print("✅ Parser imported successfully!")
                
                parser = HeroAnalysisParser()
                print("✅ Parser instantiated successfully!")
                
                # Test the enhanced debug method
                print("\n🔍 Running enhanced profit calculation debug on SPE hand...")
                debug_actions = parser.analyze_hero_actions_debug(first_hand)
                
                print(f"\n🎯 FINAL RESULTS:")
                print(f"Total Contributed: ${debug_actions['total_contributed']:.2f}")
                print(f"Total Collected:   ${debug_actions['total_collected']:.2f}")
                print(f"Net Profit:        ${debug_actions['net_profit']:.2f}")
                print(f"Actions Count:     {len(debug_actions['action_details'])}")
                
            except Exception as e:
                print(f"❌ Error with parser: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("❌ No hands found in file")
            
    except Exception as e:
        print(f"❌ Error reading file: {e}")
else:
    print("❌ File not found!")

print("�� Test completed!")