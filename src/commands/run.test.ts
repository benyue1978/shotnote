import { describe, expect, it, vi } from "vitest";

import { SyncExecutionError } from "../services/sync-service.js";
import { runRunCommand } from "./run.js";

describe("runRunCommand", () => {
  it("prints sync diagnostics before analyze output", async () => {
    const writeLine = vi.fn();

    await runRunCommand({
      sourceLabel: "Screenshots",
      sync: vi.fn().mockResolvedValue({
        discoveredCount: 2,
        sourceSkippedCount: 0,
        newCount: 1,
        duplicateCount: 1,
        syncMode: "incremental",
        effectiveRequest: {
          since: "2026-04-08T10:24:05.000Z"
        }
      }),
      analyze: vi.fn().mockResolvedValue({
        analyzedCount: 1,
        skippedCount: 2
      }),
      writeLine
    });

    expect(writeLine.mock.calls.map((call) => call[0])).toEqual([
      "sync source: Screenshots",
      "sync mode: incremental after 2026-04-08T10:24:05.000Z",
      "sync discovered: 2 candidate image(s), source skipped 0 duplicate file(s)",
      "synced 1 new image(s), skipped 1 duplicate(s)",
      "analyzed 1 image(s), skipped 2 existing image(s)"
    ]);
  });

  it("surfaces photo permission denial in stdout-oriented logs before rethrowing", async () => {
    const writeLine = vi.fn();

    await expect(
      runRunCommand({
        sourceLabel: "Screenshots",
        sync: vi.fn().mockRejectedValue(
          new SyncExecutionError("Photo library access was denied.", {
            syncMode: "incremental",
            effectiveRequest: {
              since: "2026-04-08T10:24:05.000Z"
            }
          })
        ),
        analyze: vi.fn(),
        writeLine
      })
    ).rejects.toThrow("Photo library access was denied.");

    expect(writeLine.mock.calls.map((call) => call[0])).toEqual([
      "sync source: Screenshots",
      "sync mode: incremental after 2026-04-08T10:24:05.000Z",
      "hint: Photos permission may depend on which host app is running shotnote."
    ]);
  });
});
