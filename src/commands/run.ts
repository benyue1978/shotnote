export async function runRunCommand(deps: {
  sync(): Promise<{ newCount: number; duplicateCount: number }>;
  analyze(): Promise<{ analyzedCount: number; skippedCount: number }>;
  writeLine(line: string): void;
}) {
  const syncResult = await deps.sync();
  deps.writeLine(`synced ${syncResult.newCount} new image(s), skipped ${syncResult.duplicateCount} duplicate(s)`);

  const analyzeResult = await deps.analyze();
  deps.writeLine(
    `analyzed ${analyzeResult.analyzedCount} image(s), skipped ${analyzeResult.skippedCount} existing image(s)`
  );
}
