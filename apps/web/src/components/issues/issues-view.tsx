import { useIssues } from "@web/api/issues/queries";
import { IssuesList } from "@web/components/issues/issues-list";
import { StartRunDialog } from "@web/components/runs/start-run-dialog";
import { RouteShell } from "@web/components/shell/route-shell";

export function IssuesView() {
  const issues = useIssues();
  return (
    <RouteShell
      active="issues"
      breadcrumbs={[{ label: "Issues", current: true }]}
      actions={<StartRunDialog />}
    >
      <IssuesList query={issues} />
    </RouteShell>
  );
}
