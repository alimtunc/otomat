import { CountBadge } from "@web/components/issues/count-badge";
import { ActiveHostTag } from "@web/components/shell/remote-session/active-host-tag";
import { GROUP_HEAD_CELL } from "@web/lib/table";
import type { WorkspaceRepositoryGroup } from "@web/lib/workspace/filter";
import type { ReactNode } from "react";

export interface WorkspaceRepositorySectionProps {
  group: WorkspaceRepositoryGroup;
  columnCount: number;
  children: ReactNode;
}

export function WorkspaceRepositorySection({
  group,
  columnCount,
  children,
}: WorkspaceRepositorySectionProps) {
  return (
    <>
      <tbody>
        <tr>
          <th scope="colgroup" colSpan={columnCount} className={GROUP_HEAD_CELL}>
            <div className="flex h-9 items-center gap-2 px-3">
              <span className="text-sm font-medium text-foreground">{group.name}</span>
              <ActiveHostTag />
              <span className="min-w-0 truncate font-mono text-micro text-text-tertiary">
                {group.path}
              </span>
              <CountBadge count={group.entries.length} tone="neutral" />
            </div>
          </th>
        </tr>
      </tbody>
      <tbody>{children}</tbody>
    </>
  );
}
