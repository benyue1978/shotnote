import { describe, expect, it, vi } from "vitest";

import { runAnalyzeCommand } from "./analyze.js";

describe("runAnalyzeCommand", () => {
  it("prints queue size and per-image progress before the final summary", async () => {
    const writeLine = vi.fn();

    await runAnalyzeCommand({
      analyze: vi.fn().mockImplementation(async (_request, onProgress) => {
        onProgress?.({ kind: "start", total: 2, pending: 1, skipped: 1 });
        onProgress?.({
          kind: "item",
          state: "processing",
          index: 1,
          total: 1,
          imageName: "2026-03-24-one.png"
        });
        onProgress?.({
          kind: "item",
          state: "done",
          index: 1,
          total: 1,
          imageName: "2026-03-24-one.png"
        });

        return {
          analyzedCount: 1,
          skippedCount: 1
        };
      }),
      writeLine
    });

    expect(writeLine).toHaveBeenNthCalledWith(1, "analyze scan: 2 image(s) in inbox");
    expect(writeLine).toHaveBeenNthCalledWith(2, "analyze plan: 1 to process, 1 already analyzed");
    expect(writeLine).toHaveBeenNthCalledWith(3, "analyze 1/1 processing: 2026-03-24-one.png");
    expect(writeLine).toHaveBeenNthCalledWith(4, "analyze 1/1 done: 2026-03-24-one.png");
    expect(writeLine).toHaveBeenNthCalledWith(5, "analyzed 1 image(s), skipped 1 existing image(s)");
  });
});
