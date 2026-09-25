import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogContentProps,
  type ProjectSummary,
} from "@otomat/ui";
import { useSelector } from "@tanstack/react-store";
import { arrangeProjects, withLayoutIcons } from "@web/components/shell/project-layout/arrange";
import { placedBefore } from "@web/components/shell/project-layout/layout";
import { NewGroupForm } from "@web/components/shell/project-layout/new-group-form";
import { OrganizeSection } from "@web/components/shell/project-layout/organize-section";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";

export interface OrganizeProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus?: DialogContentProps["finalFocus"];
  projects: ProjectSummary[];
}

export function OrganizeProjectsDialog({
  open,
  onOpenChange,
  finalFocus,
  projects,
}: OrganizeProjectsDialogProps) {
  const layout = useSelector(projectLayoutStore);
  const sections = arrangeProjects(layout, withLayoutIcons(layout, projects));
  const moveToGroup = (key: string, groupId: string | null): void => {
    const target = sections.find((section) => (section.group?.id ?? null) === groupId);
    if (target === undefined) return;
    const keys = target.items.map((project) => project.id);
    projectLayoutStore.actions.orderSection(groupId, placedBefore(keys, key, null));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Organize projects" finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Organize projects</DialogTitle>
          <DialogDescription>
            Order and group projects in the switcher and the tab bar. Only this app&apos;s
            navigation changes: projects, hosts and runs stay as they are.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto">
          <NewGroupForm onCreate={projectLayoutStore.actions.addGroup} />
          {sections.map((section) => (
            <OrganizeSection
              key={section.group?.id ?? "ungrouped"}
              section={section}
              groups={layout.groups}
              onGroupChange={moveToGroup}
            />
          ))}
        </DialogBody>
        <DialogFooter>
          <Button size="sm" type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
