import { Button as BaseButton } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { injectStyleOnce } from "../lib/inject-style";
import { injectSpinKeyframes } from "../lib/spin";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button-variants";

const BTN_LOADING_STYLE_ID = "otomat-btn-loading";
const BTN_LOADING_CSS = `
.otomat-btn-loading{color:transparent!important}
.otomat-btn-loading::after{content:"";position:absolute;inset:0;margin:auto;width:14px;height:14px;border-radius:50%;border:2px solid var(--border-strong);border-top-color:var(--iris-solid);animation:otomat-spin .7s linear infinite}
@media (prefers-reduced-motion:reduce){.otomat-btn-loading::after{animation:none}}
`;

export interface ButtonProps
  extends
    Omit<ComponentPropsWithoutRef<typeof BaseButton>, "className" | "color">,
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
  injectSpinKeyframes();
  injectStyleOnce(BTN_LOADING_STYLE_ID, BTN_LOADING_CSS);
  return (
    <BaseButton
      render={render}
      data-slot="button"
      type={render ? type : (type ?? "button")}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        buttonVariants({ variant, size, density }),
        loading && "otomat-btn-loading",
        className,
      )}
      style={{
        transition:
          "background var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease)",
        ...style,
      }}
      {...props}
    >
      {children}
    </BaseButton>
  );
}
