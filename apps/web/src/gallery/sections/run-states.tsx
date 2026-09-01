import type { PullRequestDetail, RunDetail } from "@otomat/domain";
import { NextActionCard } from "@web/components/runs/next-action/card";
import { NextActionStrip } from "@web/components/runs/next-action/strip";
import { PullRequestOutcome } from "@web/components/runs/pr/outcome";

import {
  pullRequestDetailFixture,
  pullRequestFixture,
  runDetailFixture,
} from "../gallery.fixtures";
import { Section } from "../section";

interface StripCase {
  label: string;
  detail: RunDetail;
  pullRequest: PullRequestDetail | undefined;
}

const COMPLETED_CASES: StripCase[] = [
  {
    label: "completed · unpublished",
    detail: runDetailFixture("completed"),
    pullRequest: pullRequestDetailFixture(null),
  },
  {
    label: "completed · PR open",
    detail: runDetailFixture("completed"),
    pullRequest: pullRequestDetailFixture(pullRequestFixture({})),
  },
  {
    label: "completed · PR merged",
    detail: runDetailFixture("completed"),
    pullRequest: pullRequestDetailFixture(pullRequestFixture({ status: "merged" })),
  },
];

const STRIP_CASES: StripCase[] = [
  { label: "running", detail: runDetailFixture("running"), pullRequest: undefined },
  {
    label: "awaiting_permission",
    detail: runDetailFixture("awaiting_permission"),
    pullRequest: undefined,
  },
  {
    label: "awaiting_selection",
    detail: runDetailFixture("awaiting_selection"),
    pullRequest: undefined,
  },
  {
    label: "waiting_for_provider",
    detail: runDetailFixture("waiting_for_provider"),
    pullRequest: undefined,
  },
  { label: "review_ready", detail: runDetailFixture("review_ready"), pullRequest: undefined },
  ...COMPLETED_CASES,
  {
    label: "failed",
    detail: runDetailFixture("failed", [{ id: "s1", status: "failed" }]),
    pullRequest: undefined,
  },
  { label: "canceled", detail: runDetailFixture("canceled"), pullRequest: undefined },
];

export function RunStatesSection() {
  return (
    <Section title="Run states — one next action per durable state">
      <div className="flex flex-col gap-2">
        {STRIP_CASES.map((item) => (
          <div key={item.label}>
            <p className="mb-1 font-mono text-xs text-text-tertiary">{item.label}</p>
            <div className="overflow-hidden rounded-md border border-border-subtle">
              <NextActionStrip detail={item.detail} pullRequest={item.pullRequest} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {COMPLETED_CASES.map((item) => (
          <div key={item.label}>
            <p className="mb-1 font-mono text-xs text-text-tertiary">rail card · {item.label}</p>
            <NextActionCard detail={item.detail} pullRequest={item.pullRequest} />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div>
          <p className="mb-1 font-mono text-xs text-text-tertiary">PR tab · merged</p>
          <PullRequestOutcome
            pullRequest={pullRequestFixture({ status: "merged" })}
            runId="run-1"
            issueTitle="Centraliser la prochaine action des runs"
            hasWorktree={false}
          />
        </div>
        <div>
          <p className="mb-1 font-mono text-xs text-text-tertiary">PR tab · closed</p>
          <PullRequestOutcome
            pullRequest={pullRequestFixture({ status: "closed" })}
            runId="run-1"
            issueTitle="Centraliser la prochaine action des runs"
            hasWorktree={true}
          />
        </div>
      </div>
    </Section>
  );
}
