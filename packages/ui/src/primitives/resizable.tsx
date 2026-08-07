import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";

import { FOCUS_RING } from "../lib/focus";
import { cn } from "../lib/utils";

// Apple's accessibility guidance for hit targets, applied to the drag region the
// library maintains around the 1px separator.
const RESIZE_TARGET_MINIMUM_SIZE = { coarse: 28, fine: 12 };

export function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      data-slot="resizable-panel-group"
      resizeTargetMinimumSize={RESIZE_TARGET_MINIMUM_SIZE}
      className={cn("flex h-full w-full min-h-0 min-w-0", className)}
      {...props}
    />
  );
}

export function ResizablePanel({ className, ...props }: PanelProps) {
  return (
    <Panel
      data-slot="resizable-panel"
      className={cn("flex min-h-0 min-w-0 flex-col", className)}
      {...props}
    />
  );
}

export function ResizableHandle({ className, ...props }: SeparatorProps) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border-subtle",
        "data-[separator=hover]:bg-iris-ring data-[separator=active]:bg-iris-ring",
        "data-[separator=focus]:bg-iris-ring data-[separator=disabled]:bg-border-subtle",
        "aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full",
        "[&[aria-orientation=horizontal]>div]:rotate-90",
        FOCUS_RING,
        "focus-visible:outline-offset-0",
        className,
      )}
      style={{ transition: "background-color var(--motion-fast) var(--ease)" }}
      {...props}
    >
      <div className="z-10 flex h-4.5 w-2.5 flex-none items-center justify-center rounded-xs border border-border-subtle bg-surface-1 text-text-tertiary">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    </Separator>
  );
}

// Re-exported so this module stays the only importer of the panel library.
export {
  useDefaultLayout,
  usePanelRef,
  type Layout,
  type LayoutChangedMeta,
} from "react-resizable-panels";
