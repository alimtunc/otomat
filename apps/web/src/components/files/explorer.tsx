import type { CheckoutTarget, WorktreeFileEntry } from "@otomat/domain";
import {
  EmptyState,
  ErrorState,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  usePanelGroupLayout,
} from "@otomat/ui";
import { useSourceControl } from "@web/api/source-control/queries";
import { FileBrowser } from "@web/components/files/browser";
import { FilePanel } from "@web/components/files/panel";
import { FILES_SURFACE } from "@web/components/files/surface";
import { useFileSelection } from "@web/components/files/use-file-selection";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import type { ReactNode } from "react";

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
  const layout = usePanelGroupLayout(surface.layout);
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
          defaultSize={264}
          minSize={168}
          maxSize="40%"
        >
          <FileBrowser
            key={active.scope}
            target={target}
            editable={editable}
            scope={active.scope}
            entries={entries}
            changes={changes.data}
            activePath={active.path}
            onSelect={active.select}
          />
        </SidePanel>
        <ResizablePanel id={surface.file} minSize="40%">
          {active.path === null ? (
            <CenteredState>
              <EmptyState icon="file-text" title="No file open" description={surface.empty} />
            </CenteredState>
          ) : (
            <FilePanel target={target} path={active.path} editable={editable} />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
