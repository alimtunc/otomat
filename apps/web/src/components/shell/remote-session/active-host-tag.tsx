import { HostTag } from "@otomat/ui";
import { useRemoteHostAlias } from "@web/lib/active-host";

export function ActiveHostTag() {
  const alias = useRemoteHostAlias();
  return <HostTag tag={alias ?? "local"} />;
}
