import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** The local skills catalog with filesystem provenance and enablement. */
export function useSkills() {
  return useQuery({ queryKey: queryKeys.skills, queryFn: () => daemon.listSkills() });
}
