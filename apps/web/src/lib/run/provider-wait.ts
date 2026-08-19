import type { RunDetail, StepProviderWait, StepRunContract } from "@otomat/domain";

export interface ProviderWaitTarget {
  step: StepRunContract;
  wait: StepProviderWait;
}

/**
 * The suspended step the panel speaks for; a competition's candidates are scheduled
 * together, so the first answers for all of them. The run's own state is read too:
 * the daemon only sweeps a wait whose run is waiting with it, and a panel offering
 * a schedule nothing would honour is worse than none.
 */
export function providerWaitTarget(detail: RunDetail): ProviderWaitTarget | null {
  if (detail.run.status !== "waiting_for_provider") return null;
  const step = detail.steps.find((candidate) => candidate.provider_wait !== null);
  return step?.provider_wait ? { step, wait: step.provider_wait } : null;
}
