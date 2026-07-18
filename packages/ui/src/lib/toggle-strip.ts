import { cva } from "class-variance-authority";

export interface ToggleStripItemPreset {
  layout: string;
  pressed: string;
  svg: string;
  extra?: string;
}

export function toggleStripItemVariants(preset: ToggleStripItemPreset) {
  return cva(
    [
      preset.layout,
      "text-text-secondary",
      "transition-[background,color] duration-[--motion-fast] ease-standard",
      "hover:text-foreground",
      preset.pressed,
      "disabled:pointer-events-none disabled:opacity-50",
      preset.svg,
      ...(preset.extra ? [preset.extra] : []),
    ].join(" "),
    {
      variants: {
        density: {
          compact: "h-6 text-xs",
          comfortable: "h-7 text-sm",
        },
      },
      defaultVariants: {
        density: "compact",
      },
    },
  );
}
