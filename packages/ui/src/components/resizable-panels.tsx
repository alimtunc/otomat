import type { ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type GroupProps,
  type PanelImperativeHandle,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";

import { cn } from "../lib/utils";

const noopStorage: Pick<Storage, "getItem" | "setItem"> = {
  getItem: () => null,
  setItem: () => {},
};

function layoutStorage(): Pick<Storage, "getItem" | "setItem"> {
  return typeof window === "undefined" ? noopStorage : window.localStorage;
}

export interface ResizablePanelGroupProps extends Omit<
  GroupProps,
  "orientation" | "defaultLayout" | "onLayoutChanged"
> {
  direction?: "horizontal" | "vertical";
  autoSaveId?: string;
  className?: string;
  children: ReactNode;
}

export function ResizablePanelGroup({
  direction = "horizontal",
  autoSaveId,
  className,
  children,
  ...props
}: ResizablePanelGroupProps) {
  const persisted = useDefaultLayout({
    id: autoSaveId ?? "otomat.panels",
    storage: autoSaveId ? layoutStorage() : noopStorage,
  });
  return (
    <Group
      orientation={direction}
      defaultLayout={autoSaveId ? persisted.defaultLayout : undefined}
      onLayoutChanged={autoSaveId ? persisted.onLayoutChanged : undefined}
      className={cn("flex h-full w-full min-h-0 min-w-0", className)}
      {...props}
    >
      {children}
    </Group>
  );
}

export interface ResizablePanelProps extends PanelProps {
  className?: string;
  children: ReactNode;
}

export function ResizablePanel({ className, children, ...props }: ResizablePanelProps) {
  return (
    <Panel className={cn("flex min-h-0 min-w-0 flex-col", className)} {...props}>
      {children}
    </Panel>
  );
}

export interface ResizableHandleProps extends SeparatorProps {
  direction?: "horizontal" | "vertical";
  className?: string;
}

export function ResizableHandle({
  direction = "horizontal",
  className,
  ...props
}: ResizableHandleProps) {
  return (
    <Separator
      className={cn(
        "relative shrink-0 bg-border-subtle hover:bg-iris-ring",
        "data-[separator=active]:bg-iris-ring data-[separator=focus]:bg-iris-ring",
        "focus-visible:outline-none focus-visible:bg-iris-ring",
        direction === "horizontal" ? "w-px" : "h-px",
        className,
      )}
      style={{ transition: "background-color var(--motion-fast) var(--ease)" }}
      {...props}
    />
  );
}

export type { PanelImperativeHandle };
