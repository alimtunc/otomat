import type { ProjectSwitcherProps } from "@otomat/ui";
import { Sidebar } from "@web/components/shell/sidebar";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

describe("Sidebar", () => {
  it("passes the active id and reactive selection callback to the switcher", () => {
    const onProjectSelect = vi.fn();
    const shell = Sidebar({
      active: "issues",
      online: true,
      projects: [{ id: "local-default", name: "Local workspace" }],
      currentProjectId: "local-default",
      onProjectSelect,
    }) as ReactElement<{ projectSwitcher: ReactElement<ProjectSwitcherProps> }>;
    const switcher = shell.props.projectSwitcher;

    expect(switcher.props.currentId).toBe("local-default");
    switcher.props.onSelect("local-default");
    expect(onProjectSelect).toHaveBeenCalledWith("local-default");
  });
});
