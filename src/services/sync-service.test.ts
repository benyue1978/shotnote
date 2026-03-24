import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ImageSource } from "../adapters/photo-source/photo-source.js";
import { createStateStore } from "../core/state-store.js";
import { createSyncService } from "./sync-service.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shotnote-sync-service-test-"));
  tempRoots.push(dir);
  return dir;
}

describe("createSyncService", () => {
  it("lists albums through the source abstraction", async () => {
    const source: ImageSource = {
      async listAlbums() {
        return ["Screenshots", "截屏"];
      },
      async syncNewImages() {
        return {
          discoveredCount: 0,
          exported: [],
          skippedCount: 0,
          warnings: []
        };
      }
    };

    const tempDir = await createTempDir();
    const service = createSyncService({
      source,
      syncedStateStore: createStateStore(path.join(tempDir, "synced.json"))
    });

    await expect(service.listAlbums()).resolves.toEqual(["Screenshots", "截屏"]);
  });

  it("persists only new hashes from sync results", async () => {
    const tempDir = await createTempDir();
    const stateStore = createStateStore(path.join(tempDir, "synced.json"));

    await stateStore.write({
      byHash: {
        known: {
          imagePath: "/tmp/existing.png",
          syncedAt: "2026-03-24T12:00:00.000Z",
          source: "photos-album"
        }
      }
    });

    const source: ImageSource = {
      async listAlbums() {
        return [];
      },
      async syncNewImages() {
        return {
          discoveredCount: 2,
          exported: [
            {
              originalPath: "/tmp/existing.png",
              imagePath: "/tmp/existing.png",
              hash: "known"
            },
            {
              originalPath: "/tmp/new.png",
              imagePath: "/tmp/new.png",
              hash: "new-hash"
            }
          ],
          skippedCount: 0,
          warnings: []
        };
      }
    };

    const service = createSyncService({
      source,
      syncedStateStore: stateStore,
      now: () => "2026-03-24T12:30:00.000Z"
    });

    const result = await service.sync();
    const state = await stateStore.read();

    expect(result.newCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(state.byHash["new-hash"]).toEqual({
      imagePath: "/tmp/new.png",
      discoveredAt: undefined,
      syncedAt: "2026-03-24T12:30:00.000Z",
      source: "photos-album"
    });
  });

  it("uses limit only on the first sync", async () => {
    const tempDir = await createTempDir();
    const stateStore = createStateStore(path.join(tempDir, "synced.json"));
    const syncNewImages = afterFirstCallResult();

    const source: ImageSource = {
      async listAlbums() {
        return [];
      },
      syncNewImages
    };

    const service = createSyncService({
      source,
      syncedStateStore: stateStore,
      now: () => "2026-03-24T12:30:00.000Z"
    });

    await service.sync({ limit: 5 });

    expect(syncNewImages).toHaveBeenCalledWith({ limit: 5 });
  });

  it("uses the latest sync time as the cutoff after the first sync", async () => {
    const tempDir = await createTempDir();
    const stateStore = createStateStore(path.join(tempDir, "synced.json"));
    const syncNewImages = afterFirstCallResult();

    await stateStore.write({
      byHash: {
        known: {
          imagePath: "/tmp/existing.png",
          syncedAt: "2026-03-24T12:30:00.000Z",
          source: "photos-album"
        }
      }
    });

    const source: ImageSource = {
      async listAlbums() {
        return [];
      },
      syncNewImages
    };

    const service = createSyncService({
      source,
      syncedStateStore: stateStore,
      now: () => "2026-03-24T13:00:00.000Z"
    });

    await service.sync({ limit: 5 });

    expect(syncNewImages).toHaveBeenCalledWith({ since: "2026-03-24T12:30:00.000Z" });
  });
});

function afterFirstCallResult() {
  return vi.fn().mockResolvedValue({
    discoveredCount: 0,
    exported: [],
    skippedCount: 0,
    warnings: []
  });
}
