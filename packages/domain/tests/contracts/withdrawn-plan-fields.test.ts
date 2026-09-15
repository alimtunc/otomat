import { runPlanSchema, workflowPresetPlanSchema } from "@otomat/domain";
import { describe, expect, it } from "vitest";

const WITHDRAWN = { delivery: "implementation" };

describe("plans saved with a delivery expectation", () => {
  it("still open as a frozen run plan, without the field", () => {
    const plan = runPlanSchema.parse({
      version: 1,
      steps: [
        { id: "build", name: "Build", agent: null, prompt: null, depends_on: [], ...WITHDRAWN },
        {
          id: "pick",
          name: "Pick",
          depends_on: ["build"],
          compete: [
            { id: "a", name: "A", agent: null, prompt: null, ...WITHDRAWN },
            { id: "b", name: "B", agent: null, prompt: null, ...WITHDRAWN },
          ],
        },
      ],
    });
    expect(JSON.stringify(plan)).not.toContain("delivery");
  });

  it("still load as a preset, without the field", () => {
    const plan = workflowPresetPlanSchema.parse({
      version: 1,
      steps: [
        { id: "build", name: "Build", agent: null, depends_on: [], ...WITHDRAWN },
        {
          id: "pick",
          name: "Pick",
          depends_on: ["build"],
          compete: [
            { id: "a", name: "A", agent: null, ...WITHDRAWN },
            { id: "b", name: "B", agent: null, ...WITHDRAWN },
          ],
        },
      ],
    });
    expect(JSON.stringify(plan)).not.toContain("delivery");
  });
});
