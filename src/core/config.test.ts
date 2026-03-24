import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";

import { bootstrapPromptFile, defaultAnalyzePrompt } from "./prompt-store.js";
import { bootstrapConfigFile, defaultConfigFile, resolveConfig } from "./config.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempHome() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shotnote-config-test-"));
  tempRoots.push(dir);
  return dir;
}

describe("resolveConfig", () => {
  it("uses the default shotnote root under the user home directory", async () => {
    const homeDir = await createTempHome();

    const config = await resolveConfig({ homeDir });

    expect(config.paths.root).toBe(path.join(homeDir, ".shotnote"));
    expect(config.paths.inbox).toBe(path.join(homeDir, ".shotnote", "inbox"));
    expect(config.paths.notes).toBe(path.join(homeDir, ".shotnote", "notes"));
    expect(config.paths.prompt).toBe(path.join(homeDir, ".shotnote", "prompts", "analyze-screenshot.md"));
  });

  it("applies config values from the file system", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".shotnote", "config.json");

    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      source: { albumName: "截屏" },
      analysis: { model: "gpt-4.1", promptPath: "~/custom-prompt.md", apiKey: "config-key" }
    });

    const config = await resolveConfig({ homeDir });

    expect(config.source.albumName).toBe("截屏");
    expect(config.analysis.model).toBe("gpt-4.1");
    expect(config.analysis.promptPath).toBe(path.join(homeDir, "custom-prompt.md"));
    expect(config.analysis.openAIApiKey).toBe("config-key");
  });

  it("prefers environment variables over config file values", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".shotnote", "config.json");

    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      analysis: { model: "gpt-4.1" }
    });

    const config = await resolveConfig({
      homeDir,
      env: {
        OPENAI_API_KEY: "env-key",
        SHOTNOTE_MODEL: "gpt-4.1-mini"
      }
    });

    expect(config.analysis.model).toBe("gpt-4.1-mini");
    expect(config.analysis.openAIApiKey).toBe("env-key");
  });
});

describe("bootstrapConfigFile", () => {
  it("creates the default config when config.json does not exist", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".shotnote", "config.json");

    const content = await bootstrapConfigFile(configPath);
    const savedContent = await fs.readFile(configPath, "utf8");

    expect(content).toBe(defaultConfigFile);
    expect(savedContent).toBe(defaultConfigFile);
  });

  it("preserves an existing config file", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".shotnote", "config.json");
    const customConfig = JSON.stringify({ analysis: { model: "gpt-4.1" } }, null, 2);

    await fs.ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, customConfig);

    const content = await bootstrapConfigFile(configPath);

    expect(content).toBe(customConfig);
  });
});

describe("bootstrapPromptFile", () => {
  it("creates the default prompt when the prompt file does not exist", async () => {
    const homeDir = await createTempHome();
    const config = await resolveConfig({ homeDir });

    const prompt = await bootstrapPromptFile(config.paths.prompt);
    const savedPrompt = await fs.readFile(config.paths.prompt, "utf8");

    expect(prompt).toBe(defaultAnalyzePrompt);
    expect(savedPrompt).toBe(defaultAnalyzePrompt);
  });

  it("preserves an existing prompt file", async () => {
    const homeDir = await createTempHome();
    const config = await resolveConfig({ homeDir });
    const customPrompt = "# Custom prompt\n\nOnly return website.";

    await fs.ensureDir(path.dirname(config.paths.prompt));
    await fs.writeFile(config.paths.prompt, customPrompt);

    const prompt = await bootstrapPromptFile(config.paths.prompt);

    expect(prompt).toBe(customPrompt);
  });
});
