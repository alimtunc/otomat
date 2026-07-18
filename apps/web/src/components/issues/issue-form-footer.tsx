import { Button, DialogFooter } from "@otomat/ui";
import type { ReactNode } from "react";

export interface IssueFormFooterProps {
  onCancel: () => void;
  /** The primary submit control — differs per form (launch a run vs create an issue). */
  submit: ReactNode;
}

export function IssueFormFooter({ onCancel, submit }: IssueFormFooterProps) {
  return (
    <DialogFooter>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      {submit}
    </DialogFooter>
  );
}
