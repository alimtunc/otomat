import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Icon,
  Skeleton,
} from "@otomat/ui";
import { useSessionContext } from "@web/api/runs/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { SessionContextSections } from "@web/components/runs/session/context-sections";
import { useState } from "react";

export interface SessionContextDialogProps {
  runId: string;
  agentSessionId: string;
}

/** The working dossier this session received, so what an agent was given stays readable after the turn. */
export function SessionContextDialog({ runId, agentSessionId }: SessionContextDialogProps) {
  const [open, setOpen] = useState(false);
  const query = useSessionContext(runId, agentSessionId, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="xs" title="What this session received">
            <Icon name="list-tree" aria-hidden />
            Context
          </Button>
        }
      />
      <DialogContent aria-label="Working context of this session">
        <DialogHeader>
          <DialogTitle>Working context</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[62vh] overflow-y-auto">
          {query.isPending ? <Skeleton className="h-40 w-full" /> : null}
          {query.isError ? (
            <ErrorReport
              error={query.error}
              context="Couldn’t load this session’s context"
              onRetry={() => void query.refetch()}
            />
          ) : null}
          {query.data?.context ? (
            <>
              <p className="mb-2 text-xs text-text-tertiary">
                Captured at {query.data.context.captured_at} from this daemon’s own records.
              </p>
              <SessionContextSections context={query.data.context} />
            </>
          ) : null}
          {query.isSuccess && query.data.context === null ? (
            <p className="text-sm text-text-secondary">
              This session ran before Otomat captured working contexts.
            </p>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
