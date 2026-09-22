import type {
  ChangeFilesRequest,
  ChangeSelection,
  CheckoutTarget,
  SourceControlAction,
} from "@otomat/domain";
import {
  EmptyState,
  ErrorState,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  usePanelGroupLayout,
} from "@otomat/ui";
import { useChangeFiles } from "@web/api/source-control/mutations";
import { useSourceControl } from "@web/api/source-control/queries";
import { useFileSelection } from "@web/components/files/use-file-selection";
import { LinesSkeleton } from "@web/components/shell/lines-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { CommitForm } from "@web/components/source-control/commit-form";
import { DiscardDialog } from "@web/components/source-control/discard-dialog";
import { ChangeFileDiff } from "@web/components/source-control/file/diff";
import { ChangeFileGroup } from "@web/components/source-control/file/group";
import { SourceControlHeader } from "@web/components/source-control/header";
import { sourceControlMessage } from "@web/components/source-control/refusal";
import { selectedChange, type ActiveChange } from "@web/components/source-control/selection";
import { useState } from "react";

export interface SourceControlPanelProps {
  target: CheckoutTarget;
}

export function SourceControlPanel({ target }: SourceControlPanelProps) {
  const changes = useSourceControl(target);
  const mutation = useChangeFiles(target);
  const [active, setActive] = useState<ActiveChange | null>(null);
  const [discard, setDiscard] = useState<ChangeFilesRequest | null>(null);
  const layout = usePanelGroupLayout("otomat.source-control");
  const fileSelection = useFileSelection(target);
  const pending = mutation.isPending || changes.isFetching || changes.isError;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SourceControlHeader
        target={target}
        changes={changes.data}
        pending={pending}
        refreshing={changes.isFetching}
        onRefresh={() => void changes.refetch()}
      />
      {mutation.error === null ? null : (
        <ErrorState
          variant="inline"
          title={sourceControlMessage(mutation.error)}
          onRetry={() => {
            mutation.reset();
            void changes.refetch();
          }}
        />
      )}
      <QueryBoundary
        query={changes}
        pending={<LinesSkeleton lines={6} className="p-3.5" />}
        error={
          <ErrorState
            title="Could not load changes"
            description={sourceControlMessage(changes.error)}
            onRetry={() => void changes.refetch()}
          />
        }
      >
        {(data) => {
          const act = (
            path: string | undefined,
            action: SourceControlAction,
            selection?: ChangeSelection,
          ): void => {
            const request: ChangeFilesRequest = {
              path,
              all: path === undefined ? true : undefined,
              action,
              selection,
              revision: data.revision,
            };
            if (action === "discard") setDiscard(request);
            else mutation.mutate(request);
          };
          if (data.conflicts.length > 0)
            return (
              <ErrorState
                title="Resolve merge conflicts first"
                description={data.conflicts.join(", ")}
                onRetry={() => void changes.refetch()}
              />
            );
          const selected = selectedChange(data, active, fileSelection.path);
          return (
            <ResizablePanelGroup {...layout} className="min-h-0 flex-1">
              <SidePanel
                id="changed-files"
                label="Changed files"
                side="left"
                defaultSize={300}
                minSize={200}
                maxSize="45%"
              >
                <CommitForm target={target} changes={data} disabled={pending} />
                <div className="min-h-0 flex-1 overflow-auto">
                  {[true, false].map((staged) => (
                    <ChangeFileGroup
                      key={String(staged)}
                      staged={staged}
                      files={staged ? data.staged : data.unstaged}
                      activePath={
                        selected?.current.staged === staged ? selected.current.path : null
                      }
                      pending={pending}
                      onSelect={(path) => setActive({ staged, path })}
                      onAction={act}
                    />
                  ))}
                </div>
              </SidePanel>
              <ResizablePanel id="change-diff" minSize="40%">
                {selected === null ? (
                  <EmptyState
                    icon="git-compare"
                    title={
                      data.staged.length + data.unstaged.length === 0
                        ? "Working tree clean"
                        : "Choose a change"
                    }
                    description="Select a file to review its staged or unstaged changes."
                  />
                ) : (
                  <ChangeFileDiff
                    key={`${selected.current.staged}:${selected.file.path}:${selected.file.sha}`}
                    file={selected.file}
                    staged={selected.current.staged}
                    pending={pending}
                    onAction={(action, selection) => act(selected.file.path, action, selection)}
                    onOpen={() => fileSelection.select(selected.file.path)}
                  />
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          );
        }}
      </QueryBoundary>
      <DiscardDialog
        request={discard}
        onClose={() => setDiscard(null)}
        onConfirm={(request) => {
          mutation.mutate(request);
          setDiscard(null);
        }}
      />
    </div>
  );
}
