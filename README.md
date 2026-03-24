# Shotnote

`shotnote` is a macOS-only CLI that pulls screenshots from `Photos.app` and writes one Markdown note per image using an OpenAI vision model.

## Commands

```bash
shotnote list-albums
shotnote sync
shotnote analyze
shotnote run
```

## Working Directory

Shotnote manages files under `~/.shotnote/`:

```text
~/.shotnote/
├── inbox/
├── notes/
├── prompts/
│   └── analyze-screenshot.md
├── state/
│   ├── synced.json
│   └── analyzed.json
├── logs/
└── config.json
```

The tool creates missing directories automatically.

## Setup

1. Make sure your iPhone screenshots are synced into `Photos.app`.
2. Export an OpenAI API key in your shell:

```bash
export OPENAI_API_KEY=your_key_here
```

3. Optionally create `~/.shotnote/config.json`:

```json
{
  "source": {
    "type": "photos-album",
    "albumName": "Screenshots"
  },
  "analysis": {
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "promptPath": "~/.shotnote/prompts/analyze-screenshot.md"
  }
}
```

You can also override some values with environment variables:

- `SHOTNOTE_ALBUM_NAME`
- `SHOTNOTE_MODEL`
- `SHOTNOTE_PROMPT_PATH`
- `OPENAI_API_KEY`

## Prompt Tuning

The analysis prompt lives at `~/.shotnote/prompts/analyze-screenshot.md`.

If it does not exist, `shotnote analyze` or `shotnote run` will create it from the built-in default prompt. You can edit this file directly to tune how screenshots are classified and summarized.

## Development

```bash
pnpm install
pnpm test
pnpm build
```
