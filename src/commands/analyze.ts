import type { AnalyzeRequest } from "../core/types.js";

export async function runAnalyzeCommand(deps: {
  analyze(request?: AnalyzeRequest): Promise<{ analyzedCount: number; skippedCount: number }>;
  writeLine(line: string): void;
}, request?: AnalyzeRequest) {
  const result = await deps.analyze(request);

  deps.writeLine(`analyzed ${result.analyzedCount} image(s), skipped ${result.skippedCount} existing image(s)`);
}
