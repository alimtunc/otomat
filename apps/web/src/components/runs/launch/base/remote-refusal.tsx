import type { BaseRefusal, RemoteBaseFailure } from "@otomat/domain";
import { Button, CopyButton } from "@otomat/ui";

export interface BaseRemoteRefusalProps {
  refusal: BaseRefusal;
  onRetry: () => void;
}

const TITLES = {
  unreachable: "The remote could not be reached",
  access_denied: "The remote refused access",
  not_found: "The remote or its branch was not found",
  no_upstream: "The base branch has no usable upstream",
  unclassified: "Git could not read the remote",
} satisfies Record<RemoteBaseFailure, string>;

export function BaseRemoteRefusal({
  refusal: { message, remote },
  onRetry,
}: BaseRemoteRefusalProps) {
  const diagnostic =
    remote.detail === null
      ? null
      : `base_remote_unavailable (${remote.failure}): ${message}\n\n${remote.detail}`;

  return (
    <div
      role="alert"
      className="flex flex-col gap-1.5 rounded-md border border-danger/40 bg-danger-bg p-2.5 text-xs"
    >
      <p className="font-medium text-danger">{TITLES[remote.failure]}</p>
      <p className="text-text-secondary">{message}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          Retry
        </Button>
        {diagnostic === null ? null : (
          <CopyButton
            value={diagnostic}
            label="Copy diagnostic"
            copiedLabel="Diagnostic copied"
            showLabel
          />
        )}
      </div>
    </div>
  );
}
