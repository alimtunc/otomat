import {
  countUnreadInboxEntriesByProject,
  type ConversationThreadEntry,
  type ExecutionHostId,
} from "@otomat/domain";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import type { HostInboxEntries } from "@web/components/shell/project-tabs/use-open-host-inboxes";

export function conversationsByProject(
  entries: ConversationThreadEntry[],
  host: ExecutionHostId,
): Map<string, ConversationThreadEntry[]> {
  const byProject = new Map<string, ConversationThreadEntry[]>();
  for (const entry of entries) {
    const key = projectSwitcherKey(host, entry.project.id);
    const list = byProject.get(key);
    if (list === undefined) byProject.set(key, [entry]);
    else list.push(entry);
  }
  return byProject;
}

export function attentionByProject(inboxes: HostInboxEntries[]): Map<string, number> {
  return new Map(
    inboxes.flatMap((inbox) =>
      [...countUnreadInboxEntriesByProject(inbox.entries)].map(
        ([id, count]) => [projectSwitcherKey(inbox.host, id), count] as const,
      ),
    ),
  );
}
