import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import fg from "fast-glob";
import fs from "fs-extra";

import { sha256File } from "../../core/hashing.js";
import { toSlug } from "../../core/slug.js";
import type { SyncResult, SyncedImage } from "../../core/types.js";
import type { ImageSource } from "./photo-source.js";

type RunAppleScript = (scriptPath: string, args: string[]) => Promise<string>;

type PhotosAppSourceOptions = {
  albumName: string;
  inboxDir: string;
  now?: () => string;
  runAppleScript?: RunAppleScript;
};

const defaultScriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "export-screenshots.applescript"
);

export function parseAlbumListOutput(output: string) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseExportOutput(output: string) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function createPhotosAppSource(options: PhotosAppSourceOptions): ImageSource {
  const runAppleScript = options.runAppleScript ?? defaultRunAppleScript;

  return {
    async listAlbums() {
      const output = await runAppleScript(defaultScriptPath, ["list-albums"]);
      return parseAlbumListOutput(output);
    },
    async syncNewImages() {
      await fs.ensureDir(options.inboxDir);
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shotnote-photos-export-"));

      try {
        const output = await runAppleScript(defaultScriptPath, ["sync", options.albumName, tempDir]);
        const exportedPaths = parseExportOutput(output);
        const knownHashes = await getInboxHashes(options.inboxDir);
        const discoveredCount = exportedPaths.length;
        const exported: SyncedImage[] = [];
        let skippedCount = 0;

        for (const exportedPath of exportedPaths) {
          const hash = await sha256File(exportedPath);

          if (knownHashes.has(hash)) {
            skippedCount += 1;
            continue;
          }

          const destinationPath = path.join(
            options.inboxDir,
            buildInboxFileName(exportedPath, hash, options.now?.() ?? new Date().toISOString())
          );

          await fs.move(exportedPath, destinationPath, { overwrite: false });
          knownHashes.add(hash);
          exported.push({
            originalPath: exportedPath,
            imagePath: destinationPath,
            hash
          });
        }

        return {
          discoveredCount,
          exported,
          skippedCount,
          warnings: []
        } satisfies SyncResult;
      } finally {
        await fs.remove(tempDir);
      }
    }
  };
}

async function defaultRunAppleScript(scriptPath: string, args: string[]) {
  const result = await execa("osascript", [scriptPath, ...args]);
  return result.stdout;
}

async function getInboxHashes(inboxDir: string) {
  const files = await fg(["*"], {
    cwd: inboxDir,
    absolute: true,
    onlyFiles: true
  });
  const hashes = new Set<string>();

  await Promise.all(
    files.map(async (filePath) => {
      hashes.add(await sha256File(filePath));
    })
  );

  return hashes;
}

function buildInboxFileName(originalPath: string, hash: string, timestamp: string) {
  const datePrefix = timestamp.slice(0, 10);
  const parsedPath = path.parse(originalPath);
  const slug = toSlug(parsedPath.name) || "image";

  return `${datePrefix}-${slug}-${hash.slice(0, 6)}${parsedPath.ext.toLowerCase()}`;
}
