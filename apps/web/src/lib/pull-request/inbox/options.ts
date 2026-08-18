import type { PullRequestInboxEntry, PullRequestState } from "@otomat/domain";
import { resolveStatus } from "@otomat/ui";

export interface InboxFilterOption<T extends string> {
  value: T;
  label: string;
}

/** Every axis whose values come from the loaded entries rather than from a fixed list. */
export interface InboxFilterOptions {
  repositories: InboxFilterOption<string>[];
  authors: InboxFilterOption<string>[];
  states: InboxFilterOption<PullRequestState>[];
}

function sorted<T extends string>(values: Map<T, InboxFilterOption<T>>): InboxFilterOption<T>[] {
  return [...values.values()].toSorted((a, b) => a.label.localeCompare(b.label));
}

export function inboxFilterOptions(entries: readonly PullRequestInboxEntry[]): InboxFilterOptions {
  const repositories = new Map<string, InboxFilterOption<string>>();
  const authors = new Map<string, InboxFilterOption<string>>();
  const states = new Map<PullRequestState, InboxFilterOption<PullRequestState>>();
  for (const entry of entries) {
    repositories.set(entry.repository, { value: entry.repository, label: entry.repository });
    if (entry.author_login !== null) {
      authors.set(entry.author_login, {
        value: entry.author_login,
        label: `@${entry.author_login}`,
      });
    }
    states.set(entry.status, {
      value: entry.status,
      label: resolveStatus("pr", entry.status).label,
    });
  }
  return { repositories: sorted(repositories), authors: sorted(authors), states: sorted(states) };
}
