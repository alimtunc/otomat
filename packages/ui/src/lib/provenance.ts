import type { EventSource, EventType } from "@otomat/domain/types";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDotDashed,
  FileDiff,
  Flag,
  GitCompare,
  GitCommitHorizontal,
  GitPullRequest,
  type LucideIcon,
  MessageSquare,
  Play,
  ShieldQuestion,
  Terminal,
} from "lucide-react";

import type { StatusTone } from "./status";

export const PROVENANCE_VAR: Record<EventSource, string> = {
  otomat: "var(--prov-otomat)",
  claude: "var(--prov-claude)",
  codex: "var(--prov-codex)",
  git: "var(--prov-git)",
  github: "var(--prov-github)",
  linear: "var(--prov-linear)",
  system: "var(--prov-system)",
};

export const PROVENANCE_LABEL: Record<EventSource, string> = {
  otomat: "Otomat",
  claude: "Claude",
  codex: "Codex",
  git: "Git",
  github: "GitHub",
  linear: "Linear",
  system: "System",
};

export interface EventGlyphDescriptor {
  icon: LucideIcon;
  tone: StatusTone;
}

export const EVENT_GLYPH: Record<EventType, EventGlyphDescriptor> = {
  "run.lifecycle": { icon: Flag, tone: "neutral" },
  "step.lifecycle": { icon: GitCommitHorizontal, tone: "neutral" },
  "session.lifecycle": { icon: Play, tone: "neutral" },
  "compete.lifecycle": { icon: GitCompare, tone: "warning" },
  "runtime.log": { icon: Terminal, tone: "neutral" },
  "runtime.message": { icon: MessageSquare, tone: "neutral" },
  "runtime.tool_call": { icon: Terminal, tone: "iris" },
  "runtime.permission_request": { icon: ShieldQuestion, tone: "warning" },
  "runtime.permission_response": { icon: ShieldQuestion, tone: "neutral" },
  "runtime.usage": { icon: Activity, tone: "neutral" },
  "runtime.provider_session": { icon: CircleDotDashed, tone: "neutral" },
  "git.diff_updated": { icon: FileDiff, tone: "stale" },
  "review.comment_created": { icon: MessageSquare, tone: "review" },
  "review.comment_resolved": { icon: CheckCircle2, tone: "success" },
  "pr.created": { icon: GitPullRequest, tone: "success" },
  "pr.updated": { icon: GitPullRequest, tone: "neutral" },
  "system.reconciled": { icon: AlertTriangle, tone: "stale" },
};
