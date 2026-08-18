import { HostTag } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { remoteHostAlias } from "@web/lib/desktop-bridge";
import { GROUP_HEAD_CELL } from "@web/lib/table";
import type { WorkspaceRepositoryGroup } from "@web/lib/workspace/filter";
import type { ReactNode } from "react";

export interface WorkspaceRepositorySectionProps {
  group: WorkspaceRepositoryGroup;
  columnCount: number;
  children: ReactNode;
}

/** The daemon answers for its own machine, so every repository it holds carries that host's tag. */
export function WorkspaceRepositorySection({
  group,
  columnCount,
  children,
}: WorkspaceRepositorySectionProps) {
  const alias = remoteHostAlias();
  return (
    <>
      <tbody>
        <tr>
          <th scope="colgroup" colSpan={columnCount} className={GROUP_HEAD_CELL}>
            <div className="flex h-9 items-center gap-2 px-3">
              <span className="text-sm font-medium text-foreground">{group.name}</span>
              <HostTag tag={alias ?? "local"} />
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
