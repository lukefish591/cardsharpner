#!/bin/zsh
# Local-only Python venv for the existing hand parsers (no cloud).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
python3 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install -U pip
# Parsers need pandas (see repo-root requirements.txt). Streamlit/plotly are UI-only.
"$ROOT/.venv/bin/pip" install "pandas>=1.5.0"
echo "Import venv ready: $ROOT/.venv"
