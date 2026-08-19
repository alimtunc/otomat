import type {
  UsageDashboard,
  UsageEmitter,
  UsageFigures,
  UsageFilters,
  UsageRange,
  UsageRunRow,
} from "../contracts/usage.js";
import type { UsageRunEvidence, UsageTurnEvidence } from "./evidence.js";
import { addTurns, EMPTY_FIGURES, usageTokenMetric } from "./usage-figures.js";

/** The runtime or model axis value of a turn whose payload named none; a real id is never empty. */
const UNREPORTED_FACET = "";

export function usageFacetValue(value: string | null): string {
  return value ?? UNREPORTED_FACET;
}

export interface UsageDashboardInput {
  range: UsageRange;
  /** Every turn group of the period, before the facets: what the options are read from. */
  turns: readonly UsageTurnEvidence[];
  runs: readonly UsageRunEvidence[];
  filters: UsageFilters;
  runLimit: number;
}

interface Grouped<T> {
  meta: T;
  figures: UsageFigures;
  runs: Set<string>;
}

function fold<T>(
  groups: Map<string, Grouped<T>>,
  key: string,
  meta: () => T,
  row: UsageTurnEvidence,
): Grouped<T> {
  const held = groups.get(key) ?? { meta: meta(), figures: EMPTY_FIGURES, runs: new Set<string>() };
  held.figures = addTurns(held.figures, row);
  held.runs.add(row.run_id);
  groups.set(key, held);
  return held;
}

function byMagnitude<T>(a: Grouped<T>, b: Grouped<T>): number {
  return (usageTokenMetric(b.figures).value ?? -1) - (usageTokenMetric(a.figures).value ?? -1);
}

function emitterKey(emitter: UsageEmitter): string {
  return `${usageFacetValue(emitter.runtime)} ${usageFacetValue(emitter.model)}`;
}

function on(selected: readonly string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

function matches(filters: UsageFilters, run: UsageRunEvidence, row: UsageTurnEvidence): boolean {
  return (
    (filters.day === null || filters.day === row.day) &&
    on(filters.projects, run.project_id) &&
    on(filters.issues, run.issue_id) &&
    on(filters.runtimes, usageFacetValue(row.runtime)) &&
    on(filters.models, usageFacetValue(row.model))
  );
}

function runDuration(run: UsageRunEvidence): number | null {
  if (run.started_at === null || run.completed_at === null) return null;
  const span = Date.parse(run.completed_at) - Date.parse(run.started_at);
  return Number.isFinite(span) && span >= 0 ? span : null;
}

interface RunAccumulator {
  evidence: UsageRunEvidence;
  emitters: Map<string, UsageEmitter>;
  lastActivityAt: string;
}

function toRunRow(group: Grouped<RunAccumulator>): UsageRunRow {
  const { evidence, emitters, lastActivityAt } = group.meta;
  return {
    run_id: evidence.run_id,
    status: evidence.status,
    project_id: evidence.project_id,
    project_name: evidence.project_name,
    issue_id: evidence.issue_id,
    issue_identifier: evidence.issue_identifier,
    issue_title: evidence.issue_title,
    emitters: [...emitters.values()],
    last_activity_at: lastActivityAt,
    duration_ms: runDuration(evidence),
    figures: group.figures,
  };
}

function facetOptions(
  turns: readonly UsageTurnEvidence[],
  runs: readonly UsageRunEvidence[],
): UsageDashboard["options"] {
  const emitters = new Map<string, UsageEmitter>();
  for (const row of turns) {
    const emitter = { runtime: row.runtime, model: row.model };
    emitters.set(emitterKey(emitter), emitter);
  }
  const projects = new Map(
    runs.map((run) => [run.project_id, { id: run.project_id, name: run.project_name }]),
  );
  const issues = new Map(
    runs.map((run) => [
      run.issue_id,
      { id: run.issue_id, identifier: run.issue_identifier, title: run.issue_title },
    ]),
  );
  return {
    projects: [...projects.values()].toSorted((a, b) => a.name.localeCompare(b.name)),
    emitters: [...emitters.values()].toSorted((a, b) => emitterKey(a).localeCompare(emitterKey(b))),
    issues: [...issues.values()].toSorted((a, b) =>
      (a.identifier ?? a.title).localeCompare(b.identifier ?? b.title),
    ),
  };
}

export function usageDashboard(input: UsageDashboardInput): UsageDashboard {
  const runsById = new Map(input.runs.map((run) => [run.run_id, run]));
  const daily = new Map<string, Grouped<string>>();
  const projects = new Map<string, Grouped<UsageRunEvidence>>();
  const emitters = new Map<string, Grouped<UsageEmitter>>();
  const runs = new Map<string, Grouped<RunAccumulator>>();
  const steps = new Set<string>();
  let totals = EMPTY_FIGURES;

  for (const row of input.turns) {
    const run = runsById.get(row.run_id);
    if (run === undefined || !matches(input.filters, run, row)) continue;
    totals = addTurns(totals, row);
    if (row.step_run_id !== null) steps.add(row.step_run_id);
    fold(daily, row.day, () => row.day, row);
    fold(projects, run.project_id, () => run, row);
    const emitter = { runtime: row.runtime, model: row.model };
    fold(emitters, emitterKey(emitter), () => emitter, row);
    const held = fold(
      runs,
      row.run_id,
      () => ({ evidence: run, emitters: new Map(), lastActivityAt: row.last_occurred_at }),
      row,
    );
    held.meta.emitters.set(emitterKey(emitter), emitter);
    if (row.last_occurred_at > held.meta.lastActivityAt) {
      held.meta.lastActivityAt = row.last_occurred_at;
    }
  }

  const durations = [...runs.values()].map((group) => runDuration(group.meta.evidence));
  const measured = durations.filter((span): span is number => span !== null);

  return {
    range: input.range,
    totals: {
      figures: totals,
      runs: runs.size,
      steps: steps.size,
      duration: {
        total_ms: measured.length === 0 ? null : measured.reduce((sum, span) => sum + span, 0),
        measured_runs: measured.length,
        unmeasured_runs: durations.length - measured.length,
      },
    },
    daily: [...daily.values()]
      .toSorted((a, b) => a.meta.localeCompare(b.meta))
      .map((group) => ({ day: group.meta, figures: group.figures, runs: group.runs.size })),
    projects: [...projects.values()].toSorted(byMagnitude).map((group) => ({
      project_id: group.meta.project_id,
      project_name: group.meta.project_name,
      figures: group.figures,
      runs: group.runs.size,
    })),
    emitters: [...emitters.values()]
      .toSorted(byMagnitude)
      .map((group) => ({ emitter: group.meta, figures: group.figures, runs: group.runs.size })),
    runs: [...runs.values()]
      .toSorted((a, b) => b.meta.lastActivityAt.localeCompare(a.meta.lastActivityAt))
      .slice(0, input.runLimit)
      .map(toRunRow),
    options: facetOptions(input.turns, input.runs),
  };
}
