import { Button, Chip } from "@otomat/ui";

export interface UnsavedViewActionsProps {
  savable: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onReset: () => void;
}

export function UnsavedViewActions({
  savable,
  onSave,
  onSaveAs,
  onReset,
}: UnsavedViewActionsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Chip tone="warning">Unsaved</Chip>
      {savable ? (
        <Button variant="ghost" size="sm" onClick={onSave}>
          Save changes
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" onClick={onSaveAs}>
        Save as view
      </Button>
      <Button variant="ghost" size="sm" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}
