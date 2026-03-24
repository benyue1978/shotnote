import path from "node:path";

import fs from "fs-extra";
import OpenAI from "openai";
import { z } from "zod";

import type { ScreenshotAnalyzer } from "./analyzer.js";

const analysisSchema = z.object({
  type: z.enum(["tool", "website", "git-repo", "concept", "article", "other"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  whyInteresting: z.string().min(1),
  entities: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

type OpenAIClientLike = {
  responses: {
    create: (request: Record<string, unknown>) => Promise<{ output_text?: string }>;
  };
};

type OpenAIAnalyzerOptions = {
  model: string;
  client?: OpenAIClientLike;
};

export function createOpenAIAnalyzer(options: OpenAIAnalyzerOptions): ScreenshotAnalyzer {
  const client = options.client ?? new OpenAI();

  return {
    async analyze(input) {
      const imageBuffer = await fs.readFile(input.imagePath);
      const mimeType = inferMimeType(input.imagePath);
      const imageUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
      const response = await client.responses.create({
        model: options.model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: input.prompt
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "auto"
              }
            ]
          }
        ]
      });
      const outputText = response.output_text ?? "";

      try {
        const parsed = analysisSchema.parse(JSON.parse(outputText));

        return {
          analysis: parsed,
          raw: JSON.parse(outputText),
          warnings: [],
          model: options.model
        };
      } catch {
        const fallbackTitle = path.parse(input.imagePath).name.replace(/^\.+/, "") || "untitled";

        return {
          analysis: {
            type: "other",
            title: fallbackTitle,
            summary: outputText || "The model did not return valid structured JSON.",
            whyInteresting: "Review the raw model output manually.",
            entities: [],
            tags: []
          },
          raw: {
            rawText: outputText
          },
          warnings: ["parse_failed"],
          model: options.model
        };
      }
    }
  };
}

function inferMimeType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    default:
      return "image/png";
  }
}
