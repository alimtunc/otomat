import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { MODAL_POPUP_BASE, MODAL_STYLE, OVERLAY_CLASS, OVERLAY_STYLE } from "../lib/styles";
import { cn } from "../lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
export const AlertDialogAction = AlertDialogPrimitive.Close;
export const AlertDialogCancel = AlertDialogPrimitive.Close;

export interface AlertDialogOverlayProps extends ComponentPropsWithRef<
  typeof AlertDialogPrimitive.Backdrop
> {}

export function AlertDialogOverlay({ className, style, ref, ...props }: AlertDialogOverlayProps) {
  return (
    <AlertDialogPrimitive.Backdrop
      ref={ref}
      className={cn(OVERLAY_CLASS, className)}
      style={{ ...OVERLAY_STYLE, ...style }}
      {...props}
    />
  );
}

export interface AlertDialogContentProps extends ComponentPropsWithRef<
  typeof AlertDialogPrimitive.Popup
> {}

export function AlertDialogContent({ className, style, ref, ...props }: AlertDialogContentProps) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        ref={ref}
        className={cn("w-[min(480px,94vw)]", MODAL_POPUP_BASE, className)}
        style={{ ...MODAL_STYLE, ...style }}
        {...props}
      />
    </AlertDialogPortal>
  );
}

export interface AlertDialogSectionProps {
  className?: string;
  children?: ReactNode;
}

export function AlertDialogHeader({ className, children }: AlertDialogSectionProps) {
  return <div className={cn("flex flex-col gap-1.5 px-4 pb-2 pt-3.5", className)}>{children}</div>;
}

export function AlertDialogBody({ className, children }: AlertDialogSectionProps) {
  return <div className={cn("px-4 pb-3.5 pt-0", className)}>{children}</div>;
}

export function AlertDialogFooter({ className, children }: AlertDialogSectionProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2.5 border-t border-border-subtle px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface AlertDialogTitleProps extends ComponentPropsWithRef<
  typeof AlertDialogPrimitive.Title
> {}

export function AlertDialogTitle({ className, ref, ...props }: AlertDialogTitleProps) {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export interface AlertDialogDescriptionProps extends ComponentPropsWithRef<
  typeof AlertDialogPrimitive.Description
> {}

export function AlertDialogDescription({ className, ref, ...props }: AlertDialogDescriptionProps) {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={cn("text-sm leading-relaxed text-text-secondary", className)}
      {...props}
    />
  );
}
