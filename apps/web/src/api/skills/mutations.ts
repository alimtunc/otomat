import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useScanSkills() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.scanSkills(),
    onSuccess: (skills) => {
      client.setQueryData(keys.skills, skills);
      toast.success(`Rescanned skills — ${skills.length} found`);
    },
    onError: () => toast.error("Could not rescan skills — is the daemon running?"),
  });
}

export function useSetSkillEnabled() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      daemon.setSkillEnabled(id, { enabled }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.skills }),
    onError: () => toast.error("Could not update the skill — is the daemon running?"),
  });
}
