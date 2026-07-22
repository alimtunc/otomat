import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Rescans the known skill roots and refreshes the catalog. */
export function useScanSkills() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.scanSkills(),
    onSuccess: (skills) => {
      client.setQueryData(queryKeys.skills, skills);
      toast.success(`Rescanned skills — ${skills.length} found`);
    },
    onError: () => toast.error("Could not rescan skills — is the daemon running?"),
  });
}

/** Toggles whether a discovered skill may be activated by a profile. */
export function useSetSkillEnabled() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      daemon.setSkillEnabled(id, { enabled }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.skills }),
    onError: () => toast.error("Could not update the skill — is the daemon running?"),
  });
}
