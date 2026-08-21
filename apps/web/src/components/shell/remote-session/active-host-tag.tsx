import { HostTag } from "@otomat/ui";
import { remoteHostAlias } from "@web/lib/desktop-bridge";

/** The daemon answers for its own machine, so anything it holds carries that host's tag. */
export function ActiveHostTag() {
  return <HostTag tag={remoteHostAlias() ?? "local"} />;
}
