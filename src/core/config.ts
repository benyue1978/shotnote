import path from "node:path";

import fs from "fs-extra";

import { expandHomeDir, getAppPaths } from "./paths.js";
import type { ResolveConfigOptions, ShotnoteConfig } from "./types.js";

type ConfigFileShape = Partial<{
  source: Partial<ShotnoteConfig["source"]>;
  analysis: Partial<Omit<ShotnoteConfig["analysis"], "openAIApiKey">> & Partial<{ apiKey: string }>;
}>;

export const defaultConfigFile = `${JSON.stringify(
  {
    source: {
      type: "photos-album",
      albumName: "Screenshots"
    },
    analysis: {
      provider: "openai",
      model: "gpt-4.1-mini",
      promptPath: "~/.shotnote/prompts/analyze-screenshot.md",
      apiKey: ""
    }
  },
  null,
  2
)}
`;

export async function resolveConfig(options: ResolveConfigOptions = {}): Promise<ShotnoteConfig> {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir;
  const paths = getAppPaths(homeDir);
  const fileConfig = await readConfigFile(paths.config);

  const sourceAlbumName =
    options.flags?.albumName ??
    env.SHOTNOTE_ALBUM_NAME ??
    fileConfig.source?.albumName ??
    "Screenshots";

  const promptPath = expandHomeDir(
    options.flags?.promptPath ??
      env.SHOTNOTE_PROMPT_PATH ??
      fileConfig.analysis?.promptPath ??
      paths.prompt,
    homeDir
  );

  const model =
    options.flags?.model ??
    env.SHOTNOTE_MODEL ??
    fileConfig.analysis?.model ??
    "gpt-4.1-mini";

  return {
    paths: {
      ...paths,
      prompt: promptPath
    },
    source: {
      type: "photos-album",
      albumName: sourceAlbumName
    },
    analysis: {
      provider: "openai",
      model,
      promptPath,
      openAIApiKey: env.OPENAI_API_KEY ?? fileConfig.analysis?.apiKey
    }
  };
}

async function readConfigFile(configPath: string): Promise<ConfigFileShape> {
  if (!(await fs.pathExists(configPath))) {
    return {};
  }

  return fs.readJson(configPath) as Promise<ConfigFileShape>;
}

export async function bootstrapConfigFile(configPath: string) {
  if (await fs.pathExists(configPath)) {
    return fs.readFile(configPath, "utf8");
  }

  await fs.ensureDir(path.dirname(configPath));
  await fs.writeFile(configPath, defaultConfigFile);

  return defaultConfigFile;
}
