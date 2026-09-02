import { HostTag } from "@otomat/ui";
import { useActiveHostLabel } from "@web/lib/active-host";

export function ActiveHostTag() {
  const hostLabel = useActiveHostLabel();
  return <HostTag tag={hostLabel} />;
}
