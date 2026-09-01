import { Check, ChevronsUpDown, FolderGit2, Pin, Plus } from "lucide-react";
import { useState } from "react";

import { FOCUS_RING } from "../lib/focus";
import type { ProjectSummary } from "../lib/project-summary";
import { TONE_FACETS } from "../lib/tone";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
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

export interface ProjectSwitcherProps {
  projects: ProjectSummary[];
  currentId?: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  loading?: boolean;
  /** Renders an "Add project…" footer action; also replaces the empty-state hint when provided. */
  onAddProject?: () => void;
  /** Renders a per-project "open in a tab" action; selection alone never creates a tab. */
  onOpenTab?: (id: string) => void;
}

export function ProjectSwitcher({
  projects,
  currentId,
  onSelect,
  collapsed = false,
  loading = false,
  onAddProject,
  onOpenTab,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.id === currentId);
  const empty = !loading && projects.length === 0;

  return (
    <Combobox
      items={projects}
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
        disabled={loading}
        aria-label="Switch project"
        render={
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-12 w-full justify-start gap-2.25 rounded-none border-0 px-3 text-left hover:bg-hover",
              FOCUS_RING,
              "focus-visible:outline-offset-[-2px]",
              "disabled:cursor-not-allowed disabled:opacity-60",
              collapsed && "justify-center px-0",
            )}
            style={{ transition: "background var(--motion-fast) var(--ease)" }}
          >
            {current ? (
              <ProjectGlyph name={current.name} />
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
                    {current?.tag ? <HostTag tag={current.tag} /> : null}
                    {current?.health ? (
                      <output
                        aria-label={`repo ${current.health}`}
                        className="inline-block h-1.75 w-1.75 flex-none rounded-full"
                        style={{ background: HEALTH_COLOR[current.health] }}
                      />
                    ) : null}
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  onAddProject();
                }}
                className="h-auto w-full justify-start gap-2 px-2.5 py-3 text-sm"
              >
                <Plus className="h-4 w-4 text-text-tertiary" />
                Add project…
              </Button>
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
              {(project: ProjectSummary) => (
                <ComboboxItem key={project.id} value={project}>
                  <ProjectGlyph name={project.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-foreground">{project.name}</span>
                      {project.tag ? <HostTag tag={project.tag} /> : null}
                    </div>
                    {project.repo ? (
                      <div className="truncate text-micro text-text-tertiary">{project.repo}</div>
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
                        setOpen(false);
                        onOpenTab(project.id);
                      }}
                    />
                  ) : null}
                  <ComboboxItemIndicator>
                    <Check className="h-4 w-4 flex-none text-iris-text" />
                  </ComboboxItemIndicator>
                </ComboboxItem>
              )}
            </ComboboxList>
            {onAddProject ? (
              <div className="border-t border-border-subtle p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    onAddProject();
                  }}
                  className="h-auto w-full justify-start gap-2 px-2.5 py-2 text-sm"
                >
                  <Plus className="h-4 w-4 text-text-tertiary" />
                  Add project…
                </Button>
              </div>
            ) : null}
          </>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
