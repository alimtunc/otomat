import { Dialog, DialogContent } from "@otomat/ui";
import {
  IssueCreationContent,
  type IssueCreationContentProps,
} from "@web/components/issues/issue-creation-content";

export interface NewIssueDialogProps extends IssueCreationContentProps {
  open: boolean;
}

export function NewIssueDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: NewIssueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label="New issue"
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
      >
        {open ? (
          <IssueCreationContent
            key={projectId}
            projectId={projectId}
            projectName={projectName}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
