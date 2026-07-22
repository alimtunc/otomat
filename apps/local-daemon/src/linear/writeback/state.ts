import { getLinearDraft, listLinearWritesForIssue } from "@otomat/db";
import type { LinearWritebackState } from "@otomat/domain";

import { draftToContract, writeToContract } from "./contracts.js";
import type { LinearWriteLedger } from "./ledger.js";
import type { LinearWritebackConfig } from "./types.js";

export function writebackState(
  config: LinearWritebackConfig,
  ledger: LinearWriteLedger,
  issueId: string,
): LinearWritebackState {
  const draft = getLinearDraft(config.db, issueId);
  const writes = listLinearWritesForIssue(config.db, issueId).map((row) =>
    writeToContract(ledger.recover(row)),
  );
  return { draft: draft ? draftToContract(draft) : null, writes };
}
