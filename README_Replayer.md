# Hand Replayer Feature

The Hand Replayer is a visual tool for reviewing poker hands action-by-action. It provides an interactive poker table visualization where you can step through each action and see how the hand unfolds.

## Features

### Visual Table Display
- **Poker Table Layout**: Visual representation of a poker table with all players positioned around it
- **Player Cards**: Hero's hole cards are displayed (other players' cards shown as face-down)
- **Board Cards**: Community cards appear as they're dealt on each street
- **Pot Display**: Current pot size prominently displayed in the center
- **Player Stacks**: Real-time stack sizes that update with each action
- **Current Bets**: Shows each player's current bet amount during betting rounds

### Action Navigation
- **Step-by-Step Playback**: Navigate through the hand one action at a time
- **Quick Navigation**: Jump to start, end, or any point in the hand
- **Slider Control**: Scrub through actions using a slider
- **Action Counter**: See current action number and total actions
- **Progress Bar**: Visual progress indicator

### Hand Selection
- **Smart Filters**: Filter hands by:
  - Position (Button, SB, BB, UTG, HJ, CO)
  - Type (Showdown vs Non-Showdown)
- **Sorting Options**: Sort by:
  - Most Recent
  - Highest Profit
  - Lowest Profit
  - Biggest Pot
- **Hand Preview**: Each hand shows hole cards, position, profit, and pot size before selection

### Action History
- **Grouped by Street**: Actions organized by Preflop, Flop, Turn, River
- **Detailed Information**: Each action shows player, action type, amount, and resulting pot
- **Current Action Highlight**: The current action is highlighted in the history

### Player Information Display
- **Player Cards**: 
  - Hero (You): Green card with gold border, cards visible
  - Active Players: Blue cards
  - Folded Players: Gray cards
- **Position Labels**: Each player shows their position and seat number
- **Stack Updates**: Stacks update in real-time as actions are taken
- **Bet Indicators**: Yellow boxes show current bet amounts

## How to Use

### 1. Enable the Replayer
In the sidebar, check the "Hand Replayer" box under Analysis Options.

### 2. Select a Hand
1. Use the filters to narrow down hands:
   - Choose a position to see hands played from that position
   - Select "Showdown Hands" to review hands that went to showdown
   - Pick a sorting method to find interesting hands

2. Select a hand from the dropdown:
   - 🟢 = Winning hand
   - 🔴 = Losing hand
   - 📊 SD = Hand went to showdown

### 3. Navigate Through the Hand
- **⏮️ Start**: Jump to the beginning of the hand
- **⬅️ Previous**: Go back one action
- **➡️ Next**: Advance one action
- **⏭️ End**: Jump to the end of the hand
- **Slider**: Drag to any point in the hand

### 4. Review the Action
Watch the action unfold step-by-step:
- Player actions are displayed in a colored banner
- The pot updates after each action
- Board cards appear as each street is dealt
- Player stacks and bets update in real-time

### 5. See the Result
At the end of the hand:
- Winner is announced with 🏆
- Winning hand is displayed (if shown)
- Final pot, rake, and jackpot amounts shown

## Visual Guide

### Action Colors
- **Red (Fold)**: Player folded
- **Blue (Call)**: Player called a bet
- **Orange (Bet/Raise)**: Player bet or raised
- **Gray (Check)**: Player checked
- **Purple (Post)**: Player posted a blind
- **Green (Collect)**: Player collected from pot
- **Teal (Return)**: Uncalled bet returned

### Player Card Colors
- **Green with Gold Border**: Hero (You)
- **Blue**: Active opponent
- **Gray**: Folded player

## Tips

1. **Review Big Pots**: Sort by "Biggest Pot" to review your most significant hands
2. **Study Losses**: Sort by "Lowest Profit" to review hands where you lost money
3. **Position Analysis**: Filter by position to review your play from specific positions
4. **Showdown Study**: Filter "Showdown Hands" to review hands that went to showdown

## Technical Details

### Parser Capabilities
The replayer parser extracts:
- All player actions with amounts
- Board cards by street
- Player stacks at each point
- Pot sizes after each action
- Winner and winning hand information

### Data Storage
- Hand texts are stored in memory when data is loaded
- Up to 50 most relevant hands shown in dropdown (for performance)
- All hands accessible through filtering

## Limitations

1. **Performance**: Limited to 50 hands in dropdown at once (use filters to narrow down)
2. **Card Visibility**: Only Hero's cards are visible (unless shown at showdown)
3. **Side Pots**: Complex side pot situations may not be fully represented
4. **Time Bank**: Player time-to-act information not currently available

## Future Enhancements

Potential future features:
- Auto-play mode with configurable speed
- Hand strength indicators
- Equity calculations at each decision point
- Bet sizing analysis overlays
- Player statistics display
- Hand history export from replayer
- Comparison mode (compare similar situations)

## Troubleshooting

**"Hand text not available for replay"**
- Reload your data using the "Load from Path" or "Upload Files" buttons
- The replayer needs access to raw hand history files

**Hands not appearing in dropdown**
- Check your filters - they may be too restrictive
- Try "All" for position and type filters
- Ensure data is loaded (check that other sections show hands)

**Actions seem incorrect**
- This may be a parsing issue with your specific hand format
- Please report the hand ID and site to help improve the parser

## Support

For issues, suggestions, or improvements to the Hand Replayer, contact:
**Discord: mcmuffin7296**
