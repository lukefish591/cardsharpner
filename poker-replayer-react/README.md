# Poker Hand Replayer - React Edition

A high-performance poker hand replayer built with React, TypeScript, and Canvas. This is a complete rewrite of the Streamlit version with significantly better performance and user experience.

## Features

- **Fast & Responsive**: No page refreshes, smooth real-time updates
- **Interactive Controls**: Play, pause, step forward/backward through hands
- **Visual Table**: Canvas-based poker table with proper player positioning
- **Parser Ported from Python**: Uses the same parsing logic as the Python version
- **Auto-play Mode**: Adjustable playback speed (0.5x to 2x)
- **Action History**: Full history with street-by-street breakdown
- **File Upload**: Drag & drop or paste hand history text

## Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Zustand** - Lightweight state management
- **Vite** - Lightning-fast build tool
- **Canvas API** - Smooth graphics rendering
- **Lucide React** - Beautiful icons

## Installation

```bash
cd poker-replayer-react
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build for Production

```bash
npm run build
```

The optimized production build will be in the `dist/` directory.

## Usage

### 1. Load a Hand

- **Upload File**: Click "Upload Hand History File" and select a `.txt` file
- **Paste Text**: Copy and paste hand history text into the textarea

### 2. Control Playback

- **⏮️ Start**: Jump to beginning
- **⬅️ Previous**: Step backward one action
- **▶️ Play/Pause**: Auto-play mode
- **➡️ Next**: Step forward one action
- **⏭️ End**: Jump to end
- **Slider**: Scrub to any point in the hand

### 3. Adjust Speed

Use the speed dropdown to change auto-play speed:
- 0.5x - Slow motion
- 1x - Normal
- 1.5x - Fast
- 2x - Very fast

## Project Structure

```
poker-replayer-react/
├── src/
│   ├── components/          # React components
│   │   ├── PokerTable.tsx  # Main table with Canvas
│   │   ├── PlayerCard.tsx  # Player display
│   │   ├── Card.tsx        # Playing card component
│   │   ├── BoardCards.tsx  # Community cards
│   │   ├── Controls.tsx    # Playback controls
│   │   ├── HandSelector.tsx # Hand loading
│   │   └── ActionHistory.tsx # Action list
│   ├── parser/             # Hand history parser
│   │   └── handParser.ts   # Ported from Python
│   ├── store/              # State management
│   │   └── replayStore.ts  # Zustand store
│   ├── types/              # TypeScript types
│   │   └── poker.ts        # Hand replay types
│   ├── App.tsx             # Main app component
│   ├── App.css             # Styling
│   └── main.tsx            # Entry point
├── index.html              # HTML template
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
└── README.md              # This file
```

## Parser

The hand history parser is a direct port of the Python `hand_replayer.py` with the same logic:

- Extracts all players and their positions
- Parses all actions with amounts and pot sizes
- Tracks board cards by street
- Identifies winners and final pot
- Supports GGPoker format (same as Python version)

## Performance Improvements vs Streamlit

- **~100x faster rendering**: Canvas vs HTML re-renders
- **No server round-trips**: Pure client-side
- **Smooth animations**: 60 FPS capable
- **Instant updates**: No page refreshes
- **Better UX**: Keyboard shortcuts, smooth transitions

## Customization

### Change Table Colors

Edit `src/components/PokerTable.tsx`:

```typescript
// Green felt
ctx.fillStyle = '#047857'; // Change this

// Outer border
ctx.fillStyle = '#1e3a8a'; // Change this
```

### Modify Player Positions

Edit the `getPlayerPosition` function in `PokerTable.tsx` to adjust spacing.

### Custom Styling

All styles are in `src/App.css` - modify as needed.

## Extending

### Add New Features

1. **Hand Comparison**: Load multiple hands side-by-side
2. **Statistics Overlay**: Show pot odds, equity, etc.
3. **Mobile Support**: Touch controls
4. **Database Integration**: Save/load hands from backend
5. **Export**: Generate images or videos of hands

### Add Backend Integration

```typescript
// src/api/hands.ts
export async function fetchHands() {
  const response = await fetch('/api/hands');
  return response.json();
}

// Use in HandSelector component
const hands = await fetchHands();
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Open source - feel free to use and modify.

## Credits

- Parser logic ported from Python `hand_replayer.py`
- Built with modern React best practices
- Designed for poker players, by poker players

## Contact

For issues or suggestions: **Discord: mcmuffin7296**

