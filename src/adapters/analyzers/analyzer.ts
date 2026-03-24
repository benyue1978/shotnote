import type { AnalyzeInput, AnalyzeResult } from "../../core/types.js";

export interface ScreenshotAnalyzer {
  analyze(input: AnalyzeInput): Promise<AnalyzeResult>;
}
