import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "../lib/utils";
import {
  MODAL_CLOSE_CLASS,
  MODAL_CLOSE_STYLE,
  MODAL_DESCRIPTION_CLASS,
  MODAL_FOOTER_CLASS,
  MODAL_HEADER_CLASS,
  MODAL_POPUP_BASE,
  MODAL_STYLE,
  MODAL_TITLE_CLASS,
  OVERLAY_CLASS,
  OVERLAY_STYLE,
} from "./styles";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export interface DialogOverlayProps extends ComponentPropsWithRef<
  typeof DialogPrimitive.Backdrop
> {}

export function DialogOverlay({ className, style, ref, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Backdrop
      ref={ref}
      className={cn(OVERLAY_CLASS, className)}
      style={{ ...OVERLAY_STYLE, ...style }}
      {...props}
    />
  );
}

export interface DialogContentProps extends ComponentPropsWithRef<typeof DialogPrimitive.Popup> {
  showClose?: boolean;
}

export function DialogContent({
  className,
  children,
  style,
  showClose = true,
  ref,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={ref}
        className={cn("w-[min(640px,94vw)]", MODAL_POPUP_BASE, className)}
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
    </DialogPortal>
  );
}

export interface DialogSectionProps {
  className?: string;
  children?: ReactNode;
}

export function DialogHeader({ className, children }: DialogSectionProps) {
  return <div className={cn(MODAL_HEADER_CLASS, className)}>{children}</div>;
}

export function DialogBody({ className, children }: DialogSectionProps) {
  return <div className={cn("px-4 pb-3.5 pt-0", className)}>{children}</div>;
}

export function DialogFooter({ className, children }: DialogSectionProps) {
  return <div className={cn(MODAL_FOOTER_CLASS, className)}>{children}</div>;
}

export interface DialogTitleProps extends ComponentPropsWithRef<typeof DialogPrimitive.Title> {}

export function DialogTitle({ className, ref, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title ref={ref} className={cn(MODAL_TITLE_CLASS, className)} {...props} />
  );
}

export interface DialogDescriptionProps extends ComponentPropsWithRef<
  typeof DialogPrimitive.Description
> {}

export function DialogDescription({ className, ref, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(MODAL_DESCRIPTION_CLASS, className)}
      {...props}
    />
  );
}
