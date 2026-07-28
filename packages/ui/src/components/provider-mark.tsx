import type { SVGProps } from "react";

import { PROVIDER_MARK_ART, type ProviderMarkName } from "../lib/provider-mark-art";
import { cn } from "../lib/utils";

export interface ProviderMarkProps extends Omit<SVGProps<SVGSVGElement>, "children" | "viewBox"> {
  name: ProviderMarkName;
}

/** The marks are solid artwork, so `fill-current stroke-none` opts them out of the global `svg` rule that would paint a stroke around every filled ray. */
export function ProviderMark({ name, className, style, ...props }: ProviderMarkProps) {
  const art = PROVIDER_MARK_ART[name];
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0 fill-current stroke-none", className)}
      style={{ color: art.color, ...style }}
      {...props}
    >
      <path d={art.d} />
    </svg>
  );
}
