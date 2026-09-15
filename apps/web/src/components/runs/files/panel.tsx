import { ErrorState, Spinner } from "@otomat/ui";
import { useRunFile } from "@web/api/runs/file-queries";
import { MediaBlob } from "@web/components/runs/diff/files/media-blob";
import { WorktreeFileEditor } from "@web/components/runs/files/editor";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { worktreeFileMessage } from "@web/lib/run/file-refusal";

export interface WorktreeFilePanelProps {
  runId: string;
  path: string;
  editable: boolean;
}

export function WorktreeFilePanel({ runId, path, editable }: WorktreeFilePanelProps) {
  const file = useRunFile(runId, path);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <QueryBoundary
        query={file}
        pending={
          <CenteredState>
            <Spinner label={`Loading ${path}`} />
          </CenteredState>
        }
        error={
          <CenteredState>
            <ErrorState
              title={path}
              description={worktreeFileMessage(file.error, "Could not read this file.")}
              onRetry={() => void file.refetch()}
            />
          </CenteredState>
        }
      >
        {(content) =>
          content.kind === "media" ? (
            <figure className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
              <figcaption className="font-mono text-xs text-text-secondary">{path}</figcaption>
              <MediaBlob
                data={content.data}
                mediaType={content.media_type}
                label={path}
                className="max-h-full w-fit max-w-full"
              />
            </figure>
          ) : (
            <WorktreeFileEditor
              key={path}
              runId={runId}
              content={content}
              editable={editable}
              refreshing={file.isFetching}
              onReload={() => void file.refetch()}
            />
          )
        }
      </QueryBoundary>
    </div>
  );
}
