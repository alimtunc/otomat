import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function writeSkillFile(dir: string, body: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "SKILL.md");
  writeFileSync(path, body);
  return path;
}
