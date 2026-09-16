import type { CheckoutTarget, CreateWorktreeEntryRequest } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { invalidateCheckout } from "@web/api/files/invalidate";
import { useQueryKeys } from "@web/api/use-query-keys";

export interface FilesActionsProps {
  target: CheckoutTarget;
  editable: boolean;
  onCreate: (kind: CreateWorktreeEntryRequest["kind"], opener: HTMLButtonElement) => void;
}

export function FilesActions({ target, editable, onCreate }: FilesActionsProps) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  const refreshing = useIsFetching({ queryKey: keys.checkoutFiles(target), exact: true }) > 0;
  return (
    <>
      <IconButton
        label="New file"
        icon={<Icon name="file-plus" aria-hidden />}
        disabled={!editable}
        onClick={(event) => onCreate("file", event.currentTarget)}
      />
      <IconButton
        label="New folder"
        icon={<Icon name="folder-plus" aria-hidden />}
        disabled={!editable}
        onClick={(event) => onCreate("directory", event.currentTarget)}
      />
      <IconButton
        label="Refresh files"
        icon={<Icon name="refresh-cw" aria-hidden />}
        loading={refreshing}
        onClick={() => invalidateCheckout(client, keys, target)}
      />
    </>
  );
}
