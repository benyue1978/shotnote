import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPhotosAppSource, parseAlbumListOutput, parseExportOutput } from "./photos-app-source.js";

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

describe("parseExportOutput", () => {
  it("returns exported file paths line by line", () => {
    expect(parseExportOutput("/tmp/a.png\n/tmp/b.png\n")).toEqual(["/tmp/a.png", "/tmp/b.png"]);
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
      albumName: "Screenshots",
      inboxDir,
      now: () => "2026-03-24T12:30:00.000Z",
      runAppleScript: vi.fn().mockImplementation(async (_scriptPath: string, args: string[]) => {
        if (args[0] === "sync") {
          await fs.ensureDir(exportedDir);
          await fs.writeFile(firstExport, "same-content");
          await fs.writeFile(secondExport, "new-content");
          return `${firstExport}\n${secondExport}\n`;
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
      "2026-03-24-existing-a1b2c3.png",
      expect.stringMatching(/^2026-03-24-img-002-[a-f0-9]{6}\.png$/)
    ]);
  });
});
