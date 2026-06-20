import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";

const SPINNER_STYLE_ID = "otomat-spinner";
const SPINNER_CSS = `
@keyframes otomat-spinner-rotate{to{transform:rotate(360deg)}}
.otomat-spinner{border-radius:50%;border:2px solid var(--border-strong);border-top-color:var(--iris-solid);animation:otomat-spinner-rotate .7s linear infinite}
@media (prefers-reduced-motion:reduce){.otomat-spinner{animation:none}}
`;

function ensureSpinnerStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SPINNER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SPINNER_STYLE_ID;
  style.textContent = SPINNER_CSS;
  document.head.appendChild(style);
}

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
  ensureSpinnerStyle();
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
