import type { IssueContract, RunContract } from "@otomat/domain";
import { Button, Skeleton } from "@otomat/ui";
import { RailMeta, RailSection } from "@web/components/issues/workspace/rail/rail-primitives";

import { LabelsEditor } from "../labels-editor";
import { LinearPropertyRows } from "../property-rows";
import { useLinearIssueEditing } from "../use-issue-editing";
import { WriteHistory } from "../write-history";
import { Identifier } from "./identifier";
import { PrAttachment } from "./pr-attachment";

export function LinearRailSection({
  issue,
  run,
}: {
  issue: IssueContract;
  run: RunContract | null;
}) {
  const editing = useLinearIssueEditing(issue.id);

  function body() {
    if (editing.editorOffline) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-text-tertiary">
            Linear is unreachable. Publishing needs the live issue; local edits stay safe.
          </p>
          <Button size="xs" variant="outline" className="self-start" onClick={editing.retryEditor}>
            Retry
          </Button>
        </div>
      );
    }
    if (editing.snapshot === null) return <Skeleton height={96} />;
    return (
      <>
        <RailMeta>
          <LinearPropertyRows editing={editing} issueId={issue.id} runId={run?.id ?? null} />
        </RailMeta>
        <LabelsEditor editing={editing} />
      </>
    );
  }

  return (
    <RailSection
      title={
        <>
          Linear
          <span className="flex-1" />
          <Identifier issue={issue} />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {body()}
        {run !== null ? <PrAttachment issueId={issue.id} run={run} /> : null}
        {editing.writebackOffline ? (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span className="flex-1">Local draft and history could not be loaded.</span>
            <Button size="xs" variant="outline" onClick={editing.retryWriteback}>
              Retry
            </Button>
          </div>
        ) : (
          <WriteHistory issueId={issue.id} writes={editing.writes} />
        )}
      </div>
    </RailSection>
  );
}
