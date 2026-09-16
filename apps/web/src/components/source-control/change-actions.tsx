import type { SourceControlAction } from "@otomat/domain";
import { Button, Icon, IconButton } from "@otomat/ui";

export interface ChangeActionsProps {
  staged: boolean;
  pending: boolean;
  /** What the labels name: "file", "block", "selection", "all" or a path. */
  subject: string;
  compact?: boolean;
  onAction: (action: SourceControlAction) => void;
}

/** Stage or unstage, plus discard for unstaged work only: the index is never thrown away from here. */
export function ChangeActions({ staged, pending, subject, compact, onAction }: ChangeActionsProps) {
  const move = staged ? "Unstage" : "Stage";
  if (compact)
    return (
      <>
        <IconButton
          label={`${move} ${subject}`}
          icon={<Icon name={staged ? "arrow-down" : "plus"} aria-hidden />}
          disabled={pending}
          onClick={() => onAction(staged ? "unstage" : "stage")}
        />
        {staged ? null : (
          <IconButton
            label={`Discard ${subject}`}
            icon={<Icon name="trash-2" aria-hidden />}
            disabled={pending}
            onClick={() => onAction("discard")}
          />
        )}
      </>
    );
  return (
    <>
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => onAction(staged ? "unstage" : "stage")}
      >
        {move} {subject}
      </Button>
      {staged ? null : (
        <Button size="xs" variant="ghost" disabled={pending} onClick={() => onAction("discard")}>
          Discard {subject}
        </Button>
      )}
    </>
  );
}
