import type { CheckoutTarget } from "@otomat/domain";
import { useParams } from "@tanstack/react-router";
import { useRepositories } from "@web/api/daemon/queries";
import { QuickOpenResults } from "@web/components/files/quick-open-results";
import { useFileShortcut } from "@web/components/files/use-file-shortcut";
import { useState } from "react";

export interface QuickOpenProps {
  projectId?: string;
  issueRunId?: string;
}

export function QuickOpen({ projectId, issueRunId }: QuickOpenProps) {
  const { runId, issueId } = useParams({ strict: false });
  const repositories = useRepositories(projectId);
  const [open, setOpen] = useState(false);
  useFileShortcut(() => setOpen(true));
  const run = runId ?? issueRunId;
  const repository = repositories.data?.find((entry) => entry.project_id === projectId);
  let target: CheckoutTarget | null = null;
  if (run !== undefined) target = { kind: "run", id: run };
  else if (issueId === undefined && repository !== undefined)
    target = { kind: "repository", id: repository.id };
  return (
    <QuickOpenResults
      key={`${target?.kind}:${target?.id}`}
      target={target}
      open={open}
      onOpenChange={setOpen}
    />
  );
}
