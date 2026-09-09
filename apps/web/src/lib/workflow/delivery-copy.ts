import type { DeliveryExpectation } from "@otomat/domain";

export interface DeliveryExpectationCopy {
  label: string;
  hint: string;
}

export const DELIVERY_EXPECTATION_COPY = {
  standard: {
    label: "Standard",
    hint: "Finishing the turn is enough, as long as no question was left unanswered.",
  },
  implementation: {
    label: "Implementation",
    hint: "The workspace has to carry the work: no change, or a failed check, holds the next step.",
  },
  analysis: {
    label: "Analysis",
    hint: "No code change is expected; an empty diff finishes this step honestly.",
  },
} satisfies Record<DeliveryExpectation, DeliveryExpectationCopy>;
