import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import fg from "fast-glob";
import fs from "fs-extra";

import { sha256File } from "../../core/hashing.js";
import { toSlug } from "../../core/slug.js";
import type { SyncRequest, SyncResult, SyncedImage } from "../../core/types.js";
import type { ImageSource } from "./photo-source.js";
import { ensureSwiftHelper, runSwiftHelperBinary } from "./swift-helper.js";

type RunAppleScript = (scriptPath: string, args: string[]) => Promise<string>;
type RunSwiftHelper = (binaryPath: string, args: string[]) => Promise<string>;
type EnsureSwiftHelper = (options: { sourceScriptPath: string; helperBinDir: string }) => Promise<string>;

type PhotosAppSourceOptions = {
  albumName: string;
  inboxDir: string;
  helperBinDir?: string;
  now?: () => string;
  runAppleScript?: RunAppleScript;
  runSwiftHelper?: RunSwiftHelper;
  ensureSwiftHelper?: EnsureSwiftHelper;
};

const defaultScriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "export-screenshots.applescript"
);
const defaultSwiftHelperPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "export-smart-screenshots.swift"
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

type ExportedRecord = {
  path: string;
  discoveredAt?: string;
};

export function parseExportRecords(output: string): ExportedRecord[] {
  return parseExportOutput(output).map((line) => {
    const [filePath, discoveredAt] = line.split("\t");

    return {
      path: filePath!,
      discoveredAt
    };
  });
}

export function createPhotosAppSource(options: PhotosAppSourceOptions): ImageSource {
  const runAppleScript = options.runAppleScript ?? defaultRunAppleScript;
  const runSwiftHelper = options.runSwiftHelper ?? defaultRunSwiftHelper;
  const ensureHelper = options.ensureSwiftHelper ?? ensureSwiftHelper;

  return {
    async listAlbums() {
      const output = await runAppleScript(defaultScriptPath, ["list-albums"]);
      return parseAlbumListOutput(output);
    },
    async syncNewImages(request?: SyncRequest) {
      await fs.ensureDir(options.inboxDir);
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shotnote-photos-export-"));

      try {
        const output =
          options.albumName === "Screenshots"
            ? await runSwiftHelper(
                await ensureHelper({
                  sourceScriptPath: defaultSwiftHelperPath,
                  helperBinDir: options.helperBinDir ?? path.join(os.homedir(), ".shotnote", "bin")
                }),
                [
                  "export-screenshots",
                  tempDir,
                  String(request?.limit ?? 0),
                  ...(request?.since ? [request.since] : [])
                ]
              )
            : await runAppleScript(defaultScriptPath, ["sync", options.albumName, tempDir]);
        const exportedRecords = parseExportRecords(output);
        const knownHashes = await getInboxHashes(options.inboxDir);
        const discoveredCount = exportedRecords.length;
        const exported: SyncedImage[] = [];
        let skippedCount = 0;

        for (const exportedRecord of exportedRecords) {
          const exportedPath = exportedRecord.path;
          const hash = await sha256File(exportedPath);

          if (knownHashes.has(hash)) {
            skippedCount += 1;
            continue;
          }

          const destinationPath = path.join(
            options.inboxDir,
            buildInboxFileName(
              exportedPath,
              hash,
              exportedRecord.discoveredAt ?? options.now?.() ?? new Date().toISOString()
            )
          );

          await fs.move(exportedPath, destinationPath, { overwrite: false });
          knownHashes.add(hash);
          exported.push({
            originalPath: exportedPath,
            imagePath: destinationPath,
            hash,
            discoveredAt: exportedRecord.discoveredAt
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

async function defaultRunSwiftHelper(binaryPath: string, args: string[]) {
  return runSwiftHelperBinary(binaryPath, args);
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
