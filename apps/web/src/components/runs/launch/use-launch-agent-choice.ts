import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { resolveAgentChoice, resolveProfileChoice, type AgentScope } from "@web/lib/agent-choice";

export interface LaunchAgentChoice {
  descriptors: RuntimeDescriptor[];
  profiles: AgentProfileContract[];
  /** The effective choice: the preferred one while usable, else the shared runtime fallback, else null. */
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
  const profilesQuery = useAgentProfiles();
  const descriptors = runtimes.data ?? [];
  const profiles = profilesQuery.data ?? [];

  return {
    descriptors,
    profiles,
    choice:
      scope === "profiles"
        ? resolveProfileChoice(preferred, profiles, descriptors)
        : resolveAgentChoice(preferred, profiles, descriptors),
    isPending: runtimes.isPending || profilesQuery.isPending,
    isError: runtimes.isError || profilesQuery.isError,
    isSuccess: runtimes.isSuccess,
    onRetry: () => {
      void runtimes.refetch();
      void profilesQuery.refetch();
    },
  };
}
