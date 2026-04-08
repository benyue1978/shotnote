# Run Shotnote with launchd

This guide shows how to run Shotnote on macOS with a `LaunchAgent` instead of `cron`.

Use this when you want your Mac to:

1. run `shotnote run`
2. copy files from `~/.shotnote/export/` to another machine
3. do it on a fixed interval without relying on your interactive shell

## Why launchd

On macOS, `launchd` is usually a better fit than `cron` because:

- it is the native scheduler
- it behaves more predictably with GUI user sessions
- logging is easier to route into files
- you can manage jobs with `launchctl`

## What You Need to Prepare

Before using the example below, make sure you have all of these:

- a working local `shotnote` checkout
- `shotnote run` already works when you run it manually
- `node` is installed, and you know its absolute path from `which node`
- `rsync` can reach the target machine over SSH
- SSH key login is set up if you do not want password prompts
- your proxy settings are known if OpenAI requires a proxy on your machine

The examples below are not copy-paste universal. Another user must change the machine-specific values first.

## Step 1: Create the Push Script

Create a script such as:

`/Users/song.yue/shotnote-export-push.sh`

Example:

```bash
#!/bin/zsh
set -euo pipefail

export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897

REPO="$HOME/git/shotnote"
EXPORT_DIR="$HOME/.shotnote/export"
LOG_DIR="$HOME/.shotnote/logs"
DEST="songy@yuewin.follow-vega.ts.net:~/shotnote-export-inbox/"
NODE_BIN="/Users/song.yue/.local/state/fnm_multishells/1790_1774343229470/bin/node"

mkdir -p "$LOG_DIR"

cd "$REPO"
"$NODE_BIN" dist/cli.js run

rsync -av "$EXPORT_DIR/" "$DEST"

find "$EXPORT_DIR" -type f -name '*.md' -delete
```

### Values another user must change

- `https_proxy`, `http_proxy`, `all_proxy`
- `REPO`
- `DEST`
- `NODE_BIN`

### Notes

- Use the full path for `node`. Do not rely on `node` being in `PATH`.
- Do not add `find ... -delete` until you have confirmed `rsync` is working the way you want.
- If you installed `shotnote` globally and want to call `shotnote run` instead, still use the full path from `which shotnote`.

Make it executable:

```bash
chmod +x /Users/song.yue/shotnote-export-push.sh
```

## Step 2: Create the LaunchAgent plist

Create:

`/Users/song.yue/Library/LaunchAgents/com.songyue.shotnote-export.plist`

Example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.songyue.shotnote-export</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>/Users/song.yue/shotnote-export-push.sh</string>
    </array>

    <key>StartInterval</key>
    <integer>7200</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>WorkingDirectory</key>
    <string>/Users/song.yue/git/shotnote</string>

    <key>StandardOutPath</key>
    <string>/Users/song.yue/.shotnote/logs/export-launchd.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/song.yue/.shotnote/logs/export-launchd.err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>https_proxy</key>
      <string>http://127.0.0.1:7897</string>
      <key>http_proxy</key>
      <string>http://127.0.0.1:7897</string>
      <key>all_proxy</key>
      <string>socks5://127.0.0.1:7897</string>
    </dict>
  </dict>
</plist>
```

### Values another user must change

- `Label`
- script path in `ProgramArguments`
- `WorkingDirectory`
- `StandardOutPath`
- `StandardErrorPath`
- proxy values in `EnvironmentVariables`
- optional `PATH`

## Step 3: Load the LaunchAgent

```bash
mkdir -p /Users/song.yue/.shotnote/logs

launchctl bootout gui/$(id -u) /Users/song.yue/Library/LaunchAgents/com.songyue.shotnote-export.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) /Users/song.yue/Library/LaunchAgents/com.songyue.shotnote-export.plist
launchctl enable gui/$(id -u)/com.songyue.shotnote-export
```

## Step 4: Trigger It Immediately

```bash
launchctl kickstart -k gui/$(id -u)/com.songyue.shotnote-export
```

## Step 5: Check Status and Logs

Print job status:

```bash
launchctl print gui/$(id -u)/com.songyue.shotnote-export
```

Watch logs:

```bash
tail -f /Users/song.yue/.shotnote/logs/export-launchd.log
tail -f /Users/song.yue/.shotnote/logs/export-launchd.err.log
```

## Common Issues

### `command not found: node`

Use the full path to `node` in the script. Get it from:

```bash
which node
```

### It works in Terminal but not in launchd

That usually means one of these differs between your interactive shell and `launchd`:

- `PATH`
- proxy variables
- SSH agent availability
- current working directory

Write explicit values into the script or the plist.

### `export/` has files that do not match `notes/`

That can be expected. `notes/` keeps the latest note per image hash. `export/` is usually a downstream queue, so it may still contain older files until the consumer deletes them.

## Suggested Rollout

1. Get `shotnote run` working manually.
2. Get `rsync` working manually.
3. Test the script manually.
4. Load the `LaunchAgent`.
5. Trigger it with `launchctl kickstart -k ...`.
6. Only then rely on the scheduled interval.
