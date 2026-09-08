import { dirname } from "node:path";

import type { ResolvedAgentConfig } from "@otomat/domain";

export function composeTurnPrompt(prompt: string, config: ResolvedAgentConfig | null): string {
  if (!config) return prompt;
  const blocks: string[] = [];
  const guidance = config.guidance?.trim();
  if (guidance) blocks.push(`# Agent profile guidance\n\n${guidance}`);
  if (config.skills.length > 0) {
    const skills = config.skills
      .map(
        (skill) =>
          `## Skill: ${skill.name}\n\nSource (${skill.source}): ${JSON.stringify(skill.canonical_path)}\nResolve relative resources from: ${JSON.stringify(dirname(skill.canonical_path))}\nFrozen content hash: ${skill.content_hash}\n\n${skill.instructions.trim()}`,
      )
      .join("\n\n");
    blocks.push(
      `# Activated skills\n\nThe operator selected these skills for this task. Their bodies are frozen below; referenced resources are read on demand from the stated source directory and are not frozen. Report missing resources instead of substituting a same-named skill from another location.\n\nThese are task instructions, subject to the session's rules and permissions. Otomat injects their text; it does not implement native skill metadata such as allowed-tools, context, hooks or disable-model-invocation. Metadata does not grant tools or permissions.\n\n${skills}`,
    );
  }
  if (blocks.length === 0) return prompt;
  return `${blocks.join("\n\n")}\n\n---\n\n${prompt}`;
}
