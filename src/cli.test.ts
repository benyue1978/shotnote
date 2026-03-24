import { describe, expect, it, vi } from "vitest";

import { createCli } from "./cli.js";

function createTestCli() {
  return createCli({
    syncService: {
      listAlbums: vi.fn(),
      sync: vi.fn()
    },
    analyzeService: {
      analyze: vi.fn()
    },
    writeLine: vi.fn()
  });
}

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
    const sync = vi.fn().mockImplementation(async () => {
      order.push("sync");
      return { newCount: 1, duplicateCount: 0 };
    });
    const cli = createCli({
      syncService: {
        listAlbums: vi.fn(),
        sync
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
    expect(sync).toHaveBeenCalledTimes(1);
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

  it("passes limit to sync", async () => {
    const sync = vi.fn().mockResolvedValue({ newCount: 1, duplicateCount: 0 });
    const cli = createCli({
      syncService: {
        listAlbums: vi.fn(),
        sync
      },
      analyzeService: {
        analyze: vi.fn()
      },
      writeLine: vi.fn()
    });

    await cli.parseAsync(["node", "shotnote", "sync", "--limit", "20"]);

    expect(sync).toHaveBeenCalledWith({ limit: 20 });
  });

  it("passes limit to run via sync", async () => {
    const sync = vi.fn().mockResolvedValue({ newCount: 1, duplicateCount: 0 });
    const cli = createCli({
      syncService: {
        listAlbums: vi.fn(),
        sync
      },
      analyzeService: {
        analyze: vi.fn().mockResolvedValue({ analyzedCount: 0, skippedCount: 0 })
      },
      writeLine: vi.fn()
    });

    await cli.parseAsync(["node", "shotnote", "run", "--limit", "5"]);

    expect(sync).toHaveBeenCalledWith({ limit: 5 });
  });

  it("shows top-level help with guidance to inspect subcommand help", () => {
    const helpText = createTestCli().helpInformation();

    expect(helpText).toContain("Use --help on any subcommand");
    expect(helpText).toContain("shotnote sync --help");
    expect(helpText).toContain("shotnote analyze --help");
  });

  it("shows analyze help with prompt-tuning guidance", () => {
    const analyzeCommand = createTestCli().commands.find((command) => command.name() === "analyze");
    const helpText = analyzeCommand?.helpInformation() ?? "";

    expect(helpText).toContain("Analyze screenshots already synced into ~/.shotnote/inbox");
    expect(helpText).toContain("2026-03-24-example.png");
    expect(helpText).toContain("--force");
  });
});
