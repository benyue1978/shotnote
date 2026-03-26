import type { SyncRequest, SyncSummary } from "../core/types.js";
import { SyncExecutionError } from "../services/sync-service.js";

export async function runSyncCommand(deps: {
  sync(request?: SyncRequest): Promise<SyncSummary>;
  writeLine(line: string): void;
  sourceLabel: string;
}, request?: SyncRequest) {
  deps.writeLine(`sync source: ${deps.sourceLabel}`);

  try {
    const result = await deps.sync(request);

    deps.writeLine(formatSyncMode(result));
    deps.writeLine(
      `sync discovered: ${result.discoveredCount} candidate image(s), source skipped ${result.sourceSkippedCount} duplicate file(s)`
    );
    deps.writeLine(`synced ${result.newCount} new image(s), skipped ${result.duplicateCount} duplicate(s)`);
  } catch (error) {
    if (error instanceof SyncExecutionError) {
      deps.writeLine(formatSyncMode(error));

      if (error.message.includes("Photo library access was denied")) {
        deps.writeLine("hint: Photos permission may depend on which host app is running shotnote.");
      }
    }

    throw error;
  }
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
