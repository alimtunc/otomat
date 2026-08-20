import { defineMachine } from "./machine.js";

// `local` holds a mark no pull request carries — before one exists, and again once it is gone.
export const REVIEWED_FILE_SYNC_STATES = ["local", "pending", "synced", "failed"] as const;

export type ReviewedFileSyncState = (typeof REVIEWED_FILE_SYNC_STATES)[number];

export const reviewedFileSyncMachine = defineMachine<ReviewedFileSyncState>({
  name: "reviewed_file_sync",
  initial: "local",
  transitions: {
    local: ["pending", "synced"],
    pending: ["synced", "failed", "local"],
    synced: ["local", "pending"],
    failed: ["local", "pending"],
  },
});
