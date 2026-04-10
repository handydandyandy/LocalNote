#!/bin/bash
# Build the frontend and start the backend.
# Run after code changes. For daily use, systemd handles the backend automatically.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building frontend..."
cd "$ROOT/frontend"
npm install
npm run build

echo "==> Starting LocalNote backend (Ctrl+C to stop)..."
cd "$ROOT/backend"
source venv/bin/activate
python main.py
