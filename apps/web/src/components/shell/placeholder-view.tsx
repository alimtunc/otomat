import { Button, EmptyState, Icon, type IconName } from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";
import type { ShellSection } from "@web/components/shell/nav-items";
import { RouteShell } from "@web/components/shell/route-shell";

export function PlaceholderView({
  active,
  icon,
  label,
  titleNote,
  title,
  description,
  action,
}: {
  active: ShellSection;
  icon: IconName;
  label: string;
  titleNote?: string;
  title: string;
  description: string;
  action?: { label: string; disabledReason: string };
}) {
  return (
    <RouteShell
      active={active}
      titleIcon={icon}
      titleNote={titleNote}
      breadcrumbs={[{ label, current: true }]}
      actions={
        action ? (
          // The span carries the tooltip: the disabled button has pointer-events-none.
          <span title={action.disabledReason}>
            <Button variant="primary" size="sm" disabled>
              <Icon name="plus" aria-hidden />
              {action.label}
            </Button>
          </span>
        ) : undefined
      }
    >
      <CenteredState>
        <EmptyState icon={icon} title={title} description={description} />
      </CenteredState>
    </RouteShell>
  );
}
