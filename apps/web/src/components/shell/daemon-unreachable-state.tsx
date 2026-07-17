import { ErrorState } from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";

export function DaemonUnreachableState({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <CenteredState>
      <ErrorState
        title={title}
        description="The daemon is unreachable. Check that it is running, then retry."
        onRetry={onRetry}
      />
    </CenteredState>
  );
}
