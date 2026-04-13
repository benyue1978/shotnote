#!/bin/zsh
set -euo pipefail

osascript <<'APPLESCRIPT'
tell application id "com.googlecode.iterm2"
  set newWindow to (create window with default profile)
  tell current session of newWindow
    write text "/Users/song.yue/shotnote-export-push.sh"
  end tell
  set visible of newWindow to false
end tell
APPLESCRIPT
