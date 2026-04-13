import type { SyncRequest, SyncSummary } from "../core/types.js";
import { SyncExecutionError } from "../services/sync-service.js";

export async function runRunCommand(deps: {
  sourceLabel: string;
  sync(request?: SyncRequest): Promise<SyncSummary>;
  analyze(): Promise<{ analyzedCount: number; skippedCount: number }>;
  writeLine(line: string): void;
}, syncRequest?: SyncRequest) {
  deps.writeLine(`sync source: ${deps.sourceLabel}`);

  let syncResult;

  try {
    syncResult = await deps.sync(syncRequest);
  } catch (error) {
    if (error instanceof SyncExecutionError) {
      deps.writeLine(formatSyncMode(error));

      if (error.message.includes("Photo library access was denied")) {
        deps.writeLine("hint: Photos permission may depend on which host app is running shotnote.");
      }
    }

    throw error;
  }

  deps.writeLine(formatSyncMode(syncResult));
  deps.writeLine(
    `sync discovered: ${syncResult.discoveredCount} candidate image(s), source skipped ${syncResult.sourceSkippedCount} duplicate file(s)`
  );
  deps.writeLine(`synced ${syncResult.newCount} new image(s), skipped ${syncResult.duplicateCount} duplicate(s)`);

  const analyzeResult = await deps.analyze();
  deps.writeLine(
    `analyzed ${analyzeResult.analyzedCount} image(s), skipped ${analyzeResult.skippedCount} existing image(s)`
  );
}

function formatSyncMode(result: Pick<SyncSummary, "syncMode" | "effectiveRequest">) {
  if (result.syncMode === "incremental") {
    return `sync mode: incremental after ${result.effectiveRequest?.since}`;
  }

  if (result.effectiveRequest?.limit) {
    return `sync mode: first sync bootstrap (limit ${result.effectiveRequest.limit})`;
  }

  return "sync mode: full initial sync";
}
