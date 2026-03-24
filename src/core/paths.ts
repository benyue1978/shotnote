import os from "node:os";
import path from "node:path";

import type { AppPaths } from "./types.js";

export function expandHomeDir(inputPath: string, homeDir = os.homedir()) {
  if (inputPath === "~") {
    return homeDir;
  }

  if (inputPath.startsWith("~/")) {
    return path.join(homeDir, inputPath.slice(2));
  }

  return inputPath;
}

export function getAppPaths(homeDir = os.homedir()): AppPaths {
  const root = path.join(homeDir, ".shotnote");
  const prompts = path.join(root, "prompts");

  return {
    root,
    inbox: path.join(root, "inbox"),
    notes: path.join(root, "notes"),
    prompts,
    bin: path.join(root, "bin"),
    prompt: path.join(prompts, "analyze-screenshot.md"),
    state: path.join(root, "state"),
    syncedState: path.join(root, "state", "synced.json"),
    analyzedState: path.join(root, "state", "analyzed.json"),
    logs: path.join(root, "logs"),
    config: path.join(root, "config.json")
  };
}
