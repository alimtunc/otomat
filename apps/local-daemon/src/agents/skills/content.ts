import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export interface SkillContent {
  content: string;
  hash: string;
}

/** Reads a skill file's contents and hash, or null when it cannot be read. */
export function readSkillContent(canonicalPath: string): SkillContent | null {
  try {
    const content = readFileSync(canonicalPath, "utf8");
    return { content, hash: hashContent(content) };
  } catch {
    return null;
  }
}
