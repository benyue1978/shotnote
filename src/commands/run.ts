import type { SyncRequest } from "../core/types.js";

export async function runRunCommand(deps: {
  sync(request?: SyncRequest): Promise<{ newCount: number; duplicateCount: number }>;
  analyze(): Promise<{ analyzedCount: number; skippedCount: number }>;
  writeLine(line: string): void;
}, syncRequest?: SyncRequest) {
  const syncResult = await deps.sync(syncRequest);
  deps.writeLine(`synced ${syncResult.newCount} new image(s), skipped ${syncResult.duplicateCount} duplicate(s)`);

  const analyzeResult = await deps.analyze();
  deps.writeLine(
    `analyzed ${analyzeResult.analyzedCount} image(s), skipped ${analyzeResult.skippedCount} existing image(s)`
  );
}
