// @vitest-environment happy-dom
import type {
  EventEnvelope,
  ResolvedAgentConfig,
  ResolvedModel,
  RunContract,
  RunPlan,
} from "@otomat/domain";
import { ExecutionSection } from "@web/components/issues/workspace/rail/execution-section";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { envelope } from "#support/envelope";
import { mount } from "#support/mount";

let streamEvents: EventEnvelope[] = [];

vi.mock("@web/api/runs/run-event-stream", () => ({
  useRunEventStream: () => ({ events: streamEvents }),
}));

const CONFIG: ResolvedAgentConfig = {
  runtime: "claude",
  profile_id: null,
  profile_name: null,
  options: {},
  model: null,
  guidance: null,
  skills: [],
  sources: null,
  config_hash: "h",
};

function run(plan: RunPlan): RunContract {
  return {
    id: "run-1",
    issue_id: "issue-1",
    status: "running",
    branch: "otomat/run-1",
    plan_json: plan,
    updated_at: "2026-07-27T00:00:00.000Z",
  };
}

function planWith(config: ResolvedAgentConfig) {
  return run({
    version: 1,
    steps: [{ id: "s1", name: "Implement", agent: "claude", prompt: "go", depends_on: [], config }],
  });
}

function planWithModel(model: ResolvedModel | null) {
  return planWith({ ...CONFIG, model });
}

/** Every runtime event the daemon writes names the step run it came from; usage is no exception. */
function usage(model: string | null, stepRunId = "s1"): EventEnvelope {
  return envelope({
    type: "runtime.usage",
    step_run_id: stepRunId,
    payload: { usage: { model, input_tokens: 1, output_tokens: 2, cost_usd: null } },
  });
}

function twoStepPlan(): RunContract {
  return run({
    version: 1,
    steps: [
      {
        id: "s1",
        name: "Implement",
        agent: "claude",
        prompt: null,
        depends_on: [],
        config: { ...CONFIG, model: { id: "opus", source: "static" } },
      },
      {
        id: "s2",
        name: "Review",
        agent: "codex",
        prompt: null,
        depends_on: ["s1"],
        config: {
          ...CONFIG,
          runtime: "codex",
          config_hash: "h2",
          model: { id: "gpt-5.6-sol", source: "discovered" },
        },
      },
    ],
  });
}

function provenances(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[aria-label]")].map(
    (element) => element.getAttribute("aria-label") ?? "",
  );
}

function rowLabels(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("dt")].map((row) => row.textContent);
}

it("answers what the selected step uses, naming that step", async () => {
  streamEvents = [];
  const mounted = await mount(
    <ExecutionSection run={planWithModel({ id: "opus", source: "static" })} />,
  );

  const text = mounted.container.textContent ?? "";
  expect(text).toContain("Implement");
  expect(text).toContain("opus");

  await mounted.cleanup();
});

it("names the step the ledger is on rather than the first one in the plan", async () => {
  streamEvents = [envelope({ step_run_id: "s2", seq: 1 })];
  const mounted = await mount(<ExecutionSection run={twoStepPlan()} />);

  const text = mounted.container.textContent ?? "";
  expect(text).toContain("Review");
  expect(text).toContain("gpt-5.6-sol");

  await mounted.cleanup();
});

it("keeps every value auditable through its provenance, on hover and on focus", async () => {
  streamEvents = [];
  const mounted = await mount(
    <ExecutionSection
      run={planWith({
        ...CONFIG,
        profile_name: "Careful",
        model: { id: "opus", source: "static" },
        options: { permission_mode: "plan", effort: "high" },
        sources: {
          runtime: "launch",
          model: "profile",
          options: { permission_mode: "global", effort: "step" },
        },
      })}
    />,
  );

  const labels = provenances(mounted.container);
  expect(labels).toContain("Careful — chosen at launch");
  expect(labels).toContain("opus — from the agent profile");
  expect(labels).toContain("plan — from the global defaults");
  expect(labels).toContain("high — set on this step");
  // A provenance never lengthens the visible summary.
  expect(mounted.container.textContent).not.toContain("from the agent profile");

  await mounted.cleanup();
});

it("says nothing about provenance for a run frozen before it was recorded", async () => {
  streamEvents = [];
  const mounted = await mount(<ExecutionSection run={planWithModel(null)} />);

  expect(mounted.container.textContent).toContain("Default");
  expect(provenances(mounted.container)).not.toContain("Default — chosen at launch");

  await mounted.cleanup();
});

it("shows the reported model only when it diverges from what the step froze", async () => {
  streamEvents = [usage("opus")];
  const same = await mount(
    <ExecutionSection run={planWithModel({ id: "opus", source: "static" })} />,
  );
  expect(rowLabels(same.container)).not.toContain("Reported");
  await same.cleanup();

  streamEvents = [usage("claude-fable-5-20260501")];
  const diverged = await mount(
    <ExecutionSection run={planWithModel({ id: "opus", source: "static" })} />,
  );

  expect(rowLabels(diverged.container)).toContain("Reported");
  expect(diverged.container.textContent).toContain("claude-fable-5-20260501");

  await diverged.cleanup();
});

it("credits a reported model to the step that reported it, not to the step now running", async () => {
  streamEvents = [usage("opus"), envelope({ step_run_id: "s2", seq: 2 })];
  const mounted = await mount(<ExecutionSection run={twoStepPlan()} />);

  expect(mounted.container.textContent).toContain("Review");
  expect(rowLabels(mounted.container)).not.toContain("Reported");

  await mounted.cleanup();
});

it("keeps the frozen-value explanation and the audit trail behind Execution details", async () => {
  streamEvents = [];
  const mounted = await mount(<ExecutionSection run={planWithModel(null)} />);

  expect(mounted.container.textContent).not.toContain("a resume or a follow-up replays");

  const details = findButton("Execution details");
  if (details === undefined) throw new Error("the execution details disclosure is missing");
  await act(async () => details.click());

  expect(mounted.container.textContent).toContain("a resume or a follow-up replays");

  await mounted.cleanup();
});

it("breaks the audit trail down per step only when the run froze several configurations", async () => {
  streamEvents = [];
  const mounted = await mount(
    <ExecutionSection
      run={run({
        version: 1,
        steps: [
          {
            id: "g1",
            name: "Attempt",
            depends_on: [],
            compete: [
              { id: "c1", name: "Claude", agent: "claude", prompt: null, config: CONFIG },
              {
                id: "c2",
                name: "Codex",
                agent: "codex",
                prompt: null,
                config: { ...CONFIG, runtime: "codex", config_hash: "h2" },
              },
            ],
          },
        ],
      })}
    />,
  );

  const details = findButton("Execution details");
  if (details === undefined) throw new Error("the execution details disclosure is missing");
  await act(async () => details.click());

  const text = mounted.container.textContent ?? "";
  expect(text).toContain("Attempt · Claude");
  expect(text).toContain("Attempt · Codex");

  await mounted.cleanup();
});
