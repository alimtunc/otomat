import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { useSkills } from "@web/api/skills/queries";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { resolveAgentChoice, resolveProfileChoice, type AgentScope } from "@web/lib/agent/choice";

export interface LaunchAgentChoice {
  descriptors: RuntimeDescriptor[];
  profiles: AgentProfileContract[];
  skills: SkillContract[];
  choice: string | null;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  onRetry: () => void;
}

export function useLaunchAgentChoice(
  preferred: string | null,
  scope: AgentScope = "all",
): LaunchAgentChoice {
  const runtimes = useRuntimes();
  const { projectId } = useSelectedProject();
  const profilesQuery = useAgentProfiles(projectId);
  const skillsQuery = useSkills();
  const descriptors = runtimes.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const skills = skillsQuery.data ?? [];

  return {
    descriptors,
    profiles,
    skills,
    choice:
      scope === "profiles"
        ? resolveProfileChoice(preferred, profiles, descriptors, skills)
        : resolveAgentChoice(preferred, profiles, descriptors, skills),
    isPending: runtimes.isPending || profilesQuery.isPending || skillsQuery.isPending,
    isError: runtimes.isError || profilesQuery.isError || skillsQuery.isError,
    isSuccess: runtimes.isSuccess,
    onRetry: () => {
      void runtimes.refetch();
      void profilesQuery.refetch();
      void skillsQuery.refetch();
    },
  };
}
