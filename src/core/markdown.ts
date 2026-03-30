import type { MarkdownNoteInput } from "./types.js";

function renderList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "-";
}

export function renderMarkdownNote(input: MarkdownNoteInput) {
  const sourceUrlSection = input.analysis.sourceUrl
    ? `\n## Source URL\n${input.analysis.sourceUrl}\n`
    : "";
  const sourceTitleSection = input.analysis.sourceTitle
    ? `\n## Source Title\n${input.analysis.sourceTitle}\n`
    : "";
  const sourceCluesSection =
    input.analysis.sourceClues.length > 0
      ? `\n## Source Clues\n${renderList(input.analysis.sourceClues)}\n`
      : "";
  const extractedTextSection = input.analysis.extractedText
    ? `\n## Extracted Text\n${input.analysis.extractedText}\n`
    : "";
  const warningsSection =
    input.warnings && input.warnings.length > 0
      ? `\n## Warnings\n${renderList(input.warnings)}\n`
      : "";

  return `# ${input.analysis.title}

## Retrieval Mode
${input.analysis.retrievalMode}

## Type
${input.analysis.type}

## Summary
${input.analysis.summary}

## Why Interesting
${input.analysis.whyInteresting}
${sourceUrlSection}${sourceTitleSection}${sourceCluesSection}${extractedTextSection}

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
