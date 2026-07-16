import { Button, Icon } from "@otomat/ui";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { useState } from "react";

export function NewIssueButton({ projectName }: { projectName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Icon name="plus" aria-hidden />
        New issue
      </Button>
      <NewIssueDialog open={open} onOpenChange={setOpen} projectName={projectName} />
    </>
  );
}
