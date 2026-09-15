import { expect, it } from "vitest";

import type { InboxEntry } from "#domain/contracts/inbox";
import {
  projectCompletedNotifications,
  projectInboxNotifications,
} from "#domain/projections/notification";
import { activityEvidence } from "#test-support/activity-evidence";

function entry(overrides: Partial<InboxEntry> = {}): InboxEntry {
  return {
    id: "run:run-1",
    kind: "run_review_ready",
    state: "open",
    project: { id: "project-1", name: "Otomat" },
    subject: { title: "Ship it", identifier: "OTO-1" },
    target: { kind: "run", run_id: "run-1" },
    detail: null,
    updated_at: "2026-09-15T10:00:00.000Z",
    read: false,
    archived: false,
    ...overrides,
  };
}

function project(overrides: Partial<InboxEntry> = {}) {
  return projectInboxNotifications({
    entry: entry(overrides),
    revision: "rev",
    requests: [],
    selections: [],
  });
}

it("names the issue, the state reached and the step or action for each durable event", () => {
  expect(project()[0]).toMatchObject({
    title: "OTO-1 · Ready to review",
    body: "Ship it\nReview the diff",
  });
  expect(project({ kind: "run_failed", detail: "Check" })[0]).toMatchObject({
    title: "OTO-1 · Run failed",
    body: "Ship it · Check\nResume or abandon the run",
  });
  expect(project({ kind: "run_awaiting_answer", detail: "Implement" })[0]).toMatchObject({
    category: "question",
    title: "OTO-1 · Run is waiting for you",
    body: "Ship it · Implement\nAnswer the run",
  });
  expect(
    project({
      kind: "pull_request_review_requested",
      target: { kind: "pull_request", pull_request_id: "pr-1" },
    })[0],
  ).toMatchObject({ title: "OTO-1 · Review requested", body: "Ship it\nReview the pull request" });
});

it("tells a question from a permission per pending request", () => {
  const [permission, question] = projectInboxNotifications({
    entry: entry({ kind: "permission_request", detail: "Implement" }),
    revision: "rev",
    requests: [
      { id: "req-1", kind: "permission", step_run_id: "step-1" },
      { id: "req-2", kind: "questionnaire", step_run_id: "step-1" },
    ],
    selections: [],
  });
  expect(permission).toMatchObject({
    category: "permission",
    interaction_id: "req-1",
    title: "OTO-1 · Permission requested",
    body: "Ship it · Implement\nGrant or refuse the permission",
  });
  expect(question).toMatchObject({
    category: "question",
    interaction_id: "req-2",
    title: "OTO-1 · Question asked",
    body: "Ship it · Implement\nAnswer the question",
  });
});

it("keeps a publication's git output out of the body", () => {
  expect(
    project({
      kind: "publication_stopped",
      target: { kind: "run_pull_request", run_id: "run-1" },
      detail: "fatal: unable to access 'https://github.com/acme/repo.git/'",
    })[0].body,
  ).toBe("Ship it\nRetry the publication");
});

it("falls back to what is left of the subject", () => {
  expect(project({ subject: { title: "Add the inbox", identifier: null } })[0]).toMatchObject({
    title: "Ready to review",
    body: "Add the inbox\nReview the diff",
  });
  expect(project({ subject: { title: "  ", identifier: "OTO-1" } })[0].body).toBe(
    "OTO-1\nReview the diff",
  );
  expect(project({ subject: { title: "", identifier: null } })[0]).toMatchObject({
    title: "Ready to review",
    body: "Untitled issue\nReview the diff",
  });
});

it("announces a completed run as a result, never as a demand", () => {
  const row = activityEvidence({ run_status: "completed" });
  expect(projectCompletedNotifications([row, { ...row, run_status: "failed" }])).toEqual([
    {
      id: "completed:run-1",
      category: "completed",
      project_id: "project-1",
      target: { kind: "run", run_id: "run-1" },
      step_run_id: null,
      interaction_id: null,
      title: "OTO-1 · Run completed",
      body: "Ship it\nCompletion report ready, nothing to do",
    },
  ]);
});
