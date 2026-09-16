import type { CheckoutTarget } from "@otomat/domain";
import { ErrorState, Spinner } from "@otomat/ui";
import { useFile } from "@web/api/files/queries";
import { FileEditor } from "@web/components/files/editor";
import { MediaBlob } from "@web/components/runs/diff/files/media-blob";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { worktreeFileMessage } from "@web/lib/run/file-refusal";

export interface FilePanelProps {
  target: CheckoutTarget;
  path: string;
  editable: boolean;
}

export function FilePanel({ target, path, editable }: FilePanelProps) {
  const file = useFile(target, path);
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
            <FileEditor
              key={path}
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
  );
}
