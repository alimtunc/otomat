import type { ExecutionHostId, InboxEntry } from "@otomat/domain";
import { useSelector } from "@tanstack/react-store";
import { useHostInboxes } from "@web/api/inbox/queries";
import { openTabHosts } from "@web/components/shell/project-tabs/state";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { useActiveHostId } from "@web/lib/active-host";

export interface HostInboxEntries {
  host: ExecutionHostId;
  entries: InboxEntry[];
}

export function useOpenHostInboxes(): HostInboxEntries[] {
  const hosts = openTabHosts(useSelector(projectTabsStore), useActiveHostId());
  const inboxes = useHostInboxes(hosts);
  return hosts.map((host, index) => ({ host, entries: inboxes[index]?.data?.entries ?? [] }));
}
