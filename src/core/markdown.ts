import type { MarkdownNoteInput } from "./types.js";

function renderList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "-";
}

export function renderMarkdownNote(input: MarkdownNoteInput) {
  const warningsSection =
    input.warnings && input.warnings.length > 0
      ? `\n## Warnings\n${renderList(input.warnings)}\n`
      : "";

  return `# ${input.analysis.title}

## Type
${input.analysis.type}

## Summary
${input.analysis.summary}

## Why Interesting
${input.analysis.whyInteresting}

## Entities
${renderList(input.analysis.entities)}

## Tags
${input.analysis.tags.join(", ")}

## Source
${input.sourceImagePath}

## Metadata
- analyzed_at: ${input.analyzedAt}
- model: ${input.model}
${warningsSection}
## Raw
\`\`\`json
${JSON.stringify(input.raw, null, 2)}
\`\`\`
`;
}
