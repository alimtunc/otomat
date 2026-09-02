import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useSkills() {
  const keys = useQueryKeys();
  return useQuery({ queryKey: keys.skills, queryFn: () => daemon.listSkills() });
}
