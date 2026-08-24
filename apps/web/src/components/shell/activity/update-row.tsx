import { isDesktopUpdateInstallable, type DesktopUpdateSnapshot } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { desktopUpdateHeadline } from "@web/lib/desktop-update";

export interface ActivityUpdateRowProps {
  snapshot: DesktopUpdateSnapshot;
  installing: boolean;
  onInstall: () => void;
}

export function ActivityUpdateRow({ snapshot, installing, onInstall }: ActivityUpdateRowProps) {
  const installable = isDesktopUpdateInstallable(snapshot.state);

  return (
    <li className="flex items-start gap-2 px-2 py-1">
      <Icon name="download" aria-hidden className="mt-0.5 size-3.5 shrink-0 text-text-tertiary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-text-secondary">{desktopUpdateHeadline(snapshot)}</p>
        {snapshot.detail === null ? null : (
          <p
            className={
              snapshot.state === "failed"
                ? "mt-0.5 text-micro text-danger"
                : "mt-0.5 text-micro text-text-tertiary"
            }
          >
            {snapshot.detail}
          </p>
        )}
      </div>
      {installable ? (
        <Button type="button" variant="outline" size="xs" loading={installing} onClick={onInstall}>
          Install
        </Button>
      ) : null}
    </li>
  );
}
