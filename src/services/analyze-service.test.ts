import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";

import type { ScreenshotAnalyzer } from "../adapters/analyzers/analyzer.js";
import { sha256File } from "../core/hashing.js";
import { createStateStore } from "../core/state-store.js";
import { createAnalyzeService } from "./analyze-service.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shotnote-analyze-service-test-"));
  tempRoots.push(dir);
  return dir;
}

describe("createAnalyzeService", () => {
  it("analyzes only supported files that have not been processed yet", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const notesDir = path.join(tempDir, "notes");
    const promptPath = path.join(tempDir, "prompts", "analyze-screenshot.md");
    const stateStore = createStateStore(path.join(tempDir, "analyzed.json"));
    const imagePath = path.join(inboxDir, "2026-03-24-langgraph.png");

    await fs.ensureDir(inboxDir);
    await fs.ensureDir(path.dirname(promptPath));
    await fs.writeFile(promptPath, "# Analyze screenshots");
    await fs.writeFile(imagePath, "image-content");
    await fs.writeFile(path.join(inboxDir, "ignore.txt"), "not an image");

    const analyzerCalls: Array<{ imagePath: string; prompt: string }> = [];
    const analyzer: ScreenshotAnalyzer = {
      async analyze(input) {
        analyzerCalls.push(input);
        return {
          analysis: {
            type: "git-repo",
            title: "LangGraph",
            summary: "A GitHub repository screenshot.",
            whyInteresting: "Could be useful later.",
            entities: ["LangGraph"],
            tags: ["agents"]
          },
          raw: { ok: true },
          warnings: [],
          model: "gpt-4.1-mini"
        };
      }
    };

    const service = createAnalyzeService({
      analyzer,
      analyzedStateStore: stateStore,
      inboxDir,
      notesDir,
      promptPath,
      now: () => "2026-03-24T12:30:00.000Z"
    });

    const result = await service.analyze();
    const noteFiles = await fs.readdir(notesDir);
    const noteContents = await fs.readFile(path.join(notesDir, noteFiles[0]!), "utf8");

    expect(result.analyzedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(analyzerCalls).toEqual([{ imagePath, prompt: "# Analyze screenshots" }]);
    expect(noteFiles[0]).toMatch(/^2026-03-24-langgraph-/);
    expect(noteContents).toContain("# LangGraph");
  });

  it("skips images whose hash already exists in analyzed state", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const notesDir = path.join(tempDir, "notes");
    const promptPath = path.join(tempDir, "prompts", "analyze-screenshot.md");
    const analyzedStateStore = createStateStore(path.join(tempDir, "analyzed.json"));
    const imagePath = path.join(inboxDir, "2026-03-24-existing.png");

    await fs.ensureDir(inboxDir);
    await fs.ensureDir(path.dirname(promptPath));
    await fs.writeFile(promptPath, "# Analyze screenshots");
    await fs.writeFile(imagePath, "same-content");
    const hash = await sha256File(imagePath);
    await analyzedStateStore.write({
      byHash: {
        [hash]: {
          imagePath,
          analyzedAt: "2026-03-24T12:30:00.000Z",
          notePath: "/tmp/note.md",
          model: "gpt-4.1-mini"
        }
      }
    });

    let analyzeCalls = 0;
    const analyzer: ScreenshotAnalyzer = {
      async analyze() {
        analyzeCalls += 1;
        return {
          analysis: {
            type: "other",
            title: "unused",
            summary: "unused",
            whyInteresting: "unused",
            entities: [],
            tags: []
          },
          raw: {},
          warnings: [],
          model: "gpt-4.1-mini"
        };
      }
    };

    const service = createAnalyzeService({
      analyzer,
      analyzedStateStore,
      inboxDir,
      notesDir,
      promptPath,
      now: () => "2026-03-24T12:30:00.000Z"
    });

    const result = await service.analyze();

    expect(result.analyzedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(analyzeCalls).toBe(0);
  });

  it("re-runs a single inbox image by file name when force is enabled", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const notesDir = path.join(tempDir, "notes");
    const promptPath = path.join(tempDir, "prompts", "analyze-screenshot.md");
    const analyzedStateStore = createStateStore(path.join(tempDir, "analyzed.json"));
    const imagePath = path.join(inboxDir, "2026-03-24-existing.png");

    await fs.ensureDir(inboxDir);
    await fs.ensureDir(path.dirname(promptPath));
    await fs.writeFile(promptPath, "# Analyze screenshots");
    await fs.writeFile(imagePath, "same-content");

    const hash = await sha256File(imagePath);
    await analyzedStateStore.write({
      byHash: {
        [hash]: {
          imagePath,
          analyzedAt: "2026-03-24T12:30:00.000Z",
          notePath: path.join(notesDir, "2026-03-24-old-note.md"),
          model: "gpt-4.1-mini"
        }
      }
    });

    let analyzeCalls = 0;
    const analyzer: ScreenshotAnalyzer = {
      async analyze() {
        analyzeCalls += 1;
        return {
          analysis: {
            type: "website",
            title: "Retried Note",
            summary: "Retried analysis output.",
            whyInteresting: "Prompt tuning test.",
            entities: ["Retried Note"],
            tags: ["retry"]
          },
          raw: {},
          warnings: [],
          model: "gpt-4.1-mini"
        };
      }
    };

    const service = createAnalyzeService({
      analyzer,
      analyzedStateStore,
      inboxDir,
      notesDir,
      promptPath,
      now: () => "2026-03-24T13:00:00.000Z"
    });

    const result = await service.analyze({
      imageName: "2026-03-24-existing.png",
      force: true
    });
    const noteFiles = await fs.readdir(notesDir);
    const state = await analyzedStateStore.read();

    expect(result.analyzedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(analyzeCalls).toBe(1);
    expect(noteFiles[0]).toMatch(/^2026-03-24-retried-note-/);
    expect(state.byHash[hash]?.notePath).toContain("retried-note");
  });

  it("removes the previous note file for the same hash after a forced re-run succeeds", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const notesDir = path.join(tempDir, "notes");
    const promptPath = path.join(tempDir, "prompts", "analyze-screenshot.md");
    const analyzedStateStore = createStateStore(path.join(tempDir, "analyzed.json"));
    const imagePath = path.join(inboxDir, "2026-03-24-existing.png");
    const oldNotePath = path.join(notesDir, "2026-03-24-old-note.md");

    await fs.ensureDir(inboxDir);
    await fs.ensureDir(notesDir);
    await fs.ensureDir(path.dirname(promptPath));
    await fs.writeFile(promptPath, "# Analyze screenshots");
    await fs.writeFile(imagePath, "same-content");
    await fs.writeFile(oldNotePath, "# Old note");

    const hash = await sha256File(imagePath);
    await analyzedStateStore.write({
      byHash: {
        [hash]: {
          imagePath,
          analyzedAt: "2026-03-24T12:30:00.000Z",
          notePath: oldNotePath,
          model: "gpt-4.1-mini"
        }
      }
    });

    const analyzer: ScreenshotAnalyzer = {
      async analyze() {
        return {
          analysis: {
            type: "website",
            title: "Retried Note",
            summary: "Retried analysis output.",
            whyInteresting: "Prompt tuning test.",
            entities: ["Retried Note"],
            tags: ["retry"]
          },
          raw: {},
          warnings: [],
          model: "gpt-4.1-mini"
        };
      }
    };

    const service = createAnalyzeService({
      analyzer,
      analyzedStateStore,
      inboxDir,
      notesDir,
      promptPath,
      now: () => "2026-03-24T13:00:00.000Z"
    });

    await service.analyze({
      imageName: "2026-03-24-existing.png",
      force: true
    });

    const newNoteFiles = await fs.readdir(notesDir);

    expect(await fs.pathExists(oldNotePath)).toBe(false);
    expect(newNoteFiles).toHaveLength(1);
    expect(newNoteFiles[0]).toMatch(/^2026-03-24-retried-note-/);
  });

  it("fails when a requested image name is not found in the inbox", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const notesDir = path.join(tempDir, "notes");
    const promptPath = path.join(tempDir, "prompts", "analyze-screenshot.md");
    const analyzedStateStore = createStateStore(path.join(tempDir, "analyzed.json"));

    await fs.ensureDir(inboxDir);
    await fs.ensureDir(path.dirname(promptPath));
    await fs.writeFile(promptPath, "# Analyze screenshots");

    const analyzer: ScreenshotAnalyzer = {
      async analyze() {
        throw new Error("should not be called");
      }
    };

    const service = createAnalyzeService({
      analyzer,
      analyzedStateStore,
      inboxDir,
      notesDir,
      promptPath
    });

    await expect(
      service.analyze({
        imageName: "missing.png",
        force: true
      })
    ).rejects.toThrow("Image not found in inbox: missing.png");
  });

  it("emits progress events for processing, done, and skipped items", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const notesDir = path.join(tempDir, "notes");
    const promptPath = path.join(tempDir, "prompts", "analyze-screenshot.md");
    const analyzedStateStore = createStateStore(path.join(tempDir, "analyzed.json"));
    const firstImagePath = path.join(inboxDir, "2026-03-24-a.png");
    const secondImagePath = path.join(inboxDir, "2026-03-24-b.png");

    await fs.ensureDir(inboxDir);
    await fs.ensureDir(path.dirname(promptPath));
    await fs.writeFile(promptPath, "# Analyze screenshots");
    await fs.writeFile(firstImagePath, "first-image");
    await fs.writeFile(secondImagePath, "second-image");

    const secondHash = await sha256File(secondImagePath);
    await analyzedStateStore.write({
      byHash: {
        [secondHash]: {
          imagePath: secondImagePath,
          analyzedAt: "2026-03-24T12:30:00.000Z",
          notePath: "/tmp/second.md",
          model: "gpt-4.1-mini"
        }
      }
    });

    const analyzer: ScreenshotAnalyzer = {
      async analyze() {
        return {
          analysis: {
            type: "tool",
            title: "First Image",
            summary: "Processed.",
            whyInteresting: "Useful.",
            entities: ["First"],
            tags: ["tool"]
          },
          raw: {},
          warnings: [],
          model: "gpt-4.1-mini"
        };
      }
    };

    const progressEvents: string[] = [];
    const service = createAnalyzeService({
      analyzer,
      analyzedStateStore,
      inboxDir,
      notesDir,
      promptPath,
      now: () => "2026-03-24T13:00:00.000Z"
    });

    await service.analyze({}, (event) => {
      if (event.kind === "start") {
        progressEvents.push(`start:${event.total}:${event.pending}:${event.skipped}`);
        return;
      }

      progressEvents.push(`${event.index}/${event.total}:${event.state}:${event.imageName}`);
    });

    expect(progressEvents).toEqual([
      "start:2:1:1",
      "1/1:processing:2026-03-24-a.png",
      "1/1:done:2026-03-24-a.png"
    ]);
  });
});
