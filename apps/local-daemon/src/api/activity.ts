import { listActivityEvidence, type Db } from "@otomat/db";
import { projectActivities, type ActivitySnapshot } from "@otomat/domain";

/** How far back the header still carries settled work; it is a live view of what is happening, not a history. */
const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;
const RECENT_LIMIT = 8;

export function readActivity(db: Db): ActivitySnapshot {
  const observed = new Date();
  const since = new Date(observed.getTime() - RECENT_WINDOW_MS).toISOString();
  return {
    activities: projectActivities(listActivityEvidence(db, since), {
      since,
      limit: RECENT_LIMIT,
    }),
    observed_at: observed.toISOString(),
  };
}
