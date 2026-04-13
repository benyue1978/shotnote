#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs-extra";
import OpenAI from "openai";
import { ProxyAgent } from "undici";
import { fileURLToPath } from "node:url";

import { createOpenAIAnalyzer } from "./adapters/analyzers/openai-analyzer.js";
import { createPhotosAppSource } from "./adapters/photo-source/photos-app-source.js";
import { runAnalyzeCommand } from "./commands/analyze.js";
import { runListAlbumsCommand } from "./commands/list-albums.js";
import { runRunCommand } from "./commands/run.js";
import { runSyncCommand } from "./commands/sync.js";
import { bootstrapConfigFile, resolveConfig } from "./core/config.js";
import { getAppPaths } from "./core/paths.js";
import { bootstrapPromptFile } from "./core/prompt-store.js";
import { createStateStore } from "./core/state-store.js";
import { createAnalyzeService } from "./services/analyze-service.js";
import { createSyncService } from "./services/sync-service.js";
import type { AnalyzeProgressEvent, AnalyzeRequest, AnalyzeSummary, SyncRequest, SyncSummary } from "./core/types.js";

type CliDependencies = {
  sourceLabel: string;
  syncService: {
    listAlbums(): Promise<string[]>;
    sync(request?: SyncRequest): Promise<SyncSummary>;
  };
  analyzeService: {
    analyze(request?: AnalyzeRequest, onProgress?: (event: AnalyzeProgressEvent) => void): Promise<AnalyzeSummary>;
  };
  writeLine?(line: string): void;
};

export function createCli(deps: CliDependencies) {
  const program = new Command();
  const writeLine = deps.writeLine ?? console.log;

  program
    .name("shotnote")
    .description(
      [
        "Sync screenshots from Photos.app and analyze them with OpenAI.",
        "",
        "Use --help on any subcommand before guessing behavior.",
        "Examples:",
        "  shotnote sync --help",
        "  shotnote analyze --help",
        "  shotnote run --help"
      ].join("\n")
    );

  program
    .command("list-albums")
    .description("List user-visible Photos.app albums")
    .summary("List user-created Photos.app albums")
    .action(async () => {
      await runListAlbumsCommand({
        listAlbums: deps.syncService.listAlbums,
        writeLine
      });
    });

  program
    .command("sync")
    .description(
      [
        "Sync screenshots from Photos.app into ~/.shotnote/inbox.",
        "",
        "Examples:",
        "  shotnote sync",
        "  shotnote sync --limit 5",
        "",
        "--limit only affects the first sync. Later syncs pull everything newer than the last successful sync."
      ].join("\n")
    )
    .summary("Sync screenshots from Photos.app")
    .option("--limit <n>", "Only export the most recent N screenshots", parseInt)
    .action(async (commandOptions: { limit?: number }) => {
      await runSyncCommand({
        sync: deps.syncService.sync,
        writeLine,
        sourceLabel: deps.sourceLabel
      }, {
        limit: commandOptions.limit
      });
    });

  program
    .command("analyze")
    .description(
      [
        "Analyze screenshots already synced into ~/.shotnote/inbox and write Markdown notes to ~/.shotnote/notes.",
        "",
        "Examples:",
        "  shotnote analyze",
        "  shotnote analyze --image 2026-03-24-example.png --force",
        "",
        "Use the second form when tuning ~/.shotnote/prompts/analyze-screenshot.md."
      ].join("\n")
    )
    .summary("Analyze screenshots already synced into ~/.shotnote/inbox")
    .option("--image <filename>", "Analyze or re-analyze a single image from ~/.shotnote/inbox by file name")
    .option("--force", "Re-analyze the selected image even if it was already processed")
    .action(async (commandOptions: { image?: string; force?: boolean }) => {
      if (commandOptions.force && !commandOptions.image) {
        throw new Error("--force requires --image");
      }

      await runAnalyzeCommand({
        analyze: deps.analyzeService.analyze,
        writeLine
      }, {
        imageName: commandOptions.image,
        force: commandOptions.force
      });
    });

  program
    .command("run")
    .description(
      [
        "Run sync followed by analyze.",
        "",
        "Examples:",
        "  shotnote run",
        "  shotnote run --limit 5"
      ].join("\n")
    )
    .summary("Run sync followed by analyze")
    .option("--limit <n>", "Only export the most recent N screenshots during sync", parseInt)
    .action(async (commandOptions: { limit?: number }) => {
      await runRunCommand({
        sourceLabel: deps.sourceLabel,
        sync: deps.syncService.sync,
        analyze: deps.analyzeService.analyze,
        writeLine
      }, {
        limit: commandOptions.limit
      });
    });

  return program;
}

export async function createRuntimeCli() {
  const initialPaths = getAppPaths();

  await fs.ensureDir(initialPaths.root);
  await fs.ensureDir(initialPaths.inbox);
  await fs.ensureDir(initialPaths.notes);
  await fs.ensureDir(initialPaths.export);
  await fs.ensureDir(initialPaths.prompts);
  await fs.ensureDir(initialPaths.bin);
  await fs.ensureDir(initialPaths.state);
  await fs.ensureDir(initialPaths.logs);
  await bootstrapConfigFile(initialPaths.config);

  const config = await resolveConfig();
  await bootstrapPromptFile(config.analysis.promptPath);

  const photoSource = createPhotosAppSource({
    albumName: config.source.albumName,
    inboxDir: config.paths.inbox,
    helperBinDir: config.paths.bin
  });
  const syncService = createSyncService({
    source: photoSource,
    syncedStateStore: createStateStore(config.paths.syncedState)
  });

  return createCli({
    sourceLabel: config.source.albumName,
    syncService,
    analyzeService: {
      async analyze(request?: AnalyzeRequest, onProgress?: (event: AnalyzeProgressEvent) => void) {
        if (!config.analysis.openAIApiKey) {
          throw new Error("Missing OPENAI_API_KEY. Set it in the environment before running analyze or run.");
        }

        const analyzeService = createAnalyzeService({
          analyzer: createOpenAIAnalyzer({
            model: config.analysis.model,
            client: createOpenAIClient(config.analysis.openAIApiKey)
          }),
          analyzedStateStore: createStateStore(config.paths.analyzedState),
          inboxDir: config.paths.inbox,
          notesDir: config.paths.notes,
          exportDir: config.paths.export,
          promptPath: config.analysis.promptPath
        });

        return analyzeService.analyze(request, onProgress);
      }
    }
  });
}

async function main() {
  const cli = await createRuntimeCli();
  await cli.parseAsync(process.argv);
}

function createOpenAIClient(apiKey?: string) {
  const proxyUrl =
    process.env.https_proxy ??
    process.env.HTTPS_PROXY ??
    process.env.http_proxy ??
    process.env.HTTP_PROXY ??
    process.env.all_proxy ??
    process.env.ALL_PROXY;

  return new OpenAI({
    apiKey,
    fetchOptions: proxyUrl
      ? {
          dispatcher: new ProxyAgent(proxyUrl)
        }
      : undefined
  });
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
