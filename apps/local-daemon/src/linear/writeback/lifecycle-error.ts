import { findLatestFailedLifecycleWrite, type Db, type IssueSourceRow } from "@otomat/db";
import type { LinearLifecycleWriteError } from "@otomat/domain";

import { listSourceIssues } from "../lifecycle.js";
import { parseLifecyclePayload } from "./payloads.js";

export function sourceLifecycleError(
  db: Db,
  source: IssueSourceRow,
): LinearLifecycleWriteError | null {
  const write = findLatestFailedLifecycleWrite(
    db,
    listSourceIssues(db, source).map((issue) => issue.id),
  );
  if (write === undefined) return null;
  return {
    issue_id: write.issue_id,
    write_id: write.id,
    phase: parseLifecyclePayload(write.payload_json).phase,
    message: write.error_message ?? "Linear rejected the status write.",
  };
}
