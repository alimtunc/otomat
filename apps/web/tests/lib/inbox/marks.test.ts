import { markInboxRequest } from "@web/lib/inbox/marks";
import { describe, expect, it } from "vitest";

import { inboxEntry } from "#support/inbox";

describe("markInboxRequest", () => {
  it("carries the flag the patch leaves alone from the entry on screen", () => {
    const archived = inboxEntry({ archived: true });

    expect(markInboxRequest([archived], { read: true })).toEqual({
      marks: [
        {
          entry_id: archived.id,
          evidence_updated_at: archived.updated_at,
          read: true,
          archived: true,
        },
      ],
    });
  });

  it("archives a read entry without unreading it", () => {
    const read = inboxEntry({ read: true });

    expect(markInboxRequest([read], { archived: true }).marks[0]).toMatchObject({
      read: true,
      archived: true,
    });
  });
});
