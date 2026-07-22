import type { PublishPrLinkRequest } from "@otomat/domain";

import { requireWritableIssue } from "../issue.js";
import type { LinearWriteLedger } from "../ledger.js";
import type { LinearWritebackConfig } from "../types.js";

export async function publishPrLink(
  config: LinearWritebackConfig,
  ledger: LinearWriteLedger,
  issueId: string,
  request: PublishPrLinkRequest,
): Promise<void> {
  const { linearId } = requireWritableIssue(config.db, issueId);
  const key = request.url;
  const existing = ledger.findByIdentity(issueId, "pr_link", key);
  if (existing?.status === "sent" || (existing && ledger.isActive(existing))) return;
  const write = ledger.ensurePending(existing, {
    issueId,
    runId: request.run_id ?? null,
    kind: "pr_link",
    key,
    payload: { url: request.url, title: request.title },
    detail: request.url,
  });
  await ledger.run(write, async (apiKey, signal) => {
    const attachmentId = await config.client.linkAttachment(
      apiKey,
      { issueId: linearId, url: request.url, title: request.title },
      signal,
    );
    return { remote_id: attachmentId, detail: request.url };
  });
}
