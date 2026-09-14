import { Button, DialogFooter } from "@otomat/ui";
import type { ReactNode } from "react";

export interface IssueFormFooterProps {
  onCancel: () => void;
  submit?: ReactNode;
}

export function IssueFormFooter({ onCancel, submit }: IssueFormFooterProps) {
  return (
    <DialogFooter className="mt-auto shrink-0">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      {submit}
    </DialogFooter>
  );
}
