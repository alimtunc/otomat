import type { CheckoutTarget } from "@otomat/domain";
import { useSearch } from "@tanstack/react-router";
import { SourceControlPanel } from "@web/components/source-control/panel";
import type { ReactNode } from "react";

export interface FilesWorkspaceProps {
  target: CheckoutTarget;
  tabs?: ReactNode;
  children: ReactNode;
}

export function FilesWorkspace({ target, tabs, children }: FilesWorkspaceProps) {
  const { changes } = useSearch({ strict: false });
  return (
    <div className="flex h-full min-h-0 flex-col">
      {tabs ? (
        <div className="flex items-center border-b border-border-subtle px-3 py-1.5">{tabs}</div>
      ) : null}
      <div className="min-h-0 flex-1">
        {changes ? <SourceControlPanel target={target} /> : children}
      </div>
    </div>
  );
}
