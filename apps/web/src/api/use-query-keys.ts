import { hostKeys, type HostQueryKeys } from "@web/api/query-keys";
import { useActiveHostId } from "@web/lib/active-host";
import { useMemo } from "react";

/** Keys for the active host, subscribed to it: a host switch re-keys every observer in place. */
export function useQueryKeys(): HostQueryKeys {
  const host = useActiveHostId();
  return useMemo(() => hostKeys(host), [host]);
}
