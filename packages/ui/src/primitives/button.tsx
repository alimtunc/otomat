import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { injectStyleOnce } from "../lib/inject-style";
import { cn } from "../lib/utils";

const SPIN_STYLE_ID = "otomat-spin";
const SPIN_CSS = `
@keyframes otomat-spin{to{transform:rotate(360deg)}}
.otomat-btn-loading{color:transparent!important}
.otomat-btn-loading::after{content:"";position:absolute;inset:0;margin:auto;width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:otomat-spin .7s linear infinite}
@media (prefers-reduced-motion:reduce){.otomat-btn-loading::after{animation:none}}
`;

const buttonVariants = cva(
  cn(
    "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md border font-sans font-medium",
    "disabled:opacity-45 disabled:pointer-events-none",
    "active:translate-y-[0.5px]",
    "[&>svg]:size-3.5 [&>svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default:
          "bg-surface-2 border-border text-foreground hover:bg-surface-3 hover:border-border-strong",
        primary:
          "border-transparent text-on-accent bg-iris hover:bg-iris-hover active:bg-iris-active shadow-[var(--shadow-button)]",
        light: "border-transparent bg-button-light text-button-light-fg hover:bg-on-accent",
        ghost:
          "border-transparent bg-transparent text-text-secondary hover:bg-hover hover:text-foreground",
        outline:
          "bg-transparent border-border text-foreground hover:bg-surface-3 hover:border-border-strong",
        destructive:
          "bg-transparent border-border text-danger hover:bg-danger-bg hover:border-danger",
      },
      size: {
        default: "h-7.5 px-2.75 text-sm",
        sm: "h-6.5 px-2.25 text-sm",
        xs: "h-5.5 px-1.75 text-xs gap-1 [&>svg]:size-3",
      },
      density: {
        compact: "",
        comfortable: "",
      },
    },
    compoundVariants: [
      { density: "comfortable", size: "default", className: "h-8" },
      { density: "comfortable", size: "sm", className: "h-7" },
      { density: "comfortable", size: "xs", className: "h-6" },
    ],
    defaultVariants: { variant: "default", size: "default", density: "compact" },
  },
);

export interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "color">, VariantProps<typeof buttonVariants> {
  render?: ReactElement;
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
  children,
  ...props
}: ButtonProps) {
  injectStyleOnce(SPIN_STYLE_ID, SPIN_CSS);
  const element = useRender({
    render: render ?? <button type="button" />,
    props: {
      "data-slot": "button",
      "data-loading": loading || undefined,
      "aria-busy": loading || undefined,
      disabled: disabled || loading,
      className: cn(
        buttonVariants({ variant, size, density }),
        loading && "otomat-btn-loading",
        className,
      ),
      style: {
        transition:
          "background var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease)",
        ...style,
      },
      children,
      ...props,
    },
  });
  return element;
}
