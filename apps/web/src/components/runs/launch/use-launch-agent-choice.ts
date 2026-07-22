import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { resolveAgentChoice } from "@web/lib/agent-choice";

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

/** Owns the runtimes + profiles queries every launch surface needs and merges their states for LaunchAgentPicker. */
export function useLaunchAgentChoice(preferred: string | null): LaunchAgentChoice {
  const runtimes = useRuntimes();
  const profilesQuery = useAgentProfiles();
  const descriptors = runtimes.data ?? [];
  const profiles = profilesQuery.data ?? [];

  return {
    descriptors,
    profiles,
    choice: resolveAgentChoice(preferred, profiles, descriptors),
    isPending: runtimes.isPending || profilesQuery.isPending,
    isError: runtimes.isError || profilesQuery.isError,
    isSuccess: runtimes.isSuccess,
    onRetry: () => {
      void runtimes.refetch();
      void profilesQuery.refetch();
    },
  };
}
