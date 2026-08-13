import { Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import type { ContextSource } from "@web/lib/context/sources";

export interface ContextSourcesPanelProps {
  sources: readonly ContextSource[];
}

/** A disclosure of provenance, not a prompt to edit: the daemon composes the text from its own records. */
export function ContextSourcesPanel({ sources }: ContextSourcesPanelProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-text-secondary hover:text-foreground">
        <Icon
          name="chevron-right"
          aria-hidden
          className="h-3 w-3 transition-transform group-data-[panel-open]:rotate-90"
        />
        What this agent receives
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <ul className="mt-1.5 flex flex-col gap-1 rounded-md border border-border-subtle bg-surface p-2">
          {sources.map((source) => (
            <li key={source.id} className="flex flex-col text-xs">
              <span className="font-medium text-foreground">{source.label}</span>
              <span className="text-text-tertiary">{source.detail}</span>
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  );
}
