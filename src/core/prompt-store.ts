import path from "node:path";

import fs from "fs-extra";

export const defaultAnalyzePrompt = `# Screenshot Analysis Prompt

Analyze this screenshot and return a JSON object with these fields:

- retrievalMode: one of "source-based" or "content-based"
- type: one of "tool", "website", "git-repo", "concept", "article", "other"
- title: concise human-readable title
- summary: 2 to 4 sentence description of what the screenshot is about
- whyInteresting: why this screenshot might be worth revisiting later
- sourceUrl: best visible URL if the screenshot clearly shows one, otherwise omit
- sourceTitle: visible page title, article title, product name, software name, or repo name if identifiable
- sourceClues: array of searchable clues such as domain names, product names, repo names, authors, or distinctive keywords
- extractedText: important text extracted from the screenshot when the screenshot is content-heavy or lacks a clear source
- entities: array of important entities, products, libraries, people, sites, or concepts
- tags: array of short tags

Rules:

- Return valid JSON only
- Do not wrap the JSON in markdown code fences
- Infer cautiously when the screenshot is partial or blurry
- If the screenshot has a clear source signal such as a URL, browser address bar, repo path, article title, or software name, set retrievalMode to "source-based"
- For source-based screenshots, prioritize sourceUrl, sourceTitle, and sourceClues so the user can find the original source later; keep summary concise
- For source-based screenshots, keep sourceClues minimal and high-signal: prefer 3 to 6 clues that are most useful for finding the source again, and avoid incidental UI text, unrelated sidebar items, timestamps, or noisy subtitles
- If a bare domain, GitHub org/repo path, arXiv id, or other canonical source identifier is visible, normalize it into a full sourceUrl when you can do so confidently
- If the exact URL is not visible, do not invent a deep link; use the best safe homepage or repository URL you can infer, otherwise omit sourceUrl and rely on sourceClues
- If the screenshot does not have a clear source and is mostly text or a self-contained content fragment, set retrievalMode to "content-based"
- For content-based screenshots, put more effort into extractedText so the note preserves the useful text and ideas
- If the screenshot has both a clear source and meaningful text, still prefer "source-based" but include a concise extractedText
- If the screenshot looks like code hosting or a repository page, prefer "git-repo"
- If the screenshot looks like a blog post or long-form reading material, prefer "article"
- If the screenshot is a landing page, docs page, or product page for a concrete software product, API, app, or service, prefer "tool" over "website"
- Use "website" only when the main thing worth recording is the site/page itself rather than a specific tool, repo, concept, or article
`;

export async function bootstrapPromptFile(promptPath: string) {
  if (await fs.pathExists(promptPath)) {
    return fs.readFile(promptPath, "utf8");
  }

  await fs.ensureDir(path.dirname(promptPath));
  await fs.writeFile(promptPath, defaultAnalyzePrompt);

  return defaultAnalyzePrompt;
}
