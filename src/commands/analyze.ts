export async function runAnalyzeCommand(deps: {
  analyze(): Promise<{ analyzedCount: number; skippedCount: number }>;
  writeLine(line: string): void;
}) {
  const result = await deps.analyze();

  deps.writeLine(`analyzed ${result.analyzedCount} image(s), skipped ${result.skippedCount} existing image(s)`);
}
