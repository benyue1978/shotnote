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
import { resolveConfig } from "./core/config.js";
import { bootstrapPromptFile } from "./core/prompt-store.js";
import { createStateStore } from "./core/state-store.js";
import { createAnalyzeService } from "./services/analyze-service.js";
import { createSyncService } from "./services/sync-service.js";

type CliDependencies = {
  syncService: {
    listAlbums(): Promise<string[]>;
    sync(): Promise<{ newCount: number; duplicateCount: number }>;
  };
  analyzeService: {
    analyze(): Promise<{ analyzedCount: number; skippedCount: number }>;
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
    .action(async () => {
      await runAnalyzeCommand({
        analyze: deps.analyzeService.analyze,
        writeLine
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
  const config = await resolveConfig();

  await fs.ensureDir(config.paths.root);
  await fs.ensureDir(config.paths.inbox);
  await fs.ensureDir(config.paths.notes);
  await fs.ensureDir(config.paths.prompts);
  await fs.ensureDir(config.paths.state);
  await fs.ensureDir(config.paths.logs);

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
      async analyze() {
        if (!config.analysis.openAIApiKey) {
          throw new Error("Missing OPENAI_API_KEY. Set it in the environment before running analyze or run.");
        }

        await bootstrapPromptFile(config.analysis.promptPath);

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

        return analyzeService.analyze();
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
