import { isDesktopUpdateInstallable } from "@otomat/domain";
import { Button, Markdown, RelativeTime } from "@otomat/ui";
import { useDesktopUpdate } from "@web/components/shell/use-desktop-update";
import { desktopUpdateHeadline } from "@web/lib/desktop-update";

export function UpdateSection() {
  const update = useDesktopUpdate();
  const snapshot = update.snapshot;
  if (snapshot === null) return null;

  const { release, state } = snapshot;
  const installable = isDesktopUpdateInstallable(state);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">Updates</h3>
        <span className="text-micro text-text-tertiary">
          {snapshot.feed} channel · {snapshot.current_version}
        </span>
      </div>

      <p role="status" className="text-xs text-text-secondary">
        {desktopUpdateHeadline(snapshot)}
      </p>
      {snapshot.detail === null ? null : (
        <p
          role={state === "failed" ? "alert" : undefined}
          className={state === "failed" ? "text-xs text-danger" : "text-xs text-text-tertiary"}
        >
          {snapshot.detail}
        </p>
      )}
      {update.error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {update.error}
        </p>
      )}

      {release !== null && release.notes.length > 0 ? (
        <div className="max-h-60 overflow-auto rounded-md bg-surface-2 p-3">
          <Markdown value={release.notes} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {snapshot.manual_url === null ? (
          <Button
            variant="outline"
            size="sm"
            loading={update.checking}
            disabled={
              update.checking ||
              update.installing ||
              state === "checking" ||
              state === "downloading"
            }
            onClick={update.check}
          >
            Check for updates
          </Button>
        ) : (
          <a
            href={snapshot.manual_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-iris-text underline"
          >
            Download the latest release
          </a>
        )}
        {installable ? (
          <Button
            size="sm"
            loading={update.installing}
            disabled={update.checking || update.installing}
            onClick={update.install}
          >
            Install and restart
          </Button>
        ) : null}
        {snapshot.checked_at === null ? null : (
          <span className="text-micro text-text-tertiary">
            Last checked <RelativeTime date={snapshot.checked_at} />
          </span>
        )}
      </div>
    </section>
  );
}
