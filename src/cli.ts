#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs-extra";
import OpenAI from "openai";
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
import type { AnalyzeRequest } from "./core/types.js";

type CliDependencies = {
  syncService: {
    listAlbums(): Promise<string[]>;
    sync(): Promise<{ newCount: number; duplicateCount: number }>;
  };
  analyzeService: {
    analyze(request?: AnalyzeRequest): Promise<{ analyzedCount: number; skippedCount: number }>;
  };
  writeLine?(line: string): void;
};

export function createCli(deps: CliDependencies) {
  const program = new Command();
  const writeLine = deps.writeLine ?? console.log;

  program.name("shotnote").description("Sync screenshots from Photos.app and analyze them with OpenAI.");

  program
    .command("list-albums")
    .description("List user-visible Photos.app albums")
    .action(async () => {
      await runListAlbumsCommand({
        listAlbums: deps.syncService.listAlbums,
        writeLine
      });
    });

  program
    .command("sync")
    .description("Sync screenshots from Photos.app into ~/.shotnote/inbox")
    .action(async () => {
      await runSyncCommand({
        sync: deps.syncService.sync,
        writeLine
      });
    });

  program
    .command("analyze")
    .description("Analyze unprocessed screenshots and write Markdown notes")
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
    .description("Run sync followed by analyze")
    .action(async () => {
      await runRunCommand({
        sync: deps.syncService.sync,
        analyze: deps.analyzeService.analyze,
        writeLine
      });
    });

  return program;
}

export async function createRuntimeCli() {
  const initialPaths = getAppPaths();

  await fs.ensureDir(initialPaths.root);
  await fs.ensureDir(initialPaths.inbox);
  await fs.ensureDir(initialPaths.notes);
  await fs.ensureDir(initialPaths.prompts);
  await fs.ensureDir(initialPaths.state);
  await fs.ensureDir(initialPaths.logs);
  await bootstrapConfigFile(initialPaths.config);

  const config = await resolveConfig();
  await bootstrapPromptFile(config.analysis.promptPath);

  const photoSource = createPhotosAppSource({
    albumName: config.source.albumName,
    inboxDir: config.paths.inbox
  });
  const syncService = createSyncService({
    source: photoSource,
    syncedStateStore: createStateStore(config.paths.syncedState)
  });

  return createCli({
    syncService,
    analyzeService: {
      async analyze(request?: AnalyzeRequest) {
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
          promptPath: config.analysis.promptPath
        });

        return analyzeService.analyze(request);
      }
    }
  });
}

async function main() {
  const cli = await createRuntimeCli();
  await cli.parseAsync(process.argv);
}

function createOpenAIClient(apiKey?: string) {
  return new OpenAI({ apiKey });
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
