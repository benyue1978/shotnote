import { describe, expect, it, vi } from "vitest";

import { runSyncCommand } from "./sync.js";
import { SyncExecutionError } from "../services/sync-service.js";

describe("runSyncCommand", () => {
  it("prints the source and effective incremental cutoff before syncing", async () => {
    const writeLine = vi.fn();

    await runSyncCommand({
      sync: vi.fn().mockResolvedValue({
        discoveredCount: 0,
        sourceSkippedCount: 0,
        newCount: 0,
        duplicateCount: 0,
        syncMode: "incremental",
        effectiveRequest: {
          since: "2026-03-24T09:56:15.632Z"
        }
      }),
      writeLine,
      sourceLabel: "Screenshots"
    });

    expect(writeLine).toHaveBeenNthCalledWith(1, "sync source: Screenshots");
    expect(writeLine).toHaveBeenNthCalledWith(2, "sync mode: incremental after 2026-03-24T09:56:15.632Z");
    expect(writeLine).toHaveBeenNthCalledWith(3, "sync discovered: 0 candidate image(s), source skipped 0 duplicate file(s)");
    expect(writeLine).toHaveBeenNthCalledWith(4, "synced 0 new image(s), skipped 0 duplicate(s)");
  });

  it("prints first-sync bootstrap mode when limit is used", async () => {
    const writeLine = vi.fn();

    await runSyncCommand({
      sync: vi.fn().mockResolvedValue({
        discoveredCount: 2,
        sourceSkippedCount: 1,
        newCount: 2,
        duplicateCount: 0,
        syncMode: "initial",
        effectiveRequest: {
          limit: 5
        }
      }),
      writeLine,
      sourceLabel: "Screenshots"
    }, {
      limit: 5
    });

    expect(writeLine).toHaveBeenNthCalledWith(1, "sync source: Screenshots");
    expect(writeLine).toHaveBeenNthCalledWith(2, "sync mode: first sync bootstrap (limit 5)");
    expect(writeLine).toHaveBeenNthCalledWith(3, "sync discovered: 2 candidate image(s), source skipped 1 duplicate file(s)");
    expect(writeLine).toHaveBeenNthCalledWith(4, "synced 2 new image(s), skipped 0 duplicate(s)");
  });

  it("prints source, attempted mode, and a permission hint on permission failure", async () => {
    const writeLine = vi.fn();

    await expect(
      runSyncCommand({
        sync: vi.fn().mockRejectedValue(
          new SyncExecutionError("Photo library access was denied.", {
            syncMode: "incremental",
            effectiveRequest: {
              since: "2026-03-24T09:56:15.632Z"
            }
          })
        ),
        writeLine,
        sourceLabel: "Screenshots"
      })
    ).rejects.toThrow("Photo library access was denied.");

    expect(writeLine).toHaveBeenNthCalledWith(1, "sync source: Screenshots");
    expect(writeLine).toHaveBeenNthCalledWith(2, "sync mode: incremental after 2026-03-24T09:56:15.632Z");
    expect(writeLine).toHaveBeenNthCalledWith(
      3,
      "hint: Photos permission may depend on which host app is running shotnote."
    );
  });
});
