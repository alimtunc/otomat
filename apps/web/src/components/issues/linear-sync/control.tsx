import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  RelativeTime,
} from "@otomat/ui";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { describeLinearSync } from "@web/components/issues/linear-sync/describe";

/** Reports the pass wherever it was started, so a second click cannot launch a second import. */
export function LinearSyncControl({ sync }: { sync: ProjectLinearSync }) {
  const label = describeLinearSync(sync.status, sync.running);
  const mapped = (sync.status?.sources ?? 0) > 0;
  const tone = label.tone === "danger" ? "text-danger" : "text-text-tertiary";

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {label.text === "" ? null : (
        <span
          role={label.tone === "danger" ? "alert" : undefined}
          className={`truncate text-xs ${tone}`}
        >
          {label.text}
          {label.syncedAt === null ? null : (
            <>
              {" · "}
              <RelativeTime date={label.syncedAt} className="inline" />
            </>
          )}
        </span>
      )}
      <Button
        variant="outline"
        size="xs"
        loading={sync.running}
        disabled={!mapped}
        onClick={() => sync.refresh({ announce: true })}
      >
        <Icon name="refresh-cw" aria-hidden />
        Refresh issues
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              label="Linear sync options"
              size="sm"
              disabled={!mapped}
              icon={<Icon name="chevron-down" />}
            />
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={sync.running}
            onClick={() => sync.refresh({ full: true, announce: true })}
          >
            Full resync
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
