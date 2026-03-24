# Shotnote MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS-only `shotnote` CLI that lists Photos albums, syncs screenshots from `Photos.app` into `~/.shotnote/inbox/`, analyzes unprocessed images with an OpenAI vision model using a user-editable Markdown prompt, and writes one Markdown note per image into `~/.shotnote/notes/`.

**Architecture:** The CLI layer parses commands and delegates to services. Services handle config, prompt loading, state, hashing, and Markdown rendering. Integrations with `Photos.app` and OpenAI are isolated behind `ImageSource` and `ScreenshotAnalyzer` interfaces so future source or model providers can be added without changing orchestration code.

**Tech Stack:** Node.js, TypeScript, commander, execa, fs-extra, fast-glob, openai, zod, slugify, vitest

---

## Chunk 1: Scaffold Project and Core Utilities

### Task 1: Create package and TypeScript scaffold

**Files:**
- Create: `/Users/song.yue/git/shotnote/package.json`
- Create: `/Users/song.yue/git/shotnote/tsconfig.json`
- Create: `/Users/song.yue/git/shotnote/vitest.config.ts`
- Create: `/Users/song.yue/git/shotnote/.gitignore`

- [ ] **Step 1: Write the failing test**

Create a smoke test that imports the config module path that will exist after scaffolding.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/config.test.ts`
Expected: FAIL because files do not exist yet

- [ ] **Step 3: Write minimal implementation**

Add package metadata, scripts, TypeScript config, Vitest config, and ignore rules.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/config.test.ts`
Expected: PASS or the test file resolves imports successfully after next task fills content

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold shotnote cli project"
```

### Task 2: Add paths, config, and prompt bootstrap utilities

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/core/types.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/paths.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/config.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/prompt-store.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/config.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- resolving `~/.shotnote` paths
- applying defaults
- reading `OPENAI_API_KEY`
- bootstrapping `prompts/analyze-screenshot.md`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/config.test.ts`
Expected: FAIL with missing modules or missing behavior

- [ ] **Step 3: Write minimal implementation**

Implement config resolution, root path helpers, directory creation, and prompt bootstrap loader.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/paths.ts src/core/config.ts src/core/prompt-store.ts src/core/config.test.ts
git commit -m "feat: add config and prompt bootstrap"
```

### Task 3: Add hashing, state storage, and Markdown rendering

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/core/hashing.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/state-store.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/markdown.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/state-store.test.ts`
- Create: `/Users/song.yue/git/shotnote/src/core/markdown.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- stable `sha256` hashing
- reading and writing sync/analyze state
- rendering Markdown with raw JSON and fallback metadata

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/state-store.test.ts src/core/markdown.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implement hash helper, JSON-backed state store, and Markdown renderer.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/state-store.test.ts src/core/markdown.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/hashing.ts src/core/state-store.ts src/core/markdown.ts src/core/state-store.test.ts src/core/markdown.test.ts
git commit -m "feat: add state and markdown utilities"
```

## Chunk 2: Build Service Layer Against Interfaces

### Task 4: Define source and analyzer interfaces

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/adapters/photo-source/photo-source.ts`
- Create: `/Users/song.yue/git/shotnote/src/adapters/analyzers/analyzer.ts`
- Modify: `/Users/song.yue/git/shotnote/src/core/types.ts`

- [ ] **Step 1: Write the failing test**

Add a service-level test file that imports these interfaces and typed domain results.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/services/sync-service.test.ts`
Expected: FAIL because interfaces and services do not exist

- [ ] **Step 3: Write minimal implementation**

Add shared types and interfaces for album listing, syncing, and screenshot analysis.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/services/sync-service.test.ts`
Expected: Import resolution succeeds once next task provides the service

- [ ] **Step 5: Commit**

```bash
git add src/adapters/photo-source/photo-source.ts src/adapters/analyzers/analyzer.ts src/core/types.ts
git commit -m "feat: define source and analyzer interfaces"
```

### Task 5: Implement sync service with mocked source adapter

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/services/sync-service.ts`
- Create: `/Users/song.yue/git/shotnote/src/services/sync-service.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- listing albums through the source abstraction
- skipping duplicate hashes
- persisting synced state for new files

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/services/sync-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implement the sync service against the `ImageSource` interface and state store.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/services/sync-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/sync-service.ts src/services/sync-service.test.ts
git commit -m "feat: add sync service"
```

### Task 6: Implement analyze service with mocked analyzer adapter

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/services/analyze-service.ts`
- Create: `/Users/song.yue/git/shotnote/src/services/analyze-service.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- scanning supported image files
- skipping already analyzed hashes
- loading prompt text before analysis
- writing flattened note files with date-prefixed names
- recording degraded output when analyzer warnings exist

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/services/analyze-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implement the analyze service against the `ScreenshotAnalyzer` interface, prompt loader, and Markdown renderer.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/services/analyze-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/analyze-service.ts src/services/analyze-service.test.ts
git commit -m "feat: add analyze service"
```

## Chunk 3: Add Real Adapters

### Task 7: Implement Photos album listing and export adapter

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/adapters/photo-source/export-screenshots.applescript`
- Create: `/Users/song.yue/git/shotnote/src/adapters/photo-source/index.ts`
- Create: `/Users/song.yue/git/shotnote/src/adapters/photo-source/photos-app-source.ts`
- Create: `/Users/song.yue/git/shotnote/src/adapters/photo-source/photos-app-source.test.ts`
- Create: `/Users/song.yue/git/shotnote/src/adapters/photo-source/fixtures/list-albums.txt`
- Create: `/Users/song.yue/git/shotnote/src/adapters/photo-source/fixtures/sync-output.txt`

- [ ] **Step 1: Write the failing test**

Add tests for:
- parsing album listings from `osascript` output
- parsing exported file results from `osascript` output
- surfacing adapter-friendly errors

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/adapters/photo-source/photos-app-source.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implement AppleScript-backed album listing and export adapter using `osascript`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/adapters/photo-source/photos-app-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/photo-source
git commit -m "feat: add photos app source adapter"
```

### Task 8: Implement OpenAI analyzer adapter

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/adapters/analyzers/openai-analyzer.ts`
- Create: `/Users/song.yue/git/shotnote/src/adapters/analyzers/openai-analyzer.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- request normalization from file path and prompt text
- parsing structured JSON output
- degraded parse fallback when JSON is invalid

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/adapters/analyzers/openai-analyzer.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implement OpenAI SDK integration and response normalization.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/adapters/analyzers/openai-analyzer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/analyzers/openai-analyzer.ts src/adapters/analyzers/openai-analyzer.test.ts
git commit -m "feat: add openai analyzer adapter"
```

## Chunk 4: Wire the CLI

### Task 9: Implement command handlers and entrypoint

**Files:**
- Create: `/Users/song.yue/git/shotnote/src/commands/list-albums.ts`
- Create: `/Users/song.yue/git/shotnote/src/commands/sync.ts`
- Create: `/Users/song.yue/git/shotnote/src/commands/analyze.ts`
- Create: `/Users/song.yue/git/shotnote/src/commands/run.ts`
- Create: `/Users/song.yue/git/shotnote/src/cli.ts`
- Create: `/Users/song.yue/git/shotnote/src/cli.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- command registration
- `list-albums`, `sync`, `analyze`, and `run` calling the right services
- `run` executing sync before analyze

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/cli.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implement commander-based CLI and wire dependencies.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/cli.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands src/cli.ts src/cli.test.ts
git commit -m "feat: add shotnote cli commands"
```

### Task 10: Verify end-to-end local behavior and polish docs

**Files:**
- Modify: `/Users/song.yue/git/shotnote/README.md`
- Modify: `/Users/song.yue/git/shotnote/package.json`

- [ ] **Step 1: Write the failing test**

Add or update a smoke test for default prompt creation and command help output if needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run`
Expected: FAIL if smoke behavior is not implemented yet

- [ ] **Step 3: Write minimal implementation**

Add README usage, scripts, and any final command polish needed for a usable MVP.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs: document shotnote cli usage"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-24-shotnote-mvp-implementation.md`. Ready to execute.
