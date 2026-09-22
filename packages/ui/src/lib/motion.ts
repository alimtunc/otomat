// The delay keeps a replacement that lands fast from flickering the retained content.
export const STALE_CONTENT_CLASS =
  "opacity-60 transition-opacity duration-(--motion-medium) delay-150";

export const SETTLE_IN_CLASS =
  "transition-[opacity,translate] duration-(--motion-base) ease-standard starting:opacity-0 starting:-translate-y-1";
