import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  RelativeTime,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import {
  describeLinearSync,
  linearSourcesMapped,
} from "@web/components/issues/linear-sync/describe";

const REFRESH = "Refresh issues";

export function LinearSyncControl({ sync }: { sync: ProjectLinearSync }) {
  const label = describeLinearSync(sync.status, sync.running);
  const mapped = linearSourcesMapped(sync.status);
  const report =
    label.text === "" ? null : (
      <>
        {label.text}
        {label.syncedAt === null ? null : (
          <>
            {" · "}
            <RelativeTime date={label.syncedAt} className="inline" />
          </>
        )}
      </>
    );

  return (
    <div className="flex items-center gap-1">
      {label.tone === "danger" ? (
        <span role="alert" className="sr-only">
          {label.text}
        </span>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            // A tooltip names nothing, so the report is repeated on the accessible name.
            <Button
              variant="outline"
              size="xs"
              loading={sync.running}
              disabled={!mapped}
              aria-label={label.text === "" ? REFRESH : `${REFRESH} — ${label.text}`}
              onClick={() => sync.refresh({ announce: true })}
            >
              <Icon
                name="refresh-cw"
                aria-hidden
                className={label.tone === "danger" ? "text-danger" : undefined}
              />
            </Button>
          }
        />
        <TooltipContent className="max-w-64 whitespace-normal">
          {report === null ? REFRESH : report}
        </TooltipContent>
      </Tooltip>
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
