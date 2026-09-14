import { Button, Collapsible, CollapsiblePanel, CollapsibleTrigger, Markdown } from "@otomat/ui";
import { OverviewSection } from "@web/components/pull-requests/overview/section";
import { useState } from "react";

export function PullRequestDescription({ body }: { body: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <OverviewSection title="Description">
      {body === null ? (
        <p className="mt-2 text-sm text-text-tertiary">This pull request has no description.</p>
      ) : (
        <Collapsible open={open} onOpenChange={setOpen}>
          {open ? null : (
            <div inert>
              <Markdown value={body} className="mt-2 line-clamp-4" />
            </div>
          )}
          <CollapsiblePanel>
            <div className="mt-2">
              <Markdown value={body} />
            </div>
          </CollapsiblePanel>
          <CollapsibleTrigger render={<Button variant="ghost" size="xs" className="mt-2" />}>
            {open ? "Show less" : "Show full description"}
          </CollapsibleTrigger>
        </Collapsible>
      )}
    </OverviewSection>
  );
}
