import { IssueStatusChip, PRStatusBadge, RunStatusChip, StepStatusChip } from "@otomat/ui";

import { Row, Section } from "../section";

export function StatusChipsSection() {
  return (
    <Section title="Status chips — color + icon + label (never color alone)">
      <Row>
        <RunStatusChip status="running" />
        <RunStatusChip status="awaiting_permission" />
        <RunStatusChip status="awaiting_human" />
        <RunStatusChip status="review_ready" />
        <RunStatusChip status="completed" />
        <RunStatusChip status="failed" />
        <StepStatusChip status="stale" />
        <RunStatusChip status="canceled" />
        <PRStatusBadge status="open" />
      </Row>
      <Row className="mt-3">
        <span className="w-20 text-xs text-text-secondary">Issue:</span>
        <IssueStatusChip status="backlog" />
        <IssueStatusChip status="ready" />
        <IssueStatusChip status="running" />
        <IssueStatusChip status="reviewing" />
        <IssueStatusChip status="done" />
      </Row>
    </Section>
  );
}
