import { describe, expect, it } from "vitest";

import { renderMarkdownNote } from "./markdown.js";

describe("renderMarkdownNote", () => {
  it("renders the normalized analysis into markdown", () => {
    const markdown = renderMarkdownNote({
      analysis: {
        type: "git-repo",
        title: "LangGraph",
        summary: "A repository page about building agentic workflows.",
        whyInteresting: "It looks relevant for future multi-agent tooling work.",
        entities: ["LangGraph", "GitHub"],
        tags: ["agents", "workflow"]
      },
      sourceImagePath: "/tmp/2026-03-24-langgraph.png",
      analyzedAt: "2026-03-24T12:30:00.000Z",
      model: "gpt-4.1-mini",
      raw: {
        foo: "bar"
      }
    });

    expect(markdown).toContain("# LangGraph");
    expect(markdown).toContain("## Type");
    expect(markdown).toContain("git-repo");
    expect(markdown).toContain("- LangGraph");
    expect(markdown).toContain("## Raw");
    expect(markdown).toContain("\"foo\": \"bar\"");
  });

  it("includes warnings when the analyzer had to degrade output", () => {
    const markdown = renderMarkdownNote({
      analysis: {
        type: "other",
        title: "IMG_001",
        summary: "Raw text fallback.",
        whyInteresting: "The model output could not be parsed.",
        entities: [],
        tags: []
      },
      sourceImagePath: "/tmp/IMG_001.png",
      analyzedAt: "2026-03-24T12:30:00.000Z",
      model: "gpt-4.1-mini",
      raw: {
        rawText: "not json"
      },
      warnings: ["parse_failed"]
    });

    expect(markdown).toContain("## Warnings");
    expect(markdown).toContain("- parse_failed");
  });
});
