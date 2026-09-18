import { lstatSync, readFileSync } from "node:fs";

import type { RuntimeImageFile } from "./contract.js";

/** The daemon named and wrote this file itself, so anything but a plain regular file at that path is tampering, not an image. */
export function readRuntimeImage(file: RuntimeImageFile): Buffer {
  const stat = lstatSync(file.path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("a message image must be a regular file");
  }
  return readFileSync(file.path);
}
