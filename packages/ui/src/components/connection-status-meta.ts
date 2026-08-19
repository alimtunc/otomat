import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { ComponentType } from "react";

import type { ConnectionState } from "../lib/connection-state";
import { TONE_FACETS } from "../lib/tone";

export interface StateMeta {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  dotColorVar: string;
  textClass: string;
  triggerTextClass: string;
  live: boolean;
}

export const STATE_META = {
  online: {
    label: "Online",
    icon: Wifi,
    dotColorVar: TONE_FACETS.success.cssVar,
    textClass: TONE_FACETS.success.text,
    triggerTextClass: "text-text-secondary",
    live: false,
  },
  reconnecting: {
    label: "Reconnecting…",
    icon: RefreshCw,
    dotColorVar: TONE_FACETS.warning.cssVar,
    textClass: TONE_FACETS.warning.text,
    triggerTextClass: "text-text-secondary",
    live: true,
  },
  offline: {
    label: "Offline · cached",
    icon: WifiOff,
    dotColorVar: TONE_FACETS.ghost.cssVar,
    textClass: TONE_FACETS.danger.text,
    triggerTextClass: "text-text-tertiary",
    live: false,
  },
} satisfies Record<ConnectionState, StateMeta>;
