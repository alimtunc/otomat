import type { AgentProfileContract, IssueContract } from "@otomat/domain";
import { useSkills } from "@web/api/skills/queries";
import { agentChoiceProfile } from "@web/lib/agent-choice";
import type { ContextDraft } from "@web/lib/context/draft";
import { contextSources, type ContextSource } from "@web/lib/context/sources";
import { issueShortId } from "@web/lib/ids";

export interface UseContextSourcesOptions {
  draft: ContextDraft;
  issue: IssueContract | null;
  agentChoice: string | null;
  profiles: AgentProfileContract[];
  dependencyNames?: readonly string[];
}

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
