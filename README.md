# Shotnote

`shotnote` is a macOS-only CLI that pulls screenshots from `Photos.app` and turns each image into a Markdown note with an OpenAI vision model.

If you are like me, you take screenshots of short videos on your phone. When watching low-signal AI-generated short videos, often the only things worth keeping are the GitHub repo URL and a few keywords for further learning. This tool is for you.

It is built for a simple workflow:

1. Capture screenshots on your phone.
2. Let iCloud Photos sync them to your Mac.
3. Run `shotnote` to pull new screenshots into `~/.shotnote/inbox/`.
4. Generate one note per image in `~/.shotnote/notes/`.
5. Copy each newly generated note into `~/.shotnote/export/` for downstream consumption.

## Requirements

- macOS
- Node.js 20+
- `Photos.app` with your screenshots already synced
- Xcode Command Line Tools so `xcrun swift` is available
- An OpenAI API key

Install Command Line Tools if needed:

```bash
xcode-select --install
```

## Install

Shotnote is not published to npm yet. Install it from source:

```bash
pnpm install
pnpm build
pnpm link --global
```

After that, the `shotnote` command is available in your shell.

## Quick Start

Run any Shotnote command once to bootstrap the working directory:

```bash
shotnote list-albums
```

This creates:

```text
~/.shotnote/
├── inbox/
├── notes/
├── export/
├── prompts/
│   └── analyze-screenshot.md
├── state/
│   ├── synced.json
│   └── analyzed.json
├── logs/
├── bin/
└── config.json
```

Then edit `~/.shotnote/config.json` and add your API key:

```json
{
  "source": {
    "type": "photos-album",
    "albumName": "Screenshots"
  },
  "analysis": {
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "promptPath": "~/.shotnote/prompts/analyze-screenshot.md",
    "apiKey": "your_key_here"
  }
}
```

Now try a small sync first:

```bash
shotnote sync --limit 5
shotnote analyze
```

Use `shotnote sync --limit 5` for the first sync bootstrap. After that, use `shotnote sync` for normal incremental syncing.

Or run both steps together:

```bash
shotnote run --limit 5
```

On the first sync, macOS may ask for permission to access your photo library. Grant it.

## Config

Shotnote reads configuration from:

- `~/.shotnote/config.json`
- environment variables

Environment variables override `config.json`:

- `OPENAI_API_KEY`
- `SHOTNOTE_ALBUM_NAME`
- `SHOTNOTE_MODEL`
- `SHOTNOTE_PROMPT_PATH`

If you use a network proxy to reach OpenAI, set standard proxy variables before running Shotnote:

- `https_proxy`
- `http_proxy`
- `all_proxy`

Example:

```bash
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897
```

## Commands

### `shotnote sync`

Pull new screenshots from `Photos.app` into `~/.shotnote/inbox/`.

```bash
shotnote sync --limit 20
shotnote sync
```

`--limit` only affects the first sync. After Shotnote has synced once, later syncs pull everything newer than the last successful sync.

Recommended pattern:

- first sync: `shotnote sync --limit 20`
- later syncs: `shotnote sync`

By default, Shotnote reads from the system `Screenshots` collection. This is a smart collection in `Photos.app`, not a normal user album.

### `shotnote analyze`

Analyze screenshots already in `~/.shotnote/inbox/`, write Markdown notes into `~/.shotnote/notes/`, and copy newly generated notes into `~/.shotnote/export/`.

```bash
shotnote analyze
```

To re-run one image after changing the prompt:

```bash
shotnote analyze --image 2026-03-24-existing.png --force
```

`--image` only accepts a file name from `~/.shotnote/inbox/`. `--force` requires `--image`.

When you force a re-run for the same image, Shotnote keeps only the latest note for that image hash.

### `shotnote run`

Run `sync` and then `analyze`:

```bash
shotnote run
shotnote run --limit 10
```

`run` also copies newly generated notes into `~/.shotnote/export/`.

### `shotnote list-albums`

List user-created albums in `Photos.app`:

```bash
shotnote list-albums
```

Use this when you want to point Shotnote at a custom album with `SHOTNOTE_ALBUM_NAME` or `config.json`.

`Screenshots` usually does not appear here because it is a system smart collection, not a user-created album.

## Prompt Tuning

Shotnote stores the analysis prompt in:

```text
~/.shotnote/prompts/analyze-screenshot.md
```

The file is created automatically on first run. Edit it directly to change classification and summary behavior, then re-run one image:

```bash
shotnote analyze --image 2026-03-24-existing.png --force
```

## Automation

If you want macOS to run Shotnote on a schedule and push `~/.shotnote/export/` to another machine, use `launchd` instead of `cron`.

See [LAUNCHD.md](./LAUNCHD.md).

## Troubleshooting

### `Screenshots` does not appear in `shotnote list-albums`

That is expected. `list-albums` only shows user-created albums. The default `Screenshots` source is handled separately.

### Sync is slow on the first run

Use `--limit`:

```bash
shotnote sync --limit 5
```

This limit is only for the initial sync bootstrap. After the first successful sync, use `shotnote sync`.

### `analyze` skips images even after you deleted note files

Shotnote tracks processed images in `~/.shotnote/state/analyzed.json`. Re-run a single image with:

```bash
shotnote analyze --image <filename> --force
```

### OpenAI requests fail but your API key is correct

Check your proxy settings and try exporting `https_proxy`, `http_proxy`, or `all_proxy` before running Shotnote.

## Development

```bash
pnpm test
pnpm build
```
