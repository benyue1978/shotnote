import type { AnalyzeProgressEvent, AnalyzeRequest, AnalyzeSummary } from "../core/types.js";

export async function runAnalyzeCommand(deps: {
  analyze(request?: AnalyzeRequest, onProgress?: (event: AnalyzeProgressEvent) => void): Promise<AnalyzeSummary>;
  writeLine(line: string): void;
}, request?: AnalyzeRequest) {
  const result = await deps.analyze(request, (event) => {
    if (event.kind === "start") {
      deps.writeLine(`analyze scan: ${event.total} image(s) in inbox`);
      deps.writeLine(`analyze plan: ${event.pending} to process, ${event.skipped} already analyzed`);
      return;
    }

    if (event.state === "skipped") {
      return;
    }

    deps.writeLine(`analyze ${event.index}/${event.total} ${event.state}: ${event.imageName}`);
  });

  deps.writeLine(`analyzed ${result.analyzedCount} image(s), skipped ${result.skippedCount} existing image(s)`);
}
