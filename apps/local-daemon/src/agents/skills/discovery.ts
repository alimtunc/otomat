import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { SkillDiscovery } from "@otomat/db";

import { tryRealpath } from "#git";

import { readSkillContent } from "./content.js";
import { parseFrontmatter } from "./frontmatter.js";
import type { SkillRoot } from "./roots.js";

const SKILL_FILENAME = "SKILL.md";

function describeSkill(root: SkillRoot, dirName: string, canonicalPath: string): SkillDiscovery {
  const provenance = { project_id: root.project_id, canonical_path: canonicalPath };
  const content = readSkillContent(canonicalPath);
  if (content === null) {
    return {
      ...provenance,
      name: dirName,
      description: null,
      content_hash: null,
      status: "invalid",
      invalid_reason: "unreadable",
    };
  }
  const frontmatter = parseFrontmatter(content.content);
  if (frontmatter === null) {
    return {
      ...provenance,
      name: dirName,
      description: null,
      content_hash: content.hash,
      status: "invalid",
      invalid_reason: "frontmatter_missing",
    };
  }
  const name = frontmatter.name?.trim();
  if (!name) {
    return {
      ...provenance,
      name: dirName,
      description: frontmatter.description,
      content_hash: content.hash,
      status: "invalid",
      invalid_reason: "name_missing",
    };
  }
  return {
    ...provenance,
    name,
    description: frontmatter.description,
    content_hash: content.hash,
    status: "available",
    invalid_reason: null,
  };
}

function discoverInRoot(root: SkillRoot): SkillDiscovery[] {
  const canonicalRoot = tryRealpath(root.dir);
  if (canonicalRoot === null) return [];
  let names: string[];
  try {
    names = readdirSync(canonicalRoot);
  } catch {
    return [];
  }
  const found: SkillDiscovery[] = [];
  for (const name of names) {
    const canonicalPath = tryRealpath(join(canonicalRoot, name, SKILL_FILENAME));
    if (canonicalPath === null) continue;
    found.push(describeSkill(root, name, canonicalPath));
  }
  return found;
}

/** Discovers every skill under the given roots, canonically de-duplicated by realpath (the first root that reaches a path wins). */
export function discoverSkills(roots: readonly SkillRoot[]): SkillDiscovery[] {
  const byPath = new Map<string, SkillDiscovery>();
  for (const root of roots) {
    for (const skill of discoverInRoot(root)) {
      if (!byPath.has(skill.canonical_path)) byPath.set(skill.canonical_path, skill);
    }
  }
  return [...byPath.values()];
}
