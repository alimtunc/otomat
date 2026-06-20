import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { type VariantProps, cva } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import {
  MODAL_CLOSE_CLASS,
  MODAL_CLOSE_STYLE,
  MODAL_STYLE,
  OVERLAY_CLASS,
  OVERLAY_STYLE,
} from "../lib/styles";
import { cn } from "../lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetClose = DialogPrimitive.Close;

export interface SheetOverlayProps extends ComponentPropsWithRef<typeof DialogPrimitive.Backdrop> {}

export function SheetOverlay({ className, style, ref, ...props }: SheetOverlayProps) {
  return (
    <DialogPrimitive.Backdrop
      ref={ref}
      className={cn(OVERLAY_CLASS, className)}
      style={{ ...OVERLAY_STYLE, ...style }}
      {...props}
    />
  );
}

const sheetVariants = cva(
  cn(
    "fixed overflow-hidden border-border bg-popover opacity-0 shadow-(--shadow-modal)",
    "data-[open]:opacity-100 motion-reduce:transform-none data-[open]:transform-none",
  ),
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-[min(440px,94vw)] border-l transform-[translateX(8px)] rounded-l-xl",
        left: "inset-y-0 left-0 h-full w-[min(440px,94vw)] border-r transform-[translateX(-8px)] rounded-r-xl",
        top: "inset-x-0 top-0 w-full max-h-[90vh] border-b transform-[translateY(-8px)] rounded-b-xl",
        bottom:
          "inset-x-0 bottom-0 w-full max-h-[90vh] border-t transform-[translateY(8px)] rounded-t-xl",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface SheetContentProps
  extends ComponentPropsWithRef<typeof DialogPrimitive.Popup>, VariantProps<typeof sheetVariants> {
  showClose?: boolean;
}

export function SheetContent({
  className,
  children,
  side = "right",
  style,
  showClose = true,
  ref,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Popup
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        style={{ ...MODAL_STYLE, ...style }}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className={MODAL_CLOSE_CLASS}
            style={MODAL_CLOSE_STYLE}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </SheetPortal>
  );
}

export interface SheetSectionProps {
  className?: string;
  children?: ReactNode;
}

export function SheetHeader({ className, children }: SheetSectionProps) {
  return <div className={cn("flex items-center gap-2 px-4 py-3.5", className)}>{children}</div>;
}

export function SheetBody({ className, children }: SheetSectionProps) {
  return <div className={cn("overflow-auto px-4 pb-3.5 pt-0", className)}>{children}</div>;
}

export function SheetFooter({ className, children }: SheetSectionProps) {
  return (
    <div
      className={cn("flex items-center gap-2.5 border-t border-border-subtle px-4 py-3", className)}
    >
      {children}
    </div>
  );
}

export interface SheetTitleProps extends ComponentPropsWithRef<typeof DialogPrimitive.Title> {}

export function SheetTitle({ className, ref, ...props }: SheetTitleProps) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export interface SheetDescriptionProps extends ComponentPropsWithRef<
  typeof DialogPrimitive.Description
> {}

export function SheetDescription({ className, ref, ...props }: SheetDescriptionProps) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-text-secondary", className)}
      {...props}
    />
  );
}
