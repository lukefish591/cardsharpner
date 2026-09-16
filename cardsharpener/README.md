# Cardsharpener (Mac desktop)

Local-first poker **hand tracker + replayer** for macOS.

Stack: **Tauri 2 + React + TypeScript (Vite) + SQLite** on disk.

This folder (`cardsharpener/`) is the desktop app. The older `poker-replayer-react/` tree (mostly empty / leftover `node_modules`) is not the product shell — evolve parsers and Python tools at the repo root separately if needed, calling them only as local side processes later.

## Privacy

- Hand histories and the SQLite DB stay on your Mac (app data directory).
- Import uses OS file/folder dialogs only.
- No required account, sync, or cloud upload of hand histories.

## Prerequisites (macOS)

1. **Node.js** 18+ (LTS recommended) — https://nodejs.org/
2. **Rust** (stable) via rustup — https://rustup.rs/
3. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
4. Tauri macOS prerequisites: https://tauri.app/start/prerequisites/

Verify:

```bash
node -v
npm -v
rustc -V
cargo -V
```

## Run (development)

```bash
cd cardsharpener
npm install
npm run tauri dev
```

- Frontend Vite server: `http://localhost:1420` (also started by Tauri)
- Native shell loads that URL and talks to Rust commands (SQLite, dialogs)

Frontend-only UI check (no native DB/dialogs):

```bash
cd cardsharpener
npm install
npm run dev
```

## Build (macOS app)

```bash
cd cardsharpener
npm install
npm run tauri build
```

Artifacts land under `src-tauri/target/release/bundle/` (`.app` / `.dmg` depending on targets).

## Layout

```
cardsharpener/
├── src/                      # React UI
│   ├── components/
│   │   ├── shell/            # App chrome + nav
│   │   ├── import/           # Local import + DB status
│   │   ├── hands/            # Hand list + filters
│   │   ├── replayer/         # DOM table, seats, cards, controls, action log
│   │   └── stats/            # Data-only chart placeholders
│   ├── lib/db.ts             # invoke wrappers for Rust DB commands
│   ├── styles/               # CSS variables + skeleton layout
│   └── types/poker.ts
├── src-tauri/
│   ├── src/
│   │   ├── db.rs             # SQLite schema stub + app-data path
│   │   └── lib.rs            # Tauri commands
│   ├── capabilities/
│   └── tauri.conf.json
└── package.json
```

## SQLite

On first launch the app creates:

- App data dir (macOS typically `~/Library/Application Support/com.cardsharpener.app/`)
- `cardsharpener.sqlite3` with empty tables: `hands`, `players`, `actions`, `import_batches`

Schema is a stub for future import + replay + stats. No full PokerTracker engine yet.

## Out of scope (v1)

- HUD over other poker clients
- Theory / GTO comparison charts
- Cloud upload of hand histories

## Redesign note

The replayer table is built from **separate DOM/CSS components** (seat, card, board, pot, controls, action log), not a single canvas. Prefer keeping that boundary so restyling in Cursor stays easy.
