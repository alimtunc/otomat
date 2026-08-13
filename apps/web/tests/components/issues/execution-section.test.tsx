// @vitest-environment happy-dom
import type {
  EventEnvelope,
  ResolvedAgentConfig,
  ResolvedModel,
  RunContract,
  RunPlan,
} from "@otomat/domain";
import { ExecutionSection } from "@web/components/issues/workspace/rail/execution-section";
import { expect, it, vi } from "vitest";

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

function usage(model: string | null): EventEnvelope {
  return envelope({
    type: "runtime.usage",
    payload: { usage: { model, input_tokens: 1, output_tokens: 2, cost_usd: null } },
  });
}

it("shows the frozen model next to what the runtime reported", async () => {
  streamEvents = [usage("claude-fable-5-20260501")];
  const mounted = await mount(
    <ExecutionSection run={planWithModel({ id: "opus", source: "static" })} />,
  );

  expect(mounted.container.textContent).toContain("opus");
  expect(mounted.container.textContent).toContain("claude-fable-5-20260501");

  await mounted.cleanup();
});

it("leaves the reported model empty rather than echoing the request back", async () => {
  streamEvents = [usage(null)];
  const mounted = await mount(
    <ExecutionSection run={planWithModel({ id: "gpt-5.6-sol", source: "discovered" })} />,
  );

  const rows = [...mounted.container.querySelectorAll("dd")].map((row) => row.textContent);
  expect(rows.at(-1)).toBe("—");

  await mounted.cleanup();
});

it("names every frozen option with the level that chose it, and says a resume replays exactly this", async () => {
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

  const text = mounted.container.textContent ?? "";
  expect(text).toContain("Careful");
  expect(text).toContain("from the agent profile");
  expect(text).toContain("from the global defaults");
  expect(text).toContain("set on this step");
  expect(text).toContain("a resume or a follow-up replays");

  await mounted.cleanup();
});

it("says nothing about provenance for a run frozen before it was recorded", async () => {
  streamEvents = [];
  const mounted = await mount(<ExecutionSection run={planWithModel(null)} />);

  expect(mounted.container.textContent).toContain("Default");
  expect(mounted.container.textContent).not.toContain("chosen at launch");

  await mounted.cleanup();
});
