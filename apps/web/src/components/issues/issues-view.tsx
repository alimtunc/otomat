import { useIssues } from "@web/api/issues/queries";
import { IssuesList } from "@web/components/issues/issues-list";
import { NewIssueButton } from "@web/components/issues/new-issue-button";
import { RouteShell } from "@web/components/shell/route-shell";

export function IssuesView() {
  const issues = useIssues();
  return (
    <RouteShell
      active="issues"
      titleIcon="list-todo"
      breadcrumbs={[{ label: "Issues", current: true }]}
      actions={<NewIssueButton />}
    >
      <IssuesList query={issues} />
    </RouteShell>
  );
}
