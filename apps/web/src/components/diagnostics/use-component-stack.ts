import {
  componentStackFor,
  componentStacksVersion,
  subscribeComponentStacks,
} from "@web/lib/diagnostics/component-stacks";
import { useSyncExternalStore } from "react";

/**
 * The component stack for this error, once React has reported it. It arrives one commit after the
 * error surface first renders, so this subscribes rather than reading once and settling for null.
 */
export function useComponentStack(error: unknown): string | null {
  useSyncExternalStore(subscribeComponentStacks, componentStacksVersion, componentStacksVersion);
  return componentStackFor(error);
}
