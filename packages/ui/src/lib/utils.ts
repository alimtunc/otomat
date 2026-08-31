import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge reads text-micro as a text color and drops the real color beside it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": ["text-micro"] } },
});

/** Joins class values with `clsx`, then de-duplicates conflicting Tailwind utilities via `tailwind-merge` (last wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
