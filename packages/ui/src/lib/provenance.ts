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
  ListPlus,
  type LucideIcon,
  MessageSquare,
  Play,
  ShieldQuestion,
  Terminal,
} from "lucide-react";

import type { StatusTone } from "./tone";

export const PROVENANCE_VAR = {
  otomat: "var(--prov-otomat)",
  claude: "var(--prov-claude)",
  codex: "var(--prov-codex)",
  git: "var(--prov-git)",
  github: "var(--prov-github)",
  linear: "var(--prov-linear)",
  system: "var(--prov-system)",
} satisfies Record<EventSource, string>;

export const PROVENANCE_LABEL = {
  otomat: "Otomat",
  claude: "Claude",
  codex: "Codex",
  git: "Git",
  github: "GitHub",
  linear: "Linear",
  system: "System",
} satisfies Record<EventSource, string>;

export interface EventGlyphDescriptor {
  icon: LucideIcon;
  tone: StatusTone;
}

export const EVENT_GLYPH = {
  "run.lifecycle": { icon: Flag, tone: "neutral" },
  "run.contribution": { icon: MessageSquare, tone: "iris" },
  "run.plan_revised": { icon: ListPlus, tone: "iris" },
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
  "review.comment_published": { icon: GitPullRequest, tone: "review" },
  "pr.created": { icon: GitPullRequest, tone: "success" },
  "pr.updated": { icon: GitPullRequest, tone: "neutral" },
  "linear.lifecycle_synced": { icon: Flag, tone: "success" },
  "linear.status_published": { icon: Flag, tone: "success" },
  "linear.comment_published": { icon: MessageSquare, tone: "neutral" },
  "linear.pr_link_published": { icon: GitPullRequest, tone: "success" },
  "system.reconciled": { icon: AlertTriangle, tone: "stale" },
} satisfies Record<EventType, EventGlyphDescriptor>;
