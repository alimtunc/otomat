import type { CreateWorktreeEntryRequest } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";

export interface FilesActionsProps {
  editable: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onCreate: (kind: CreateWorktreeEntryRequest["kind"]) => void;
}

export function FilesActions({ editable, refreshing, onRefresh, onCreate }: FilesActionsProps) {
  return (
    <>
      <IconButton
        label="New file"
        icon={<Icon name="file-plus" aria-hidden />}
        disabled={!editable}
        onClick={() => onCreate("file")}
      />
      <IconButton
        label="New folder"
        icon={<Icon name="folder-plus" aria-hidden />}
        disabled={!editable}
        onClick={() => onCreate("directory")}
      />
      <IconButton
        label="Refresh files"
        icon={<Icon name="refresh-cw" aria-hidden />}
        loading={refreshing}
        onClick={onRefresh}
      />
    </>
  );
}
