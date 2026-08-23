import { Button } from "@otomat/ui";
import { previewSession } from "@web/preview/session";

const REASON_LABEL = {
  unavailable: "no instance is routed for this pull request yet",
  starting: "its instance is starting",
} as const;

/** Fixed, never in the flow: a preview must not change the layout it is there to test. */
export function PreviewStatusBar() {
  const session = previewSession();
  if (session === null || session.state === "blocked") return null;
  const live = session.state === "live";
  const pullRequest = `PR #${String(session.manifest.pull_request)}`;
  return (
    <div
      role="status"
      className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 shadow-lg"
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${live ? "bg-success" : "animate-pulse bg-warning"}`}
      />
      <span className="text-xs text-text-secondary">
        {session.state === "live"
          ? `Full preview of ${pullRequest} · build ${session.manifest.build}`
          : `Sandbox fixtures for ${pullRequest} — ${REASON_LABEL[session.reason]}.`}
      </span>
      {live ? null : (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => globalThis.location.reload()}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
