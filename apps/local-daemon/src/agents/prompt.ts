import type { ResolvedAgentConfig } from "@otomat/domain";

/**
 * Composes the effective prompt for a fresh run turn by prepending the frozen
 * system guidance and the activated skills' declarative instructions to the step
 * prompt. Resume turns keep the raw prompt because the provider session already
 * carries this context. Skill instructions are surfaced as text and never
 * executed by Otomat.
 */
export function composeTurnPrompt(prompt: string, config: ResolvedAgentConfig | null): string {
  if (!config) return prompt;
  const blocks: string[] = [];
  const guidance = config.guidance?.trim();
  if (guidance) blocks.push(`# System guidance\n\n${guidance}`);
  if (config.skills.length > 0) {
    const skills = config.skills
      .map((skill) => `## Skill: ${skill.name}\n\n${skill.instructions.trim()}`)
      .join("\n\n");
    blocks.push(
      `# Activated skills\n\nThe following skills are active for this task. Apply them when relevant.\n\n${skills}`,
    );
  }
  if (blocks.length === 0) return prompt;
  return `${blocks.join("\n\n")}\n\n---\n\n${prompt}`;
}
