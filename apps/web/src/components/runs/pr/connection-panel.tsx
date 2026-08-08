import { Button } from "@otomat/ui";
import type { PullRequestViewModel } from "@web/components/runs/pr/model";

export interface PullRequestConnectionPanelProps {
  model: PullRequestViewModel;
  onConnect: () => void;
  isConnecting: boolean;
}

/** GitHub's own answer about this run: the signed-in account, any device code, the last failure, and the PR link. */
export function PullRequestConnectionPanel({
  model,
  onConnect,
  isConnecting,
}: PullRequestConnectionPanelProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{model.connectionLabel}</p>
        {model.deviceAuthorization ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Enter code{" "}
            <code className="font-mono font-semibold text-foreground">
              {model.deviceAuthorization.code}
            </code>{" "}
            at{" "}
            <a
              className="underline"
              href={model.deviceAuthorization.url}
              target="_blank"
              rel="noreferrer"
            >
              {model.deviceAuthorization.url}
            </a>
          </p>
        ) : null}
        {model.errorMessage ? (
          <p className="mt-1 text-xs text-danger">{model.errorMessage}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {model.linkUrl && model.linkLabel ? (
          <Button
            render={
              <a href={model.linkUrl} target="_blank" rel="noreferrer">
                {model.linkLabel}
              </a>
            }
            variant="outline"
            size="sm"
          />
        ) : null}
        {model.showConnect ? (
          <Button type="button" size="sm" onClick={onConnect} loading={isConnecting}>
            Connect GitHub
          </Button>
        ) : null}
      </div>
    </div>
  );
}
