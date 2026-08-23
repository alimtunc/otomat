import { ErrorState } from "@otomat/ui";
import type { PreviewBlockedCause } from "@web/preview/state";

export interface PreviewBlockedProps {
  cause: PreviewBlockedCause;
  expected: string | null;
}

const TITLE = {
  build_mismatch: "This preview and its daemon are on different commits",
  unreadable: "This preview could not read its own configuration",
} as const;

function description(cause: PreviewBlockedCause, expected: string | null): string {
  if (cause.kind === "unreadable") {
    return `${cause.detail}. Re-run the preview workflow for this pull request.`;
  }
  const serving = cause.daemonBuild ?? "an unnamed build";
  const built = expected ?? "an unnamed commit";
  return `This page was built from ${built}, and the pull request's instance is serving ${serving}. Re-run the preview workflow so both sides carry the same commit.`;
}

export function PreviewBlocked({ cause, expected }: PreviewBlockedProps) {
  return (
    <div className="grid h-dvh place-items-center bg-background p-6">
      <ErrorState
        title={TITLE[cause.kind]}
        description={description(cause, expected)}
        retryLabel="Reload"
        onRetry={() => globalThis.location.reload()}
      />
    </div>
  );
}
