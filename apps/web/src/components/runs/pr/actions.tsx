import { Button } from "@otomat/ui";

export interface PullRequestActionsProps {
  primaryLabel: string;
  primaryDisabled: boolean;
  primaryLoading: boolean;
  /** Composes generation and publication in one action; null submits the fields as they stand. */
  onCompose: (() => void) | null;
  onGenerate: () => void;
  generateDisabled: boolean;
  isGenerating: boolean;
}

export function PullRequestActions({
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  onCompose,
  onGenerate,
  generateDisabled,
  isGenerating,
}: PullRequestActionsProps) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onGenerate}
        loading={isGenerating}
        disabled={generateDisabled}
      >
        Generate title &amp; description with AI
      </Button>
      <Button
        type={onCompose === null ? "submit" : "button"}
        variant="primary"
        size="sm"
        onClick={onCompose ?? undefined}
        disabled={primaryDisabled}
        loading={primaryLoading}
      >
        {primaryLabel}
      </Button>
    </div>
  );
}
