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
          envelope({
            id: "usage-direct",
            step_run_id: "direct",
            agent_session_id: "session-direct",
            type: "runtime.usage",
            source: "codex",
            seq: 1,
            payload: {
              usage: {
                model: "gpt-5",
                input_tokens: 1200,
                output_tokens: 340,
                cost_usd: 0.042,
              },
            },
          }),
          ...Array.from({ length: 5 }, (_, index) =>
            envelope({
              id: `later-direct-${index}`,
              step_run_id: "direct",
              agent_session_id: "session-direct",
              seq: index + 2,
              payload: { text: `later evidence ${index}` },
            }),
          ),
          envelope({
            id: "test-call-direct",
            step_run_id: "direct",
            agent_session_id: "session-direct",
            type: "runtime.tool_call",
            source: "codex",
            seq: 7,
            payload: {
              phase: "call",
              tool: "command_execution",
              tool_use_id: "test-command-1",
              args: { command: "/bin/zsh -lc 'pnpm test:e2e'" },
            },
          }),
          envelope({
            id: "test-result-direct",
            step_run_id: "direct",
            agent_session_id: "session-direct",
            type: "runtime.tool_call",
            source: "codex",
            seq: 8,
            payload: {
              phase: "result",
              tool: "command_execution",
              tool_use_id: "test-command-1",
              is_error: false,
              result: { exit_code: 0, output: "96 tests passed" },
            },
          }),
          envelope({
            id: "non-test-call-direct",
            step_run_id: "direct",
            agent_session_id: "session-direct",
            type: "runtime.tool_call",
            source: "codex",
            seq: 9,
            payload: {
              phase: "call",
              tool: "command_execution",
              tool_use_id: "non-test-command",
              args: { command: "echo test" },
            },
          }),
          ...["echo vitest", "rg pytest", "npm install vitest"].map((command, index) =>
            envelope({
              id: `runner-mention-${index}`,
              step_run_id: "direct",
              agent_session_id: "session-direct",
              type: "runtime.tool_call",
              source: "codex",
              seq: 10 + index,
              payload: {
                phase: "call",
                tool: "command_execution",
                tool_use_id: `runner-mention-${index}`,
                args: { command },
              },
            }),
          ),
          envelope({
            id: "usage-layered",
            step_run_id: "layered",
            agent_session_id: "session-layered",
            type: "runtime.usage",
            source: "codex",
            seq: 13,
            payload: {
              usage: {
                model: null,
                input_tokens: 90,
                output_tokens: 12,
                cost_usd: null,
              },
            },
          }),
        ]}
      />,
    );
  });

  expect(container.textContent).toContain("Otomat does not score candidates");
  expect(container.textContent).toContain("implemented direct path");
  expect(container.textContent).toContain("in 1.2k · out 340 · $0.042 · gpt-5");
  expect(container.textContent).toContain("Test passed");
  expect(container.textContent).toContain("Test evidence · 1");
  expect(container.textContent).not.toContain("Test evidence · 2");
  expect(container.textContent).toContain("/bin/zsh -lc 'pnpm test:e2e'");
  expect(container.textContent).toContain("exit 0");
  expect(container.textContent).toContain("96 tests passed");
  expect(container.textContent).toContain("No cost reported.");
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
