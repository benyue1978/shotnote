#!/bin/zsh
set -euo pipefail

export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897

REPO="$HOME/git/shotnote"
EXPORT_DIR="$HOME/.shotnote/export"
LOG_DIR="$HOME/.shotnote/logs"
LOG_OUT="$LOG_DIR/export-launchd.log"
LOG_ERR="$LOG_DIR/export-launchd.err.log"
DEST="songy@yuewin.follow-vega.ts.net:~/shotnote-export-inbox/"
NODE_BIN="/Users/song.yue/.local/state/fnm_multishells/1790_1774343229470/bin/node"

mkdir -p "$LOG_DIR"
exec >> "$LOG_OUT" 2>> "$LOG_ERR"

echo "==== $(date '+%Y-%m-%d %H:%M:%S %Z') shotnote-export-push start ===="
echo "repo: $REPO"
echo "export_dir: $EXPORT_DIR"
echo "dest: $DEST"
echo "node: $NODE_BIN"

cd "$REPO"

if "$NODE_BIN" dist/cli.js run; then
  :
else
  status=$?
  echo "shotnote run failed with exit code $status" >&2
  echo "==== $(date '+%Y-%m-%d %H:%M:%S %Z') shotnote-export-push failed ====" >&2
  exit "$status"
fi

rsync -av "$EXPORT_DIR/" "$DEST"

find "$EXPORT_DIR" -type f -name '*.md' -delete

echo "==== $(date '+%Y-%m-%d %H:%M:%S %Z') shotnote-export-push done ===="
