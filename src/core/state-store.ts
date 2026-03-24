import path from "node:path";

import fs from "fs-extra";

import type { HashState } from "./types.js";

const emptyState = (): HashState => ({ byHash: {} });

export function createStateStore(filePath: string) {
  return {
    async read() {
      if (!(await fs.pathExists(filePath))) {
        return emptyState();
      }

      return fs.readJson(filePath) as Promise<HashState>;
    },
    async write(state: HashState) {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJson(filePath, state, { spaces: 2 });
    }
  };
}
