import type { CSSProperties } from "react";

export const FIELD_TRANSITION =
  "border-color var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease)";

export const MENU_CONTENT_CLASS =
  "min-w-47.5 overflow-hidden rounded-lg border border-border bg-popover p-1.25 text-text-secondary shadow-[var(--shadow-overlay)]";

export const MENU_ITEM_CLASS =
  "relative flex h-7.5 cursor-pointer select-none items-center gap-2.25 rounded-md px-2 text-sm outline-none " +
  "transition-[background-color,color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease)] " +
  "focus:bg-hover focus:text-foreground data-[highlighted]:bg-hover data-[highlighted]:text-foreground " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "[&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0 [&_svg]:text-text-tertiary";

export const OVERLAY_CLASS = "fixed inset-0 backdrop-blur-[1px] opacity-0 data-[open]:opacity-100";

export const OVERLAY_STYLE: CSSProperties = {
  backgroundColor: "var(--overlay-strong)",
  zIndex: "var(--z-overlay)",
  transition: "opacity var(--motion-base) var(--ease)",
};

export const MODAL_POPUP_BASE =
  "fixed left-1/2 top-1/2 overflow-hidden border border-border bg-popover rounded-xl opacity-0 " +
  "shadow-(--shadow-modal) transform-[translate(-50%,-48%)_scale(.98)] data-[open]:opacity-100 " +
  "data-[open]:transform-[translate(-50%,-50%)_scale(1)]";

export const MODAL_STYLE: CSSProperties = {
  zIndex: "var(--z-modal)",
  transition:
    "opacity var(--motion-base) var(--ease), transform var(--motion-base) var(--ease-spring)",
};

export const MODAL_CLOSE_CLASS =
  "absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md " +
  "text-text-tertiary transition-colors hover:bg-hover hover:text-foreground";

export const MODAL_CLOSE_STYLE: CSSProperties = {
  transition: "background var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease)",
};
