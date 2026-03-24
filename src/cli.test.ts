import { describe, expect, it, vi } from "vitest";

import { createCli } from "./cli.js";

describe("createCli", () => {
  it("wires list-albums to the sync service", async () => {
    const listAlbums = vi.fn().mockResolvedValue(["Screenshots"]);
    const writeLine = vi.fn();
    const cli = createCli({
      syncService: {
        listAlbums,
        sync: vi.fn()
      },
      analyzeService: {
        analyze: vi.fn()
      },
      writeLine
    });

    await cli.parseAsync(["node", "shotnote", "list-albums"]);

    expect(listAlbums).toHaveBeenCalledTimes(1);
    expect(writeLine).toHaveBeenCalledWith("Screenshots");
  });

  it("runs sync and analyze in order for the run command", async () => {
    const order: string[] = [];
    const cli = createCli({
      syncService: {
        listAlbums: vi.fn(),
        sync: vi.fn().mockImplementation(async () => {
          order.push("sync");
          return { newCount: 1, duplicateCount: 0 };
        })
      },
      analyzeService: {
        analyze: vi.fn().mockImplementation(async () => {
          order.push("analyze");
          return { analyzedCount: 1, skippedCount: 0 };
        })
      },
      writeLine: vi.fn()
    });

    await cli.parseAsync(["node", "shotnote", "run"]);

    expect(order).toEqual(["sync", "analyze"]);
  });

  it("passes image and force flags to analyze", async () => {
    const analyze = vi.fn().mockResolvedValue({ analyzedCount: 1, skippedCount: 0 });
    const cli = createCli({
      syncService: {
        listAlbums: vi.fn(),
        sync: vi.fn()
      },
      analyzeService: {
        analyze
      },
      writeLine: vi.fn()
    });

    await cli.parseAsync(["node", "shotnote", "analyze", "--image", "2026-03-24-existing.png", "--force"]);

    expect(analyze).toHaveBeenCalledWith({
      imageName: "2026-03-24-existing.png",
      force: true
    });
  });

  it("rejects force without image", async () => {
    const cli = createCli({
      syncService: {
        listAlbums: vi.fn(),
        sync: vi.fn()
      },
      analyzeService: {
        analyze: vi.fn()
      },
      writeLine: vi.fn()
    });

    await expect(cli.parseAsync(["node", "shotnote", "analyze", "--force"])).rejects.toThrow(
      "--force requires --image"
    );
  });
});
