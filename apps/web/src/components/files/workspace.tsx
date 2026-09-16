import type { CheckoutTarget } from "@otomat/domain";
import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { SourceControlPanel } from "@web/components/source-control/panel";
import type { ReactNode } from "react";

export interface FilesWorkspaceProps {
  target: CheckoutTarget;
  children: ReactNode;
}

export function FilesWorkspace({ target, children }: FilesWorkspaceProps) {
  const { changes } = useSearch({ strict: false });
  const navigate = useNavigate();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center border-b border-border-subtle px-3 py-1.5">
        <SegmentedControl
          type="single"
          value={changes ? "changes" : "files"}
          aria-label="File workspace"
          onValueChange={(value) => {
            if (value === null) return;
            void navigate({
              to: ".",
              search: (previous) => ({ ...previous, changes: value === "changes" || undefined }),
              replace: true,
              resetScroll: false,
            });
          }}
        >
          <SegmentedItem value="files" icon={<Icon name="folder" aria-hidden />}>
            Files
          </SegmentedItem>
          <SegmentedItem value="changes" icon={<Icon name="git-compare" aria-hidden />}>
            Changes
          </SegmentedItem>
        </SegmentedControl>
      </div>
      <div className="min-h-0 flex-1">
        {changes ? <SourceControlPanel target={target} /> : children}
      </div>
    </div>
  );
}
