# Shotnote MVP Design

## Goal

Build a macOS-only CLI that:

1. Pulls newly synced screenshots from `Photos.app` into a local working directory at `~/.shotnote/`
2. Analyzes each unprocessed screenshot with an OpenAI vision model
3. Writes one Markdown note per screenshot

The MVP does not do research, clustering, summarization across images, scheduling, or UI.

## Product Scope

### Supported commands

- `shotnote list-albums`
- `shotnote sync`
- `shotnote analyze`
- `shotnote run`

### Explicitly out of scope

- `init`
- background daemons or launch agents
- aggregation or daily digest generation
- non-macOS support
- non-OpenAI model providers
- direct parsing of Photos Library internals

## User Experience

### Working directory

The CLI manages a fixed root directory:

`~/.shotnote/`

Directory layout:

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

### Commands

#### `shotnote list-albums`

- Lists user-visible albums available in `Photos.app`
- Helps users find the exact album name to use for screenshot syncing
- Prints plain-text names, one per line, suitable for terminal use

#### `shotnote sync`

- Reads screenshot assets from a configured album in `Photos.app`
- Exports newly discovered assets into `~/.shotnote/inbox/`
- Avoids duplicates using content hashing and sync state

#### `shotnote analyze`

- Scans `~/.shotnote/inbox/` for supported image files
- Skips previously analyzed images
- Sends each image to an OpenAI vision model
- Writes one Markdown file per image to `~/.shotnote/notes/`

#### `shotnote run`

- Runs `sync`
- If sync succeeds, runs `analyze`
- Returns a compact summary of counts and failures

## Key Design Constraint

The integration with `Photos.app` and the integration with OpenAI must be isolated behind stable interfaces. The CLI orchestration layer should know nothing about AppleScript details or OpenAI request shape beyond configuration and returned structured data.

This is required so future work can add:

- alternate image sources, such as local folders, iCloud Drive exports, or Android sync folders
- alternate analyzers, such as another model provider or a local model
- richer downstream steps, such as research or aggregation

## Architecture

The MVP is structured as a pipeline with three layers:

1. CLI commands and orchestration
2. Domain services and state management
3. Pluggable adapters for image sources and analyzers

### Proposed source tree

```text
src/
├── cli.ts
├── commands/
│   ├── sync.ts
│   ├── analyze.ts
│   └── run.ts
├── core/
│   ├── config.ts
│   ├── paths.ts
│   ├── types.ts
│   ├── state-store.ts
│   ├── hashing.ts
│   └── markdown.ts
├── services/
│   ├── sync-service.ts
│   └── analyze-service.ts
├── adapters/
│   ├── photo-source/
│   │   ├── index.ts
│   │   ├── photo-source.ts
│   │   └── export-screenshots.applescript
│   └── analyzers/
│       ├── analyzer.ts
│       └── openai-analyzer.ts
└── tests/
```

## Core Abstractions

### Image source abstraction

The source adapter owns discovery and export of candidate screenshot files.

```ts
export interface ImageSource {
  listAlbums(): Promise<string[]>
  syncNewImages(): Promise<SyncResult>
}
```

`SyncResult` contains:

- discovered item count
- exported file records
- skipped duplicate count
- warnings

The `Photos.app` implementation is the first adapter:

- invokes `osascript`
- exports album assets to a staging or target directory
- returns exported file metadata to the service layer

The command layer must never depend on AppleScript output format directly. That output is parsed inside the adapter.

### Analyzer abstraction

The analyzer adapter owns model invocation and conversion into a stable domain object.

```ts
export interface ScreenshotAnalyzer {
  analyze(input: AnalyzeInput): Promise<AnalyzeResult>
}
```

`AnalyzeResult` contains:

- normalized structured fields
- raw model output
- provider metadata
- parse warnings if normalization had to degrade

The OpenAI implementation is the first adapter:

- loads the API key from config or environment
- receives prompt text from the service layer
- sends image plus prompt to the model
- requests structured JSON output where possible
- normalizes response into domain shape

The orchestration code must not know OpenAI SDK request specifics.

## Domain Model

### Supported image types

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.heic`

### Analysis schema

The normalized structure for every analyzed screenshot is:

```ts
type ScreenshotAnalysis = {
  type: "tool" | "website" | "git-repo" | "concept" | "article" | "other"
  title: string
  summary: string
  whyInteresting: string
  entities: string[]
  tags: string[]
}
```

The persisted Markdown also includes:

- source image path
- analyzed timestamp
- analyzer model name
- raw JSON block

If structured parsing fails, the note still gets written with:

- fallback title from file name
- best-effort raw text
- explicit parse warning

## Configuration

### Configuration sources

Priority order:

1. CLI flags
2. environment variables
3. `~/.shotnote/config.json`
4. built-in defaults

### Initial config surface

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

### API key handling

Primary path for end users:

- `OPENAI_API_KEY`

Optional path:

- future support for reading from `~/.shotnote/config.json`

The MVP should not require a separate `init` step. Missing directories are created lazily on first command execution.

### Prompt configuration

The screenshot analysis prompt must be stored as a user-editable Markdown file:

`~/.shotnote/prompts/analyze-screenshot.md`

Behavior:

1. If the prompt file does not exist, create it from a bundled default template on first `analyze` or `run`
2. On every analysis run, read the current prompt file from disk
3. Pass the prompt contents into the analyzer adapter as plain text

This keeps prompt tuning outside the compiled package and makes prompt iteration available to end users without code changes.

The default prompt template must define the expected `type` values explicitly so the analyzer output stays aligned with the normalized schema.

## Sync Flow

### MVP behavior

1. Resolve config and ensure `~/.shotnote/` directories exist
2. Invoke the `Photos.app` source adapter
3. Export candidate files to `~/.shotnote/inbox/`
4. Compute `sha256` for each exported file
5. Compare against `state/synced.json`
6. Keep new files and register them in state
7. Remove or ignore duplicates based on hash

### State shape

`state/synced.json`

```json
{
  "byHash": {
    "<sha256>": {
      "imagePath": "/Users/example/.shotnote/inbox/2026-03-24-abc.png",
      "syncedAt": "2026-03-24T12:00:00.000Z",
      "source": "photos-album"
    }
  }
}
```

### Album handling

The source adapter should allow album name overrides because album names may differ by system language. Default is `Screenshots`, but user-configured names must be supported.

The adapter may optionally try a small fallback list of common localized names, but that should remain internal to the adapter.

The CLI should also expose `shotnote list-albums` so users can discover the exact Photos album names available on their machine without editing config blindly.

## Analyze Flow

### MVP behavior

1. Resolve config and ensure directories exist
2. Scan inbox for supported image files
3. Compute hash or use previously stored sync hash
4. Compare against `state/analyzed.json`
5. For each unanalyzed image:
   - load the prompt file from `~/.shotnote/prompts/analyze-screenshot.md`
   - call analyzer adapter
   - normalize result
   - render Markdown
   - write note file
   - update analyzed state

### Note naming

Preferred file name:

- date prefix plus slugified analysis title

Fallback:

- date prefix plus original image basename

Collision strategy:

- append a short hash suffix

### State shape

`state/analyzed.json`

```json
{
  "byHash": {
    "<sha256>": {
      "imagePath": "/Users/example/.shotnote/inbox/2026-03-24-abc.png",
      "notePath": "/Users/example/.shotnote/notes/2026-03-24-langgraph-agent-a1b2.md",
      "analyzedAt": "2026-03-24T12:30:00.000Z",
      "model": "gpt-4.1-mini"
    }
  }
}
```

## Markdown Output

Each image produces one `.md` file with a fixed template:

```md
# <title>

## Type
<type>

## Summary
<summary>

## Why Interesting
<whyInteresting>

## Entities
- ...

## Tags
tag1, tag2

## Source
<image path>

## Metadata
- analyzed_at: ...
- model: ...

## Raw
```json
...
```
```

The Markdown renderer belongs in core logic, not in the analyzer adapter.

## Error Handling

### Sync failures

- Missing Photos automation permission: surface actionable error and stop `sync`
- Album not found: show configured album name and fail cleanly
- Export partial failure: continue for successful files and report failures

### Analyze failures

- Missing API key: fail fast before processing any files
- Model call failure on one image: record error, continue with remaining images
- Invalid structured output: write degraded note and mark warning

### Run command behavior

`run` fails if `sync` fails completely. If `sync` completes with partial success, `analyze` should process whatever is available.

## Logging

The CLI prints concise progress to stdout. Optionally, detailed run logs can be written under `~/.shotnote/logs/`.

The MVP should prefer readable terminal output over verbose debug streams.

## Testing Strategy

The implementation should be test-driven where behavior is local and deterministic.

### Unit tests

- config resolution
- path creation
- prompt file bootstrapping and prompt loading
- hash-based de-duplication
- state-store reads and writes
- Markdown rendering
- note file naming and collision handling
- service behavior with mocked source and analyzer adapters

### Adapter tests

- `Photos.app` adapter album listing using fixtures
- `Photos.app` adapter parsing of `osascript` output using fixtures
- OpenAI analyzer response normalization using mocked SDK or mocked transport

### Manual verification

Because `Photos.app` automation and vision analysis depend on external systems, the MVP also needs manual validation on macOS:

- `sync` with a real Screenshots album
- `analyze` with a real `OPENAI_API_KEY`
- `run` end-to-end

## Implementation Approach

Recommended implementation order:

1. Build core config, paths, state store, hashing, and Markdown utilities
2. Build service layer against mocked `ImageSource` and `ScreenshotAnalyzer`
3. Add failing tests for `sync`, `analyze`, and `run` command behavior
4. Implement the `Photos.app` source adapter
5. Implement the OpenAI analyzer adapter
6. Validate end-to-end manually on macOS

This order protects the abstractions before binding to AppleScript and OpenAI.

## Open Questions Resolved

- No `init` command
- Fixed root path is `~/.shotnote/`
- First provider is OpenAI
- `Photos.app` source and model analyzer are both hard boundaries, not embedded implementation details
