import { Check, ChevronsUpDown, FolderGit2, Settings } from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";

export interface ProjectSummary {
  id: string;
  name: string;
  repo?: string;
  branch?: string;
  health?: "healthy" | "degraded" | "unknown";
}

const HEALTH_COLOR: Record<NonNullable<ProjectSummary["health"]>, string> = {
  healthy: "var(--success)",
  degraded: "var(--warning)",
  unknown: "var(--neutral)",
};

export interface ProjectSwitcherProps {
  projects: ProjectSummary[];
  currentId?: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  loading?: boolean;
  onConfigure?: () => void;
}

function ProjectGlyph({ name }: { name: string }) {
  return (
    <div
      className="grid h-6 w-6 flex-none place-items-center rounded-md text-[13px] font-bold text-on-accent"
      style={{ background: "linear-gradient(160deg,var(--iris-hover),var(--iris-active))" }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ProjectSwitcher({
  projects,
  currentId,
  onSelect,
  collapsed = false,
  loading = false,
  onConfigure,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.id === currentId);
  const empty = !loading && projects.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Switch project"
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={loading}
            className={cn(
              "flex h-12 items-center gap-2.25 px-3 text-left hover:bg-hover",
              "focus-visible:outline-none focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:outline-offset-[-2px]",
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
          </button>
        }
      />
      <PopoverContent align="start" className="w-65 p-0">
        {empty ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onConfigure?.();
            }}
            className="flex w-full items-center gap-2 px-2.5 py-3 text-sm text-text-secondary hover:bg-hover hover:text-foreground"
          >
            <Settings className="h-4 w-4 text-text-tertiary" />
            Add a project in Settings
          </button>
        ) : (
          <Command>
            <CommandInput placeholder="Find project…" />
            <CommandList>
              <CommandEmpty>No projects found.</CommandEmpty>
              <CommandGroup>
                {projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.repo ?? ""}`}
                    onSelect={() => {
                      onSelect(p.id);
                      setOpen(false);
                    }}
                  >
                    <ProjectGlyph name={p.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{p.name}</div>
                      {p.repo ? (
                        <div className="truncate text-micro text-text-tertiary">{p.repo}</div>
                      ) : null}
                    </div>
                    {p.health ? (
                      <span
                        aria-hidden
                        className="inline-block h-1.75 w-1.75 flex-none rounded-full"
                        style={{ background: HEALTH_COLOR[p.health] }}
                      />
                    ) : null}
                    {p.id === currentId ? (
                      <Check className="h-4 w-4 flex-none text-iris-text" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
