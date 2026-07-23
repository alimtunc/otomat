import type { SchemaMetadataContract } from "@otomat/domain";

import { redactLogText } from "./redaction.js";

export interface SupportBundleVersions {
  desktop: string;
  electron: string;
  node: string;
  platform: string;
  arch: string;
}

export type SupportBundleHealth =
  | { status: "ok"; name: string; version: string; started_at: string }
  | { status: "unavailable"; detail: string };

export interface SupportBundleInput {
  versions: SupportBundleVersions;
  health: SupportBundleHealth;
  schema: SchemaMetadataContract | null;
  logs: {
    desktop: string;
    daemon: string;
  };
}

export function buildSupportBundle(input: SupportBundleInput): string {
  const health =
    input.health.status === "ok"
      ? {
          status: input.health.status,
          name: input.health.name,
          version: input.health.version,
          started_at: input.health.started_at,
        }
      : { status: input.health.status, detail: input.health.detail };
  return `${JSON.stringify(
    {
      versions: input.versions,
      health,
      schema: input.schema,
      logs: {
        desktop: redactLogText(input.logs.desktop),
        daemon: redactLogText(input.logs.daemon),
      },
    },
    null,
    2,
  )}\n`;
}
