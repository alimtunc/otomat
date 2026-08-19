import type { RuntimeOptionSupport } from "#runtime/contract";

/** Simulated levels, published per model exactly as the real providers publish theirs. No provider is contacted. */
const FAKE_EFFORT_LEVELS = new Map<string, readonly string[]>([
  ["fake-fast", ["low", "medium"]],
  ["fake-thorough", ["low", "medium", "high"]],
]);

const NO_MODEL_DETAIL =
  "The simulated runtime publishes effort levels per model, so pick one first.";

/** The levels the test adapter attributes to this exact model; a model it does not describe gets no field rather than another model's levels. */
export function fakeOptionSupport(model: string | null): RuntimeOptionSupport {
  const levels = model === null ? undefined : FAKE_EFFORT_LEVELS.get(model);
  if (levels === undefined) {
    return { detection: { status: "unsupported", detail: NO_MODEL_DETAIL }, options: [] };
  }
  return {
    detection: {
      status: "ok",
      detail: "Simulated levels of the test adapter; no binary is probed.",
    },
    options: [
      {
        key: "effort",
        description: "How much simulated effort the test adapter spends.",
        choices: levels.map((value) => ({ value, description: null, dangerous: false })),
        default_value: "low",
      },
    ],
  };
}
