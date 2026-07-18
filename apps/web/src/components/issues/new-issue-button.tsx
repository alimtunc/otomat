import { Button, Icon } from "@otomat/ui";
import { useNewIssue } from "@web/components/shell/new-issue-context";

export function NewIssueButton() {
  const openNewIssue = useNewIssue();
  return (
    <Button variant="primary" size="sm" onClick={openNewIssue}>
      <Icon name="plus" aria-hidden />
      New issue
    </Button>
  );
}
