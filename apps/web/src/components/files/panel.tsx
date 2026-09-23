import type { CheckoutTarget, WorktreeFileContent } from "@otomat/domain";
import { cn, ErrorState, STALE_CONTENT_CLASS } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { FileEditor } from "@web/components/files/editor";
import { EDITOR_PLACEHOLDER_LINES } from "@web/components/files/surface";
import { MediaBlob } from "@web/components/runs/diff/files/media-blob";
import { CenteredState } from "@web/components/shell/centered-state";
import { LinesSkeleton } from "@web/components/shell/lines-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { worktreeFileMessage } from "@web/lib/run/file-refusal";

export interface FilePanelProps {
  target: CheckoutTarget;
  path: string;
  file: UseQueryResult<WorktreeFileContent>;
  editable: boolean;
}

export function FilePanel({ target, path, file, editable }: FilePanelProps) {
  const retained = file.isPlaceholderData;
  return (
    <>
      {retained ? <output className="sr-only">{`Loading ${path}`}</output> : null}
      <div
        inert={retained}
        className={cn("flex h-full min-h-0 flex-col", retained && STALE_CONTENT_CLASS)}
      >
        <QueryBoundary
          query={file}
          pending={<LinesSkeleton lines={EDITOR_PLACEHOLDER_LINES} />}
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
                <figcaption className="font-mono text-xs text-text-secondary">
                  {content.path}
                </figcaption>
                <MediaBlob
                  data={content.data}
                  mediaType={content.media_type}
                  label={content.path}
                  className="max-h-full w-fit max-w-full"
                />
              </figure>
            ) : (
              <FileEditor
                key={content.path}
                target={target}
                content={content}
                editable={editable}
                refreshing={file.isFetching}
                onReload={() => void file.refetch()}
              />
            )
          }
        </QueryBoundary>
      </div>
    </>
  );
}
