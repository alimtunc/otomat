import {
  AGENT_DEFAULT_EFFORT,
  storedEffortLevel,
  type AgentProfileContract,
  type EffortSelection,
  type ProviderOptionDescriptor,
  type ProviderOptionSet,
} from "@otomat/domain";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

/** Select sentinels: an effort is either one of these two intents or a level the runtime announced. */
export const EFFORT_RUN_VALUE = "__same_as_run";
export const EFFORT_AGENT_DEFAULT_VALUE = "__agent_default";

/** What a step inherits when it names no effort of its own. */
export const RUN_EFFORT_LABEL = "Same as run";

/** What both pickers fall back to: whatever the agent they resolve to already carries. */
export const AGENT_EFFORT_LABEL = "Agent default";

/** The level a node will really run at, and where that level came from. */
export type ResolvedEffort =
  | { level: string; source: "step" }
  | { level: string; source: "run" }
  | { level: string; source: "profile"; profileName: string }
  /** Nothing selects a level, so Otomat sends no effort argument and the runtime's own applies. */
  | { level: null; source: "runtime" };

/** One entry an effort picker offers. */
export interface EffortChoiceItem {
  value: string;
  label: string;
  /** A selected level the runtime and model no longer announce, kept in the list so the trigger never lies. */
  stale: boolean;
}

export function effortSelectValue(selection: EffortSelection | undefined): string {
  if (selection === undefined) return EFFORT_RUN_VALUE;
  return selection.kind === "level" ? selection.value : EFFORT_AGENT_DEFAULT_VALUE;
}

export function effortSelectionFromValue(value: string): EffortSelection | undefined {
  if (value === EFFORT_RUN_VALUE) return undefined;
  if (value === EFFORT_AGENT_DEFAULT_VALUE) return AGENT_DEFAULT_EFFORT;
  return { kind: "level", value };
}

/**
 * Every entry the picker offers, in display order: inherit-from-the-run when
 * offered, the agent default, a selected level the announced set does not carry,
 * then the levels it does. Nothing is listed that the detected capabilities did
 * not name, and a level is only called dropped once the daemon has `answered` —
 * before that, absence is ignorance, not a verdict.
 */
export function effortChoiceItems(
  descriptor: ProviderOptionDescriptor | null,
  selection: EffortSelection | undefined,
  options: { offerRun: boolean; answered: boolean },
): EffortChoiceItem[] {
  const choices = descriptor?.choices ?? [];
  const selected = selection?.kind === "level" ? selection.value : null;
  const label = selected === null ? "" : providerOptionValueLabel(selected);
  const kept =
    selected !== null && !choices.some((choice) => choice.value === selected)
      ? [
          {
            value: selected,
            label: options.answered ? `${label} — no longer offered` : label,
            stale: options.answered,
          },
        ]
      : [];
  return [
    ...(options.offerRun
      ? [{ value: EFFORT_RUN_VALUE, label: RUN_EFFORT_LABEL, stale: false }]
      : []),
    { value: EFFORT_AGENT_DEFAULT_VALUE, label: AGENT_EFFORT_LABEL, stale: false },
    ...kept,
    ...choices.map((choice) => ({
      value: choice.value,
      label: providerOptionValueLabel(choice.value),
      stale: false,
    })),
  ];
}

/** What the chosen agent carries on its own: a profile's saved level, or nothing at all for an ad-hoc runtime. */
export function agentEffort(profile: AgentProfileContract | null): ResolvedEffort {
  const stored = profile === null ? null : storedEffortLevel(profile.options);
  if (profile === null || stored === null) return { level: null, source: "runtime" };
  return { level: stored, source: "profile", profileName: profile.name };
}

/** The run's effective effort: the level it names, else whatever its agent carries. */
export function resolveRunEffort(
  selection: EffortSelection,
  agent: ResolvedEffort,
): ResolvedEffort {
  return selection.kind === "level" ? { level: selection.value, source: "run" } : agent;
}

/**
 * A node's effective effort: the level it names, the run's while it inherits,
 * else its own agent's. "Same as run" only carries an explicit run level — with
 * none, every node keeps the level of the agent it resolves to, which may not be
 * the run's.
 */
export function resolveNodeEffort(
  selection: EffortSelection | undefined,
  run: ResolvedEffort,
  agent: ResolvedEffort,
): ResolvedEffort {
  if (selection?.kind === "level") return { level: selection.value, source: "step" };
  return selection === undefined && run.source === "run" ? run : agent;
}

/** The level that will actually be sent and where it came from; a runtime default names the value whenever the descriptor does. */
export function resolvedEffortLabel(
  resolved: ResolvedEffort,
  descriptor: ProviderOptionDescriptor | null,
): string {
  if (resolved.source === "runtime") {
    const named = descriptor?.default_value ?? null;
    return named === null
      ? "Runtime default"
      : `Runtime default — ${providerOptionValueLabel(named)}`;
  }
  const level = providerOptionValueLabel(resolved.level);
  if (resolved.source === "step") return `${level} — set on this step`;
  if (resolved.source === "run") return `${level} — from the run`;
  return `${level} — from profile “${resolved.profileName}”`;
}

/** One honest sentence about where these levels come from, or why there are none. */
export function effortNote(
  set: ProviderOptionSet | undefined,
  descriptor: ProviderOptionDescriptor | null,
  isPending: boolean,
  isError: boolean,
): string | null {
  if (isPending) return "Checking what the installed CLI accepts…";
  if (isError) return "The daemon could not report this runtime's effort levels.";
  if (set === undefined) return null;
  if (descriptor === null) return `${set.detection.detail} No effort level is offered here.`;
  return `${set.detection.detail} ${descriptor.description}`;
}
