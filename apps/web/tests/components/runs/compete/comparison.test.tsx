// @vitest-environment happy-dom
import type { RunDetail } from "@otomat/domain";
import { CompeteComparison } from "@web/components/runs/compete/comparison";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";

const selectWinner = vi.fn();

vi.mock("@web/api/runs/mutations", () => ({
  useSelectCompeteWinner: () => ({ mutate: selectWinner, isPending: false }),
}));

vi.mock("@web/api/runs/queries", () => ({
  useCompeteCandidateDiff: (_runId: string, _groupId: string, stepId: string) => ({
    isPending: false,
    isError: false,
    data: {
      run_id: "run-1",
      computed_at: "2026-07-19T00:00:00.000Z",
      diff: {
        base: "base",
        additions: stepId === "direct" ? 4 : 7,
        deletions: 1,
        sha: `sha-${stepId}`,
        files: [
          {
            path: `${stepId}.ts`,
            old_path: null,
            status: "added",
            additions: 1,
            deletions: 0,
            binary: false,
            patch: `+${stepId}`,
            sha: `file-${stepId}`,
          },
        ],
      },
    },
  }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const detail: RunDetail = {
  run: {
    id: "run-1",
    issue_id: "issue-1",
    status: "awaiting_selection",
    branch: "otomat/run/run-1",
    plan_json: {
      version: 1,
      steps: [
        {
          id: "group-1",
          name: "Choose approach",
          depends_on: [],
          compete: [
            { id: "direct", name: "Direct", agent: "codex", prompt: "direct" },
            { id: "layered", name: "Layered", agent: "claude", prompt: "layered" },
          ],
        },
      ],
    },
  },
  steps: [
    {
      id: "direct",
      run_id: "run-1",
      idx: 0,
      name: "Direct",
      status: "succeeded",
      compete_group_id: "group-1",
      worktree_id: "wt-direct",
      branch: "candidate/direct",
      worktree_status: "active",
    },
    {
      id: "layered",
      run_id: "run-1",
      idx: 1,
      name: "Layered",
      status: "succeeded",
      compete_group_id: "group-1",
      worktree_id: "wt-layered",
      branch: "candidate/layered",
      worktree_status: "active",
    },
  ],
  sessions: [
    {
      id: "session-direct",
      step_run_id: "direct",
      agent_id: "codex",
      status: "terminated",
      provider_session_id: "provider-direct",
    },
    {
      id: "session-layered",
      step_run_id: "layered",
      agent_id: "claude",
      status: "terminated",
      provider_session_id: "provider-layered",
    },
  ],
  compete_groups: [
    {
      id: "group-1",
      run_id: "run-1",
      idx: 0,
      name: "Choose approach",
      status: "awaiting_selection",
      winner_step_run_id: null,
      base_head_sha: "base",
    },
  ],
  worktree_path: "/canonical",
};

it("compares honest candidate evidence and requires an explicit confirm", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <CompeteComparison
        detail={detail}
        group={detail.compete_groups[0]!}
        events={[
          envelope({
            id: "event-direct",
            step_run_id: "direct",
            agent_session_id: "session-direct",
            payload: { text: "implemented direct path" },
          }),
        ]}
      />,
    );
  });

  expect(container.textContent).toContain("Otomat does not score candidates");
  expect(container.textContent).toContain("implemented direct path");
  expect(container.textContent).toContain("+direct");
  expect(selectWinner).not.toHaveBeenCalled();

  const mark = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Mark as winner",
  );
  if (!mark) throw new Error("mark winner button not found");
  await act(async () => mark.click());
  expect(container.textContent).toContain("Direct will become the canonical result.");
  expect(selectWinner).not.toHaveBeenCalled();

  const confirm = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Select Direct as winner",
  );
  if (!confirm) throw new Error("confirm winner button not found");
  await act(async () => confirm.click());
  expect(selectWinner).toHaveBeenCalledWith("direct");

  await act(async () => root.unmount());
  container.remove();
});
