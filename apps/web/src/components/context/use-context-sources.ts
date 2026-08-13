import type { AgentProfileContract, IssueContract } from "@otomat/domain";
import { useSkills } from "@web/api/skills/queries";
import { agentChoiceProfile } from "@web/lib/agent-choice";
import type { ContextDraft } from "@web/lib/context/draft";
import { contextSources, type ContextSource } from "@web/lib/context/sources";
import { issueShortId } from "@web/lib/ids";

export interface UseContextSourcesOptions {
  draft: ContextDraft;
  /** The issue Otomat attaches on its own; null for a run that has none. */
  issue: IssueContract | null;
  /** Encoded agent choice for this node, so the preview names the guidance that will actually apply. */
  agentChoice: string | null;
  profiles: AgentProfileContract[];
  /** Names of the plan nodes this one waits on; their evidence rides along. */
  dependencyNames?: readonly string[];
}

/** Resolves the launch preview's provenance list: the attached context, the chosen profile's guidance and skills, and the note. */
export function useContextSources(options: UseContextSourcesOptions): ContextSource[] {
  const skills = useSkills();
  const profile = agentChoiceProfile(options.agentChoice, options.profiles);
  const byId = new Map((skills.data ?? []).map((skill) => [skill.id, skill.name]));
  return contextSources({
    draft: options.draft,
    issueLabel: options.issue === null ? null : issueShortId(options.issue),
    profileName: profile?.name ?? null,
    skillNames: (profile?.skill_ids ?? []).map((id) => byId.get(id) ?? id),
    dependencyNames: options.dependencyNames ?? [],
  });
}
