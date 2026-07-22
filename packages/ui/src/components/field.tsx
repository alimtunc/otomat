import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { cn } from "../lib/utils";

export interface FieldProps extends Omit<
  ComponentPropsWithoutRef<typeof FieldPrimitive.Root>,
  "className"
> {
  className?: string;
  invalid?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
}

export function Field({ className, invalid = false, hint, error, children, ...props }: FieldProps) {
  return (
    <FieldPrimitive.Root
      invalid={invalid}
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    >
      {children}
      {hint != null && error == null ? (
        <FieldPrimitive.Description className="text-xs text-text-tertiary">
          {hint}
        </FieldPrimitive.Description>
      ) : null}
      {error != null ? (
        <FieldPrimitive.Error match role="alert" className="text-xs text-danger">
          {error}
        </FieldPrimitive.Error>
      ) : null}
    </FieldPrimitive.Root>
  );
}

export interface FieldLabelProps extends ComponentPropsWithoutRef<typeof FieldPrimitive.Label> {}

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <FieldPrimitive.Label
      className={cn("text-xs font-medium text-text-secondary", className)}
      {...props}
    />
  );
}

export interface FieldControlProps {
  children: ReactElement;
}

export function FieldControl({ children }: FieldControlProps) {
  return <FieldPrimitive.Control render={children} />;
}
