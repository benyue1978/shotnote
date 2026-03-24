import path from "node:path";

import fs from "fs-extra";

export const defaultAnalyzePrompt = `# Screenshot Analysis Prompt

Analyze this screenshot and return a JSON object with these fields:

- type: one of "tool", "website", "git-repo", "concept", "article", "other"
- title: concise human-readable title
- summary: 2 to 4 sentence description of what the screenshot is about
- whyInteresting: why this screenshot might be worth revisiting later
- entities: array of important entities, products, libraries, people, sites, or concepts
- tags: array of short tags

Rules:

- Return valid JSON only
- Do not wrap the JSON in markdown code fences
- Infer cautiously when the screenshot is partial or blurry
- If the screenshot looks like code hosting or a repository page, prefer "git-repo"
- If the screenshot looks like a blog post or long-form reading material, prefer "article"
`;

export async function bootstrapPromptFile(promptPath: string) {
  if (await fs.pathExists(promptPath)) {
    return fs.readFile(promptPath, "utf8");
  }

  await fs.ensureDir(path.dirname(promptPath));
  await fs.writeFile(promptPath, defaultAnalyzePrompt);

  return defaultAnalyzePrompt;
}
