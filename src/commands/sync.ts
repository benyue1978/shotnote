import type { SyncRequest } from "../core/types.js";

export async function runSyncCommand(deps: {
  sync(request?: SyncRequest): Promise<{ newCount: number; duplicateCount: number }>;
  writeLine(line: string): void;
}, request?: SyncRequest) {
  const result = await deps.sync(request);

  deps.writeLine(`synced ${result.newCount} new image(s), skipped ${result.duplicateCount} duplicate(s)`);
}
