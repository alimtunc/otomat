import type { RunContract } from "@otomat/domain";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Icon,
  IconButton,
  RelativeTime,
  RunStatusChip,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { ConversationSection } from "@web/components/issues/workspace/conversation-section";
import { shortId } from "@web/lib/ids";
import { useState } from "react";

function SectionHeader({ run, onSelect }: { run: RunContract; onSelect: () => void }) {
  return (
    <div className="flex items-center gap-1 pr-2 hover:bg-hover">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSelect}
        className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-4 py-2.5 text-left font-normal"
      >
        <Icon name="chevron-right" aria-hidden />
        <RunStatusChip status={run.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
          {run.branch}
        </span>
        <RelativeTime date={run.updated_at} className="text-xs" />
      </Button>
      <IconButton
        label={`Open run cockpit for ${shortId(run.id)}`}
        icon={<Icon name="monitor" aria-hidden />}
        nativeButton={false}
        role="link"
        render={<Link to="/runs/$runId" params={{ runId: run.id }} />}
      />
    </div>
  );
}

export function RunConversations({
  runs,
  followedRunId,
  onFollow,
  selectedStepId,
  onSelectStep,
}: {
  runs: RunContract[];
  followedRunId: string | null;
  onFollow: (runId: string) => void;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const followed = runs.find((run) => run.id === followedRunId);
  const previous = runs.filter((run) => run.id !== followedRunId);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <h2 className="text-sm font-semibold text-text-secondary">Conversations</h2>
      {followed ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border-subtle">
          <ConversationSection
            runId={followed.id}
            selectedStepId={selectedStepId}
            onSelectStep={onSelectStep}
          />
        </div>
      ) : null}
      {previous.length === 0 ? null : (
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger
            render={<Button variant="ghost" size="sm" className="shrink-0 self-start" />}
          >
            Other conversations · {previous.length}
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-72 w-96 max-w-[90vw] overflow-auto p-1">
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
              {previous.map((run) => (
                <li key={run.id}>
                  <SectionHeader
                    run={run}
                    onSelect={() => {
                      onFollow(run.id);
                      setHistoryOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
