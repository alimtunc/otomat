import {
  Button,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Icon,
  Markdown,
} from "@otomat/ui";
import { useState, type ReactNode } from "react";

export function IssueDescription({
  body,
  collapsed,
  children,
  comments,
}: {
  body: string;
  collapsed: boolean;
  children: ReactNode;
  comments?: ReactNode;
}) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <section id="issue-description">
      <Collapsible open={open} onOpenChange={setOpen}>
        {open || !body ? null : (
          <div
            inert
            aria-hidden
            className="max-h-[10lh] overflow-hidden text-sm leading-[1.65] [mask-image:linear-gradient(black_85%,transparent)]"
          >
            <Markdown value={body} className="text-sm text-text-secondary" />
          </div>
        )}
        <CollapsiblePanel keepMounted>
          <div className="flex flex-col gap-4">
            {children}
            {comments}
          </div>
        </CollapsiblePanel>
        <CollapsibleTrigger render={<Button variant="ghost" size="xs" className="mt-2" />}>
          <Icon name="chevron-down" className={open ? "rotate-180" : undefined} aria-hidden />
          {open ? "Collapse description" : "Open description"}
          {comments ? " and comments" : null}
        </CollapsibleTrigger>
      </Collapsible>
    </section>
  );
}
