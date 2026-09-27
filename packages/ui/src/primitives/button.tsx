import { Button as BaseButton } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button-variants";
import { Spinner } from "./spinner";

export interface ButtonProps
  extends
    Omit<ComponentPropsWithRef<typeof BaseButton>, "className" | "color">,
    VariantProps<typeof buttonVariants> {
  className?: string;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  density,
  render,
  loading = false,
  disabled,
  style,
  type,
  children,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      render={render}
      data-slot="button"
      type={render ? type : (type ?? "button")}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, density }), className)}
      style={{
        transition:
          "background var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease)",
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-flex w-full min-w-0 items-center gap-[inherit] opacity-0 [justify-content:inherit]">
            {children}
          </span>
          <Spinner aria-hidden="true" className="absolute" />
        </>
      ) : (
        children
      )}
    </BaseButton>
  );
}
