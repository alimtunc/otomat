import { HostTag } from "@otomat/ui";
import { remoteHostAlias } from "@web/lib/desktop-bridge";

export function ActiveHostTag() {
  return <HostTag tag={remoteHostAlias() ?? "local"} />;
}
