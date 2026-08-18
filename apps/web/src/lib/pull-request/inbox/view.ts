import { PULL_REQUEST_INBOX_GROUPS, type PullRequestInboxGroup } from "@otomat/domain";
import { asRecord, normalizedMembers } from "@web/lib/coerce";
import { parseInboxFilters, type InboxFilters } from "@web/lib/pull-request/inbox/filters";
import { readScoped, writeScoped, type ScopedStorage } from "@web/lib/storage";

const INBOX_VIEW_KEY = "otomat.reviews-inbox";

export interface InboxViewConfig {
  filters: InboxFilters;
  collapsedGroups: PullRequestInboxGroup[];
}

export function parseInboxViewConfig(value: unknown): InboxViewConfig {
  const entry = asRecord(value);
  return {
    filters: parseInboxFilters(entry?.filters),
    collapsedGroups: normalizedMembers(entry?.collapsedGroups, PULL_REQUEST_INBOX_GROUPS),
  };
}

export function readInboxView(projectId: string, storage?: ScopedStorage | null): InboxViewConfig {
  return readScoped(INBOX_VIEW_KEY, projectId, parseInboxViewConfig, storage);
}

export function writeInboxView(
  projectId: string,
  config: InboxViewConfig,
  storage?: ScopedStorage | null,
): void {
  writeScoped(INBOX_VIEW_KEY, projectId, config, storage);
}
