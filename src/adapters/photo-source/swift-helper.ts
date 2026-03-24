import path from "node:path";

import { execa } from "execa";
import fs from "fs-extra";

type EnsureSwiftHelperOptions = {
  sourceScriptPath: string;
  helperBinDir: string;
};

export async function ensureSwiftHelper(options: EnsureSwiftHelperOptions) {
  const binaryPath = path.join(options.helperBinDir, "shotnote-photos-helper");

  await fs.ensureDir(options.helperBinDir);

  const binaryExists = await fs.pathExists(binaryPath);
  const shouldCompile =
    !binaryExists ||
    (await fs.stat(options.sourceScriptPath)).mtimeMs > (await fs.stat(binaryPath)).mtimeMs;

  if (shouldCompile) {
    await execa("xcrun", ["swiftc", options.sourceScriptPath, "-o", binaryPath]);
  }

  return binaryPath;
}

export async function runSwiftHelperBinary(binaryPath: string, args: string[]) {
  const result = await execa(binaryPath, args);
  return result.stdout;
}
