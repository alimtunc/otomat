import type { CheckoutTarget, WorktreeFileEntry } from "@otomat/domain";
import {
  EmptyState,
  ErrorState,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  usePanelGroupLayout,
} from "@otomat/ui";
import { useFile } from "@web/api/files/queries";
import { useSourceControl } from "@web/api/source-control/queries";
import { FileBrowser } from "@web/components/files/browser";
import { FilePanel } from "@web/components/files/panel";
import { FILE_TREE_WIDTH, FILES_SURFACE } from "@web/components/files/surface";
import { useFileSelection } from "@web/components/files/use-file-selection";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useMemo, useState, type ReactNode } from "react";

export interface FilesExplorerProps {
  target: CheckoutTarget;
  entries: readonly WorktreeFileEntry[];
  editable: boolean;
  notice?: ReactNode;
}

export function FilesExplorer({ target, entries, editable, notice }: FilesExplorerProps) {
  const surface = FILES_SURFACE[target.kind];
  const changes = useSourceControl(target, editable);
  const active = useFileSelection(target);
  const file = useFile(target, active.path);
  const layout = usePanelGroupLayout(surface.layout);
  const [ignored, setIgnored] = useState<readonly WorktreeFileEntry[]>([]);
  const remember = (entry: WorktreeFileEntry): void => {
    if (entry.ignored && !ignored.some((known) => known.path === entry.path))
      setIgnored([...ignored, entry]);
  };
  if (file.data?.kind === "text" && file.data.ignored)
    remember({ path: file.data.path, kind: "file", size: file.data.bytes, ignored: true });
  const listed = useMemo(() => {
    const paths = new Set(entries.map((entry) => entry.path));
    return [...entries, ...ignored.filter((entry) => !paths.has(entry.path))];
  }, [entries, ignored]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {notice}
      {editable ? (
        <QueryBoundary
          query={changes}
          pending={null}
          error={
            <ErrorState
              variant="inline"
              title="Git status unavailable"
              onRetry={() => void changes.refetch()}
            />
          }
        >
          {() => null}
        </QueryBoundary>
      ) : null}
      <ResizablePanelGroup {...layout} className="min-h-0 flex-1">
        <SidePanel
          id={surface.panel}
          label={surface.label}
          side="left"
          defaultSize={FILE_TREE_WIDTH}
          minSize={168}
          maxSize="40%"
        >
          <FileBrowser
            key={active.scope}
            target={target}
            editable={editable}
            scope={active.scope}
            entries={listed}
            changes={changes.data}
            activePath={active.path}
            onSelect={active.select}
            onCreated={remember}
          />
        </SidePanel>
        <ResizablePanel id={surface.file} minSize="40%">
          {active.path === null ? (
            <CenteredState>
              <EmptyState icon="file-text" title="No file open" description={surface.empty} />
            </CenteredState>
          ) : (
            <FilePanel target={target} path={active.path} file={file} editable={editable} />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
