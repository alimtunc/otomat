import { describe, expect, it } from "vitest";

import type { InboxMark } from "#domain/contracts/inbox";
import { countUnreadConversations, projectConversations } from "#domain/projections/conversations";
import { conversationEvidence } from "#test-support/conversation-evidence";

const T0 = "2026-09-19T10:00:00.000Z";
const T1 = "2026-09-19T10:05:00.000Z";
const T2 = "2026-09-19T10:10:00.000Z";

const updatedAtOf = (overrides: Parameters<typeof conversationEvidence>[0]) =>
  projectConversations([conversationEvidence(overrides)], [])[0]?.updated_at;

const mark = (overrides: Partial<InboxMark> = {}): InboxMark => ({
  entry_id: "conversation:step-1",
  read: true,
  archived: false,
  evidence_updated_at: T1,
  ...overrides,
});

describe("projectConversations", () => {
  it("keys the entry by its step and reads the participant from the frozen configuration", () => {
    const [entry] = projectConversations([conversationEvidence({ reported_model: "opus-4" })], []);

    expect(entry).toMatchObject({
      id: "conversation:step-1",
      step_run_id: "step-1",
      participant: {
        runtime: "claude",
        profile_name: "Implementer",
        model: "opus-4",
        effort: "high",
      },
      last: null,
      read: false,
      archived: false,
    });
  });

  it("moves the thread on an agent answer but not on the operator's own message", () => {
    const answered = projectConversations(
      [conversationEvidence({ last_agent_message: { text: "Done.", at: T1 } })],
      [],
    );
    const asked = projectConversations(
      [conversationEvidence({ last_user_message: { text: "Please fix.", at: T2 } })],
      [],
    );

    expect(answered[0]?.updated_at).toBe(T1);
    expect(answered[0]?.last).toEqual({ kind: "agent", text: "Done.", at: T1 });
    expect(asked[0]?.updated_at).toBe(T0);
    expect(asked[0]?.last).toEqual({ kind: "user", text: "Please fix.", at: T2 });
  });

  it("moves on an actionable step state, a pending question and a failed delivery, never on running", () => {
    expect(updatedAtOf({ step_status: "running", step_updated_at: T2 })).toBe(T0);
    expect(updatedAtOf({ step_status: "succeeded", step_updated_at: T2 })).toBe(T2);
    expect(updatedAtOf({ step_status: "awaiting_permission", step_updated_at: T2 })).toBe(T2);
    expect(
      updatedAtOf({
        pending_interaction: { kind: "permission", prompt: "Run pnpm check?", requested_at: T1 },
      }),
    ).toBe(T1);
    expect(updatedAtOf({ failed_contribution_at: T2 })).toBe(T2);
  });

  it("surfaces the pending question as the last line even when an answer came later", () => {
    const [entry] = projectConversations(
      [
        conversationEvidence({
          last_agent_message: { text: "Checking.", at: T1 },
          pending_interaction: { kind: "permission", prompt: "Run pnpm check?", requested_at: T2 },
        }),
      ],
      [],
    );

    expect(entry?.last).toEqual({ kind: "interaction", text: "Run pnpm check?", at: T2 });
    expect(entry?.pending_interaction).toEqual({ kind: "permission", prompt: "Run pnpm check?" });
  });

  it("honours a mark until the thread moves past it", () => {
    const evidence = conversationEvidence({ last_agent_message: { text: "Done.", at: T1 } });

    const [current] = projectConversations([evidence], [mark({ archived: true })]);
    const [stale] = projectConversations(
      [{ ...evidence, last_agent_message: { text: "More.", at: T2 } }],
      [mark({ archived: true })],
    );

    expect(current).toMatchObject({ read: true, archived: true });
    expect(stale).toMatchObject({ read: false, archived: false });
  });

  it("never reads a cancelled step or an abandoned run as news", () => {
    const entries = projectConversations(
      [
        conversationEvidence({ step_run_id: "step-c", step_status: "canceled" }),
        conversationEvidence({ step_run_id: "step-a", run_abandoned_at: T1 }),
      ],
      [],
    );

    expect(entries.every((entry) => entry.read)).toBe(true);
    expect(countUnreadConversations(entries)).toBe(0);
  });

  it("orders by last activity, newest first, and counts each unread thread once", () => {
    const entries = projectConversations(
      [
        conversationEvidence({ step_run_id: "old", step_created_at: T0 }),
        conversationEvidence({
          step_run_id: "new",
          step_created_at: T0,
          last_agent_message: { text: "One.", at: T2 },
        }),
        conversationEvidence({ step_run_id: "read", step_created_at: T1 }),
      ],
      [mark({ entry_id: "conversation:read", evidence_updated_at: T1 })],
    );

    expect(entries.map((entry) => entry.step_run_id)).toEqual(["new", "read", "old"]);
    expect(countUnreadConversations(entries)).toBe(2);
  });
});
