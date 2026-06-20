import { CopyButton, MetaList, RunStatusChip, Skeleton } from "@otomat/ui";

import { CARD_RUN } from "../gallery.fixtures";
import { Section } from "../section";

export function CardsSection() {
  return (
    <Section title="Cards · meta · skeleton">
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-65 rounded-lg border border-border bg-surface-1 p-4">
          <div className="mb-2.5 text-sm font-semibold">Run {CARD_RUN.id}</div>
          <MetaList
            items={[
              { key: "state", label: "state", value: <RunStatusChip status="running" /> },
              {
                key: "branch",
                label: "branch",
                value: (
                  <span className="inline-flex items-center gap-1.25 font-mono text-sm">
                    {CARD_RUN.branch}
                    <CopyButton value={CARD_RUN.branch} />
                  </span>
                ),
              },
              {
                key: "diff",
                label: "diff",
                value: (
                  <span className="font-mono text-sm">
                    <span className="text-success">+{CARD_RUN.added}</span>{" "}
                    <span className="text-danger">−{CARD_RUN.removed}</span>
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div className="flex w-65 flex-col gap-2.25 rounded-lg border border-border bg-surface-1 p-4">
          <Skeleton height={12} width="60%" />
          <Skeleton height={12} width="90%" />
          <Skeleton height={12} width="75%" />
          <Skeleton height={28} width="100%" className="mt-1.5" />
        </div>
      </div>
    </Section>
  );
}
