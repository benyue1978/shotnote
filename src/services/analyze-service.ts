import path from "node:path";

import fg from "fast-glob";
import fs from "fs-extra";

import type { ScreenshotAnalyzer } from "../adapters/analyzers/analyzer.js";
import { renderMarkdownNote } from "../core/markdown.js";
import { sha256File } from "../core/hashing.js";
import { toSlug } from "../core/slug.js";
import type { AnalyzeProgressEvent, AnalyzeRequest, AnalyzeSummary, HashState } from "../core/types.js";

const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".heic"]);

type AnalyzeServiceOptions = {
  analyzer: ScreenshotAnalyzer;
  analyzedStateStore: {
    read(): Promise<HashState>;
    write(state: HashState): Promise<void>;
  };
  inboxDir: string;
  notesDir: string;
  promptPath: string;
  now?: () => string;
};

export function createAnalyzeService(options: AnalyzeServiceOptions) {
  return {
    async analyze(request: AnalyzeRequest = {}, onProgress?: (event: AnalyzeProgressEvent) => void): Promise<AnalyzeSummary> {
      const analyzedState = await options.analyzedStateStore.read();
      const prompt = await fs.readFile(options.promptPath, "utf8");
      const files = await fg(["*"], {
        cwd: options.inboxDir,
        absolute: true,
        onlyFiles: true
      });
      const imageFiles = files.filter((file) => supportedExtensions.has(path.extname(file).toLowerCase()));
      const selectedFiles = selectImageFiles(imageFiles, request.imageName);
      const plannedItems = await Promise.all(
        selectedFiles.map(async (imagePath) => {
          const hash = await sha256File(imagePath);
          const previousRecord = analyzedState.byHash[hash];
          const shouldSkip = Boolean(previousRecord && !request.force);

          return {
            imagePath,
            hash,
            previousRecord,
            shouldSkip
          };
        })
      );
      const pendingItems = plannedItems.filter((item) => !item.shouldSkip);
      let analyzedCount = 0;
      let skippedCount = 0;

      await fs.ensureDir(options.notesDir);
      onProgress?.({
        kind: "start",
        total: selectedFiles.length,
        pending: pendingItems.length,
        skipped: plannedItems.length - pendingItems.length
      });

      let processedIndex = 0;

      for (const item of plannedItems) {
        if (item.shouldSkip) {
          skippedCount += 1;
          continue;
        }

        processedIndex += 1;
        const imageName = path.basename(item.imagePath);
        onProgress?.({
          kind: "item",
          state: "processing",
          index: processedIndex,
          total: pendingItems.length,
          imageName
        });
        const result = await options.analyzer.analyze({ imagePath: item.imagePath, prompt });
        const analyzedAt = options.now?.() ?? new Date().toISOString();
        const notePath = path.join(options.notesDir, buildNoteFileName(result.analysis.title, item.hash, analyzedAt));
        const markdown = renderMarkdownNote({
          analysis: result.analysis,
          sourceImagePath: item.imagePath,
          analyzedAt,
          model: result.model,
          raw: result.raw,
          warnings: result.warnings
        });

        await fs.writeFile(notePath, markdown);
        await removePreviousNote(item.previousRecord?.notePath, notePath);

        analyzedState.byHash[item.hash] = {
          imagePath: item.imagePath,
          notePath,
          analyzedAt,
          model: result.model
        };
        analyzedCount += 1;
        onProgress?.({
          kind: "item",
          state: "done",
          index: processedIndex,
          total: pendingItems.length,
          imageName
        });
      }

      await options.analyzedStateStore.write(analyzedState);

      return {
        analyzedCount,
        skippedCount
      };
    }
  };
}

async function removePreviousNote(previousNotePath: string | undefined, nextNotePath: string) {
  if (!previousNotePath || previousNotePath === nextNotePath) {
    return;
  }

  try {
    await fs.remove(previousNotePath);
  } catch (error) {
    console.warn(
      `Failed to remove previous note file: ${previousNotePath}`,
      error instanceof Error ? error.message : error
    );
  }
}

function selectImageFiles(imageFiles: string[], imageName?: string) {
  if (!imageName) {
    return imageFiles;
  }

  const matchedFile = imageFiles.find((filePath) => path.basename(filePath) === imageName);

  if (!matchedFile) {
    throw new Error(`Image not found in inbox: ${imageName}`);
  }

  return [matchedFile];
}

function buildNoteFileName(title: string, hash: string, analyzedAt: string) {
  const datePrefix = analyzedAt.slice(0, 10);
  const slug = toSlug(title) || "note";

  return `${datePrefix}-${slug}-${hash.slice(0, 6)}.md`;
}
