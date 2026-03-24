---
name: shotnote
description: Use when using or documenting the shotnote CLI to pull screenshots from macOS Photos, sync them into ~/.shotnote/inbox, and analyze them into Markdown notes in ~/.shotnote/notes.
---

# Shotnote

Start here:

```bash
shotnote --help
shotnote sync --help
shotnote analyze --help
shotnote run --help
```

Default flow:

```bash
shotnote sync --limit 5
shotnote analyze
```

Use `shotnote sync --limit 5` for the first sync bootstrap. After that, use `shotnote sync`.

Default source:

- pull from the `Screenshots` collection in macOS Photos
- sync images into `~/.shotnote/inbox/`
- write analysis notes into `~/.shotnote/notes/`

Prompt tuning:

```bash
shotnote analyze --image <filename> --force
```

Use file names from `~/.shotnote/inbox/`, not paths.
