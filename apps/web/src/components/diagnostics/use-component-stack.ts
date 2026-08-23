import {
  componentStackFor,
  componentStacksVersion,
  subscribeComponentStacks,
} from "@web/lib/diagnostics/component-stacks";
import { useSyncExternalStore } from "react";

/** React reports the stack one commit after this first renders, so it is subscribed to, not read once. */
export function useComponentStack(error: unknown): string | null {
  useSyncExternalStore(subscribeComponentStacks, componentStacksVersion, componentStacksVersion);
  return componentStackFor(error);
}
