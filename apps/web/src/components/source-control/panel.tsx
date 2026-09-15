import type {
  ChangeFilesRequest,
  ChangeSelection,
  CheckoutTarget,
  SourceControlAction,
} from "@otomat/domain";
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  Spinner,
  usePanelGroupLayout,
} from "@otomat/ui";
import { useChangeFiles } from "@web/api/source-control/mutations";
import { useSourceControl } from "@web/api/source-control/queries";
import { useFileSelection } from "@web/components/files/use-file-selection";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { CommitForm } from "@web/components/source-control/commit-form";
import { DiscardDialog } from "@web/components/source-control/discard-dialog";
import { ChangeFileDiff } from "@web/components/source-control/file/diff";
import { ChangeFileGroup } from "@web/components/source-control/file/group";
import { PublishAction } from "@web/components/source-control/publish-action";
import { sourceControlMessage } from "@web/components/source-control/refusal";
import { useActiveHostId } from "@web/lib/active-host";
import { useState } from "react";

export interface SourceControlPanelProps {
  target: CheckoutTarget;
}

export function SourceControlPanel({ target }: SourceControlPanelProps) {
  const changes = useSourceControl(target);
  const mutation = useChangeFiles(target);
  const [active, setActive] = useState<{ staged: boolean; path: string } | null>(null);
  const [discard, setDiscard] = useState<ChangeFilesRequest | null>(null);
  const layout = usePanelGroupLayout("otomat.source-control");
  const host = useActiveHostId();
  const fileSelection = useFileSelection(`${host}:${target.kind}:${target.id}`);

  const act = (
    path: string | undefined,
    action: SourceControlAction,
    selection?: ChangeSelection,
  ): void => {
    if (changes.data === undefined || changes.isFetching || mutation.isPending) return;
    const request: ChangeFilesRequest = {
      path,
      all: path === undefined ? true : undefined,
      action,
      selection,
      revision: changes.data.revision,
    };
    if (action === "discard") setDiscard(request);
    else mutation.mutate(request);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs">
        <Icon name="folder-git-2" aria-hidden />
        <span className="truncate font-mono">
          {changes.data?.branch === "HEAD" ? "Detached HEAD" : changes.data?.branch}
        </span>
        <span className="ml-auto text-text-tertiary">
          {target.kind === "run" ? "Issue worktree" : "Project checkout"}
        </span>
        {changes.data === undefined ? null : (
          <PublishAction
            target={target}
            changes={changes.data}
            disabled={
              changes.isFetching ||
              changes.isError ||
              mutation.isPending ||
              changes.data.conflicts.length > 0
            }
          />
        )}
        <IconButton
          label="Refresh changes"
          icon={<Icon name="refresh-cw" aria-hidden />}
          loading={changes.isFetching}
          onClick={() => void changes.refetch()}
        />
      </div>
      {mutation.error !== null ? (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-border-subtle bg-warning-bg px-3 py-2 text-xs"
        >
          <span className="flex-1">{sourceControlMessage(mutation.error)}</span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              mutation.reset();
              void changes.refetch();
            }}
          >
            Refresh
          </Button>
        </div>
      ) : null}
      <QueryBoundary
        query={changes}
        pending={
          <CenteredState fill="flex">
            <Spinner label="Loading changes" />
          </CenteredState>
        }
        error={
          <ErrorState
            title="Could not load changes"
            description={sourceControlMessage(changes.error)}
            onRetry={() => void changes.refetch()}
          />
        }
      >
        {(data) => {
          const current =
            active ??
            (fileSelection.path === null
              ? null
              : {
                  path: fileSelection.path,
                  staged: !data.unstaged.some((file) => file.path === fileSelection.path),
                });
          const file =
            current === null
              ? undefined
              : (current.staged ? data.staged : data.unstaged).find(
                  (entry) => entry.path === current.path,
                );
          const pending = mutation.isPending || changes.isFetching || changes.isError;
          if (data.conflicts.length > 0)
            return (
              <ErrorState
                title="Resolve merge conflicts first"
                description={data.conflicts.join(", ")}
                onRetry={() => void changes.refetch()}
              />
            );
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
                      activePath={current?.staged === staged ? current.path : null}
                      pending={pending}
                      onSelect={(path) => setActive({ staged, path })}
                      onAction={act}
                    />
                  ))}
                </div>
              </SidePanel>
              <ResizablePanel id="change-diff" minSize="40%">
                {file === undefined || current === null ? (
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
                  <div className="flex h-full min-h-0 flex-col">
                    {file.status !== "deleted" ? (
                      <div className="flex justify-end border-b border-border-subtle px-3 py-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => fileSelection.select(file.path)}
                        >
                          Open file
                        </Button>
                      </div>
                    ) : null}
                    <ChangeFileDiff
                      key={`${current.staged}:${file.path}:${file.sha}`}
                      file={file}
                      staged={current.staged}
                      pending={pending}
                      onAction={(action, selection) => act(file.path, action, selection)}
                    />
                  </div>
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
