import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPhotosAppSource, parseAlbumListOutput, parseExportRecords } from "./photos-app-source.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shotnote-photos-source-test-"));
  tempRoots.push(dir);
  return dir;
}

describe("parseAlbumListOutput", () => {
  it("returns non-empty album names line by line", () => {
    expect(parseAlbumListOutput("Screenshots\n截屏\n\nFavorites\n")).toEqual([
      "Screenshots",
      "截屏",
      "Favorites"
    ]);
  });
});

describe("parseExportRecords", () => {
  it("returns exported file records line by line", () => {
    expect(parseExportRecords("/tmp/a.png\t2026-03-20\n/tmp/b.png\n")).toEqual([
      { path: "/tmp/a.png", discoveredAt: "2026-03-20" },
      { path: "/tmp/b.png", discoveredAt: undefined }
    ]);
  });
});

describe("createPhotosAppSource", () => {
  it("lists albums using the injected AppleScript runner", async () => {
    const source = createPhotosAppSource({
      albumName: "Screenshots",
      inboxDir: "/tmp/inbox",
      runAppleScript: vi.fn().mockResolvedValue("Screenshots\n截屏\n")
    });

    await expect(source.listAlbums()).resolves.toEqual(["Screenshots", "截屏"]);
  });

  it("exports album files, deduplicates against inbox content hashes, and moves only new files", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const existingPath = path.join(inboxDir, "2026-03-24-existing-a1b2c3.png");

    await fs.ensureDir(inboxDir);
    await fs.writeFile(existingPath, "same-content");

    const exportedDir = path.join(tempDir, "exported");
    const firstExport = path.join(exportedDir, "IMG_001.PNG");
    const secondExport = path.join(exportedDir, "IMG_002.PNG");

    const source = createPhotosAppSource({
      albumName: "QQ",
      inboxDir,
      now: () => "2026-03-24T12:30:00.000Z",
      runAppleScript: vi.fn().mockImplementation(async (_scriptPath: string, args: string[]) => {
        if (args[0] === "sync") {
          await fs.ensureDir(exportedDir);
          await fs.writeFile(firstExport, "same-content");
          await fs.writeFile(secondExport, "new-content");
          return `${firstExport}\t2026-03-20\n${secondExport}\t2026-03-21\n`;
        }

        return "";
      })
    });

    const result = await source.syncNewImages();
    const inboxFiles = (await fs.readdir(inboxDir)).sort();

    expect(result.discoveredCount).toBe(2);
    expect(result.exported).toHaveLength(1);
    expect(result.skippedCount).toBe(1);
    expect(inboxFiles).toEqual([
      expect.stringMatching(/^2026-03-21-img-002-[a-f0-9]{6}\.png$/),
      "2026-03-24-existing-a1b2c3.png"
    ]);
  });

  it("uses the swift helper for the Screenshots smart collection", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const exportedDir = path.join(tempDir, "swift-exported");
    const exportedFile = path.join(exportedDir, "Screenshot 2026-03-24 at 12.00.00.png");
    const runSwiftHelper = vi.fn().mockImplementation(async () => {
      await fs.ensureDir(exportedDir);
      await fs.writeFile(exportedFile, "new-content");
      return `${exportedFile}\t2026-03-18\n`;
    });
    const ensureSwiftHelper = vi.fn().mockResolvedValue(path.join(tempDir, "bin", "shotnote-photos-helper"));
    const runAppleScript = vi.fn();

    const source = createPhotosAppSource({
      albumName: "Screenshots",
      inboxDir,
      helperBinDir: path.join(tempDir, "bin"),
      now: () => "2026-03-24T12:30:00.000Z",
      runAppleScript,
      runSwiftHelper,
      ensureSwiftHelper
    });

    const result = await source.syncNewImages();
    const inboxFiles = await fs.readdir(inboxDir);

    expect(runSwiftHelper).toHaveBeenCalledTimes(1);
    expect(runSwiftHelper).toHaveBeenCalledWith(
      path.join(tempDir, "bin", "shotnote-photos-helper"),
      ["export-screenshots", expect.any(String), "0"]
    );
    expect(ensureSwiftHelper).toHaveBeenCalledTimes(1);
    expect(runAppleScript).not.toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(["sync"]));
    expect(result.discoveredCount).toBe(1);
    expect(inboxFiles[0]).toMatch(/^2026-03-18-screenshot-2026-03-24-at-12-00-00-[a-f0-9]{6}\.png$/);
  });

  it("passes limit to the swift helper", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const exportedDir = path.join(tempDir, "swift-exported");
    const exportedFile = path.join(exportedDir, "Screenshot 2026-03-24 at 12.00.00.png");
    const runSwiftHelper = vi.fn().mockImplementation(async () => {
      await fs.ensureDir(exportedDir);
      await fs.writeFile(exportedFile, "new-content");
      return `${exportedFile}\t2026-03-18\n`;
    });

    const source = createPhotosAppSource({
      albumName: "Screenshots",
      inboxDir,
      helperBinDir: path.join(tempDir, "bin"),
      runSwiftHelper,
      ensureSwiftHelper: vi.fn().mockResolvedValue(path.join(tempDir, "bin", "shotnote-photos-helper"))
    });

    await source.syncNewImages({ limit: 5 });

    expect(runSwiftHelper).toHaveBeenCalledWith(
      path.join(tempDir, "bin", "shotnote-photos-helper"),
      ["export-screenshots", expect.any(String), "5"]
    );
  });

  it("passes since to the swift helper when doing incremental sync", async () => {
    const tempDir = await createTempDir();
    const inboxDir = path.join(tempDir, "inbox");
    const exportedDir = path.join(tempDir, "swift-exported");
    const exportedFile = path.join(exportedDir, "Screenshot 2026-03-24 at 12.00.00.png");
    const runSwiftHelper = vi.fn().mockImplementation(async () => {
      await fs.ensureDir(exportedDir);
      await fs.writeFile(exportedFile, "new-content");
      return `${exportedFile}\t2026-03-24\n`;
    });

    const source = createPhotosAppSource({
      albumName: "Screenshots",
      inboxDir,
      helperBinDir: path.join(tempDir, "bin"),
      runSwiftHelper,
      ensureSwiftHelper: vi.fn().mockResolvedValue(path.join(tempDir, "bin", "shotnote-photos-helper"))
    });

    await source.syncNewImages({ since: "2026-03-24T12:30:00.000Z" });

    expect(runSwiftHelper).toHaveBeenCalledWith(
      path.join(tempDir, "bin", "shotnote-photos-helper"),
      ["export-screenshots", expect.any(String), "0", "2026-03-24T12:30:00.000Z"]
    );
  });
});
