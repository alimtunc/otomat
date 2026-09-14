import { Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import type { ReactNode } from "react";

export function RailDisclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <Collapsible className="group/cycle border-b border-border-subtle last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md py-2 text-left text-xs hover:bg-hover">
        <Icon
          name="chevron-down"
          className="size-3 shrink-0 group-data-[closed]/cycle:-rotate-90"
        />
        <span className="font-medium text-text-secondary">{title}</span>
        <span className="ml-auto min-w-0 truncate text-text-tertiary">{summary}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="pb-2">{children}</CollapsiblePanel>
    </Collapsible>
  );
}
