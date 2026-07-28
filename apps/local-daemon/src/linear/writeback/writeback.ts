import type {
  PublishCommentRequest,
  PublishFieldsRequest,
  PublishPrLinkRequest,
  PublishStatusRequest,
  SaveLinearDraftRequest,
} from "@otomat/domain";

import { linearError } from "../errors.js";
import { discardDraft, saveDraft } from "./drafts.js";
import { LinearWriteLedger } from "./ledger.js";
import { parseCommentPayload, parsePrLinkPayload, parseStatusPayload } from "./payloads.js";
import { publishComment } from "./publishers/comment.js";
import { publishFields } from "./publishers/fields.js";
import { publishPrLink } from "./publishers/pr-link.js";
import { publishStatus } from "./publishers/status.js";
import { comments, editorState } from "./readers.js";
import { writebackState } from "./state.js";
import type { LinearWriteback, LinearWritebackConfig } from "./types.js";

class DefaultLinearWriteback implements LinearWriteback {
  private readonly ledger: LinearWriteLedger;

  constructor(private readonly config: LinearWritebackConfig) {
    this.ledger = new LinearWriteLedger(config);
  }

  writebackState(issueId: string) {
    return writebackState(this.config, this.ledger, issueId);
  }

  editorState(issueId: string) {
    return editorState(this.config, issueId);
  }

  comments(issueId: string) {
    return comments(this.config, issueId);
  }

  saveDraft(issueId: string, request: SaveLinearDraftRequest) {
    return saveDraft(this.config, issueId, request);
  }

  discardDraft(issueId: string): void {
    discardDraft(this.config, issueId);
  }

  async publishStatus(issueId: string, request: PublishStatusRequest) {
    await publishStatus(this.config, this.ledger, issueId, request);
    return this.writebackState(issueId);
  }

  async publishComment(issueId: string, request: PublishCommentRequest) {
    await publishComment(this.config, this.ledger, issueId, request);
    return this.writebackState(issueId);
  }

  async publishPrLink(issueId: string, request: PublishPrLinkRequest) {
    await publishPrLink(this.config, this.ledger, issueId, request);
    return this.writebackState(issueId);
  }

  async publishFields(issueId: string, request: PublishFieldsRequest) {
    await publishFields(this.config, this.ledger, issueId, request);
    return this.writebackState(issueId);
  }

  async retryWrite(writeId: string) {
    const write = this.ledger.find(writeId);
    if (!write) throw linearError("linear_write_not_found");
    if (write.status === "sent") return this.writebackState(write.issue_id);
    const runId = write.run_id;
    switch (write.kind) {
      case "status":
        return this.publishStatus(write.issue_id, {
          state_id: parseStatusPayload(write.payload_json).state_id,
          run_id: runId,
        });
      case "comment": {
        const payload = parseCommentPayload(write.payload_json);
        return this.publishComment(write.issue_id, {
          client_id: write.idempotency_key,
          body: payload.body,
          parent_id: payload.parent_id,
          run_id: runId,
        });
      }
      case "pr_link": {
        const payload = parsePrLinkPayload(write.payload_json);
        return this.publishPrLink(write.issue_id, {
          url: payload.url,
          title: payload.title,
          run_id: runId,
        });
      }
      case "fields":
        return this.publishFields(write.issue_id, { overwrite: false });
    }
  }
}

export function createLinearWriteback(config: LinearWritebackConfig): LinearWriteback {
  return new DefaultLinearWriteback(config);
}
