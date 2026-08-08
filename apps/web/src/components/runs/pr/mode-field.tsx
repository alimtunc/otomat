import type { PullRequestPublicationMode } from "@otomat/domain";
import { Field, FieldLabel, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { isPullRequestPublicationMode } from "@web/components/runs/pr/model";

export interface PullRequestModeFieldProps {
  value: PullRequestPublicationMode;
  disabled: boolean;
  onChange: (mode: PullRequestPublicationMode) => void;
}

/** The explicit Draft / Ready choice made at every publish; Otomat never guesses it, and never merges. */
export function PullRequestModeField({ value, disabled, onChange }: PullRequestModeFieldProps) {
  return (
    <Field hint="Ready opens the pull request for review. Otomat never merges it, and the repository's branch protections still apply.">
      <FieldLabel>Publication</FieldLabel>
      <SegmentedControl
        type="single"
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (isPullRequestPublicationMode(next)) onChange(next);
        }}
        aria-label="Publication mode"
      >
        <SegmentedItem value="draft">Draft</SegmentedItem>
        <SegmentedItem value="ready">Ready for review</SegmentedItem>
      </SegmentedControl>
    </Field>
  );
}
