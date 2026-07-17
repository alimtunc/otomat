import type { ComponentPropsWithoutRef } from "react";

import { injectStyleOnce } from "../lib/inject-style";
import { injectSpinKeyframes } from "../lib/spin";
import { cn } from "../lib/utils";

const SPINNER_STYLE_ID = "otomat-spinner";
const SPINNER_CSS = `
.otomat-spinner{border-radius:50%;border:2px solid var(--border-strong);border-top-color:var(--iris-solid);animation:otomat-spin .7s linear infinite}
@media (prefers-reduced-motion:reduce){.otomat-spinner{animation:none}}
`;

export interface SpinnerProps extends Omit<ComponentPropsWithoutRef<"output">, "children"> {
  size?: number;
  label?: string;
}

export function Spinner({
  className,
  size = 14,
  label = "Loading",
  style,
  ...props
}: SpinnerProps) {
  injectSpinKeyframes();
  injectStyleOnce(SPINNER_STYLE_ID, SPINNER_CSS);
  return (
    <output
      aria-label={label}
      data-slot="spinner"
      className={cn("otomat-spinner inline-block shrink-0", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
}
