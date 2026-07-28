// @vitest-environment happy-dom
import type { EventEnvelope, ResolvedModel, RunContract, RunPlan } from "@otomat/domain";
import { ModelSection } from "@web/components/issues/workspace/rail/model-section";
import { expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";
import { mount } from "#support/mount";

let streamEvents: EventEnvelope[] = [];

vi.mock("@web/api/runs/run-event-stream", () => ({
  useRunEventStream: () => ({ events: streamEvents }),
}));

const CONFIG = {
  runtime: "claude",
  profile_id: null,
  profile_name: null,
  options: {},
  guidance: null,
  skills: [],
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

function planWithModel(model: ResolvedModel | null) {
  return run({
    version: 1,
    steps: [
      {
        id: "s1",
        name: "Implement",
        agent: "claude",
        prompt: "go",
        depends_on: [],
        config: { ...CONFIG, model },
      },
    ],
  });
}

function usage(model: string | null): EventEnvelope {
  return envelope({
    type: "runtime.usage",
    payload: { usage: { model, input_tokens: 1, output_tokens: 2, cost_usd: null } },
  });
}

it("shows the requested model with its provenance next to what the runtime reported", async () => {
  streamEvents = [usage("claude-fable-5-20260501")];
  const mounted = await mount(
    <ModelSection run={planWithModel({ id: "opus", source: "static" })} />,
  );

  expect(mounted.container.textContent).toContain("opus");
  expect(mounted.container.textContent).toContain("claude-fable-5-20260501");

  await mounted.cleanup();
});

it("leaves the reported model empty rather than echoing the request back", async () => {
  streamEvents = [usage(null)];
  const mounted = await mount(
    <ModelSection run={planWithModel({ id: "gpt-5.6-sol", source: "discovered" })} />,
  );

  const rows = [...mounted.container.querySelectorAll("dd")].map((row) => row.textContent);
  expect(rows[0]).toContain("gpt-5.6-sol");
  expect(rows[1]).toBe("—");

  await mounted.cleanup();
});

it("reads a run launched on the provider default as Default", async () => {
  streamEvents = [];
  const mounted = await mount(<ModelSection run={planWithModel(null)} />);

  expect(mounted.container.textContent).toContain("Default");

  await mounted.cleanup();
});
