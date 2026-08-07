import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { useSidePanel } from "../lib/side-panel-context";
import { IconButton } from "./icon-button";

const ICON = {
  left: { open: PanelLeftClose, closed: PanelLeftOpen },
  right: { open: PanelRightClose, closed: PanelRightOpen },
} as const;

export interface SidePanelToggleProps {
  className?: string;
}

/** Collapses and expands the `SidePanel` it sits in; renders nothing outside one. */
export function SidePanelToggle({ className }: SidePanelToggleProps) {
  const panel = useSidePanel();
  if (panel === null) return null;

  const Icon = ICON[panel.side][panel.collapsed ? "closed" : "open"];
  return (
    <IconButton
      size="sm"
      className={className}
      label={`${panel.collapsed ? "Expand" : "Collapse"} ${panel.label}`}
      icon={<Icon />}
      aria-controls={panel.panelId}
      aria-expanded={!panel.collapsed}
      onClick={panel.toggle}
    />
  );
}
