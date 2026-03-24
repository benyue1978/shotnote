import { createHash } from "node:crypto";

import fs from "fs-extra";

export async function sha256File(filePath: string) {
  const buffer = await fs.readFile(filePath);

  return createHash("sha256").update(buffer).digest("hex");
}
