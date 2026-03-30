import path from "node:path";

import fs from "fs-extra";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenAIAnalyzer } from "./openai-analyzer.js";

const tempFiles: string[] = [];

afterEach(async () => {
  await Promise.all(tempFiles.splice(0).map((file) => fs.remove(file)));
});

describe("createOpenAIAnalyzer", () => {
  it("passes the prompt and image as a Responses API request and parses valid JSON output", async () => {
    const imagePath = path.join(process.cwd(), ".shotnote-test-image.png");
    tempFiles.push(imagePath);
    await fs.writeFile(imagePath, "fake-image");

    const responsesCreate = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        retrievalMode: "source-based",
        type: "website",
        title: "Figma",
        summary: "A product page screenshot.",
        whyInteresting: "Worth checking later.",
        sourceUrl: "https://www.figma.com",
        sourceTitle: "Figma",
        sourceClues: ["figma.com", "design tool"],
        extractedText: "Browser tab and product page hero content.",
        entities: ["Figma"],
        tags: ["design"]
      })
    });

    const analyzer = createOpenAIAnalyzer({
      model: "gpt-4.1-mini",
      client: {
        responses: {
          create: responsesCreate
        }
      }
    });

    const result = await analyzer.analyze({
      imagePath,
      prompt: "# Prompt"
    });

    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(result.analysis.title).toBe("Figma");
    expect(result.analysis.retrievalMode).toBe("source-based");
    expect(result.analysis.sourceUrl).toBe("https://www.figma.com");
    expect(result.analysis.sourceClues).toContain("figma.com");
    expect(result.warnings).toEqual([]);
  });

  it("falls back to a degraded result when the model output is not valid JSON", async () => {
    const imagePath = path.join(process.cwd(), ".shotnote-test-image-2.png");
    tempFiles.push(imagePath);
    await fs.writeFile(imagePath, "fake-image");

    const analyzer = createOpenAIAnalyzer({
      model: "gpt-4.1-mini",
      client: {
        responses: {
          create: vi.fn().mockResolvedValue({
            output_text: "not-json"
          })
        }
      }
    });

    const result = await analyzer.analyze({
      imagePath,
      prompt: "# Prompt"
    });

    expect(result.analysis.type).toBe("other");
    expect(result.analysis.title).toBe("shotnote-test-image-2");
    expect(result.analysis.retrievalMode).toBe("content-based");
    expect(result.warnings).toContain("parse_failed");
  });
});
