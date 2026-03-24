export async function runSyncCommand(deps: {
  sync(): Promise<{ newCount: number; duplicateCount: number }>;
  writeLine(line: string): void;
}) {
  const result = await deps.sync();

  deps.writeLine(`synced ${result.newCount} new image(s), skipped ${result.duplicateCount} duplicate(s)`);
}
