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
│   ├── lib/db.ts             # invoke wrappers for Rust DB / import commands
│   ├── styles/               # CSS variables + skeleton layout
│   └── types/poker.ts
├── scripts/
│   ├── import_hands.py       # local Python bridge to existing parsers
│   └── setup_import_venv.sh
├── src-tauri/
│   ├── src/
│   │   ├── db.rs             # SQLite schema + list/persist
│   │   ├── import.rs         # spawn local Python parsers
│   │   └── lib.rs            # Tauri commands
│   ├── capabilities/
│   └── tauri.conf.json
└── package.json
```

## Import (local parsers)

**Import selected** walks the files/folders you pick, splits on `Poker Hand #`, and runs the existing repo-root Python parsers as a **local subprocess** (no network):

- `hero_analysis_parser.py` — hero cards, stakes, net
- `hand_replayer.py` — players, actions, board
- `comprehensive_parser.py` — only if replay data is missing

Rows are written to local SQLite (`hands`, `players`, `actions`, `import_batches`). Hands never leave this Mac.

Python venv (once, from the repo root):

```bash
./cardsharpener/scripts/setup_import_venv.sh
```

That creates `.venv/` at the repo root and installs `pandas` (the parser dependency). The app prefers that interpreter; override with `CARDSHARPENER_PYTHON` or `CARDSHARPENER_REPO` if needed.

## SQLite

On first launch the app creates:

- App data dir (macOS typically `~/Library/Application Support/com.cardsharpener.app/`)
- `cardsharpener.sqlite3` with tables: `hands`, `players`, `actions`, `import_batches`

## Out of scope (v1)

- HUD over other poker clients
- Theory / GTO comparison charts
- Cloud upload of hand histories

## Redesign note

The replayer table is built from **separate DOM/CSS components** (seat, card, board, pot, controls, action log), not a single canvas. Prefer keeping that boundary so restyling in Cursor stays easy.
