import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";

import { createStateStore } from "./state-store.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shotnote-state-test-"));
  tempRoots.push(dir);
  return dir;
}

describe("createStateStore", () => {
  it("returns an empty state when the file does not exist", async () => {
    const tempDir = await createTempDir();
    const store = createStateStore(path.join(tempDir, "state.json"));

    await expect(store.read()).resolves.toEqual({ byHash: {} });
  });

  it("persists records keyed by hash", async () => {
    const tempDir = await createTempDir();
    const statePath = path.join(tempDir, "state.json");
    const store = createStateStore(statePath);

    await store.write({
      byHash: {
        abc123: {
          imagePath: "/tmp/example.png",
          syncedAt: "2026-03-24T12:00:00.000Z",
          source: "photos-album"
        }
      }
    });

    await expect(store.read()).resolves.toEqual({
      byHash: {
        abc123: {
          imagePath: "/tmp/example.png",
          syncedAt: "2026-03-24T12:00:00.000Z",
          source: "photos-album"
        }
      }
    });
  });
});
