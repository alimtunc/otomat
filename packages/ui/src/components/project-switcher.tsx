import { ArrowUpDown, Check, ChevronsUpDown, FolderGit2, Pin, Plus } from "lucide-react";
import { useState, type Ref } from "react";

import { FOCUS_RING_INSET } from "../lib/focus";
import type { ProjectSection, ProjectSummary } from "../lib/project-summary";
import { TONE_FACETS } from "../lib/tone";
import { cn } from "../lib/utils";
import { Button, type ButtonProps } from "../primitives/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from "../primitives/combobox";
import { HostTag } from "./host-tag";
import { IconButton } from "./icon-button";
import { ProjectGlyph } from "./project-glyph";

const HEALTH_COLOR = {
  healthy: TONE_FACETS.success.cssVar,
  degraded: TONE_FACETS.warning.cssVar,
  unknown: TONE_FACETS.neutral.cssVar,
} satisfies Record<NonNullable<ProjectSummary["health"]>, string>;

function ProjectSwitcherAction({ className, ...props }: ButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-full justify-start gap-2 px-2.5 py-2 text-sm [&>svg]:size-4 [&>svg]:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

export interface ProjectSwitcherProps {
  sections: ProjectSection[];
  triggerRef?: Ref<HTMLButtonElement>;
  currentId?: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  loading?: boolean;
  /** Renders an "Add project…" footer action; also replaces the empty-state hint when provided. */
  onAddProject?: () => void;
  /** Renders a per-project "open in a tab" action; selection alone never creates a tab. */
  onOpenTab?: (id: string) => void;
  onOrganize: () => void;
}

export function ProjectSwitcher({
  sections,
  triggerRef,
  currentId,
  onSelect,
  collapsed = false,
  loading = false,
  onAddProject,
  onOpenTab,
  onOrganize,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const projects = sections.flatMap((section) => section.items);
  const closeThen = (action: () => void): void => {
    setOpen(false);
    action();
  };
  const current = projects.find((p) => p.id === currentId);
  const empty = !loading && projects.length === 0;

  return (
    <Combobox
      items={sections}
      value={current ?? null}
      open={open}
      onOpenChange={setOpen}
      itemToStringLabel={(project) => `${project.name} ${project.repo ?? ""}`}
      isItemEqualToValue={(project, value) => project.id === value.id}
      onValueChange={(project) => {
        if (project === null) return;
        onSelect(project.id);
        setOpen(false);
      }}
    >
      <ComboboxTrigger
        ref={triggerRef}
        disabled={loading}
        aria-label="Switch project"
        render={
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-12 w-full justify-start gap-2.25 rounded-none border-0 px-3 text-left hover:bg-hover",
              FOCUS_RING_INSET,
              "disabled:cursor-not-allowed disabled:opacity-60",
              collapsed && "justify-center px-0",
            )}
            style={{ transition: "background var(--motion-fast) var(--ease)" }}
          >
            {current ? (
              <ProjectGlyph name={current.name} icon={current.icon} />
            ) : (
              <FolderGit2 className="h-6 w-6 text-text-tertiary" />
            )}
            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span className="truncate">
                      {loading ? "Loading…" : (current?.name ?? "No project")}
                    </span>
                  </div>
                  {current?.repo || current?.branch ? (
                    <div className="truncate text-micro text-text-tertiary">
                      {[current?.repo, current?.branch].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 flex-none text-text-tertiary" />
              </>
            ) : null}
          </Button>
        }
      />
      <ComboboxContent align="start" className="w-65" aria-label="Select project">
        <ComboboxInput placeholder="Find project…" aria-label="Find project" />
        {empty ? (
          <ComboboxEmpty className="p-1.5">
            {onAddProject ? (
              <ProjectSwitcherAction className="py-3" onClick={() => closeThen(onAddProject)}>
                <Plus />
                Add project…
              </ProjectSwitcherAction>
            ) : (
              <span className="block px-2.5 py-3 text-sm text-text-tertiary">
                Add a project in Settings
              </span>
            )}
          </ComboboxEmpty>
        ) : (
          <>
            <ComboboxEmpty>No projects found.</ComboboxEmpty>
            <ComboboxList>
              {(section: ProjectSection) => (
                <ComboboxGroup key={section.id} items={section.items}>
                  {section.label === undefined ? null : (
                    <ComboboxGroupLabel>{section.label}</ComboboxGroupLabel>
                  )}
                  <ComboboxCollection>
                    {(project: ProjectSummary) => (
                      <ComboboxItem key={project.id} value={project}>
                        <ProjectGlyph name={project.name} icon={project.icon} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm text-foreground">{project.name}</span>
                            {project.tag ? <HostTag tag={project.tag} /> : null}
                          </div>
                          {project.repo ? (
                            <div className="truncate text-micro text-text-tertiary">
                              {project.repo}
                            </div>
                          ) : null}
                        </div>
                        {project.health ? (
                          <span
                            aria-hidden
                            className="inline-block h-1.75 w-1.75 flex-none rounded-full"
                            style={{ background: HEALTH_COLOR[project.health] }}
                          />
                        ) : null}
                        {onOpenTab ? (
                          <IconButton
                            size="sm"
                            label={`Open ${project.name} in a tab`}
                            icon={<Pin aria-hidden />}
                            onClick={(event) => {
                              event.stopPropagation();
                              closeThen(() => onOpenTab(project.id));
                            }}
                          />
                        ) : null}
                        <ComboboxItemIndicator>
                          <Check className="h-4 w-4 flex-none text-iris-text" />
                        </ComboboxItemIndicator>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
            <div className="flex flex-col gap-px border-t border-border-subtle p-1.5">
              {onAddProject ? (
                <ProjectSwitcherAction onClick={() => closeThen(onAddProject)}>
                  <Plus />
                  Add project…
                </ProjectSwitcherAction>
              ) : null}
              <ProjectSwitcherAction onClick={() => closeThen(onOrganize)}>
                <ArrowUpDown />
                Organize projects…
              </ProjectSwitcherAction>
            </div>
          </>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
