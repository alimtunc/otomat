import {
  redactLogText,
  type DaemonLogEntry,
  type ErrorDiagnostic,
  type SchemaMetadataContract,
} from "@otomat/domain";

export interface SupportBundleVersions {
  desktop: string;
  /** Commit the installed build was packaged from; ties a bug report to a downloadable artifact. */
  commit: string;
  /** Distribution channel of the running build; it names which data and host deployment this is. */
  channel: string;
  signed: boolean;
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
  /** The incident this export was triggered from; absent for a bundle exported from the menu. */
  incident?: ErrorDiagnostic | null;
  logs: {
    desktop: string;
    daemon: string;
  };
}

function redactedEntry(entry: DaemonLogEntry): DaemonLogEntry {
  return { ...entry, message: redactLogText(entry.message) };
}

function redactedIncident(incident: ErrorDiagnostic): ErrorDiagnostic {
  return {
    ...incident,
    message: redactLogText(incident.message),
    stack: incident.stack === null ? null : redactLogText(incident.stack),
    component_stack:
      incident.component_stack === null ? null : redactLogText(incident.component_stack),
    daemon_log: incident.daemon_log === null ? null : incident.daemon_log.map(redactedEntry),
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
  const incident = input.incident ?? null;
  return `${JSON.stringify(
    {
      versions: input.versions,
      health,
      schema: input.schema,
      incident: incident === null ? undefined : redactedIncident(incident),
      logs: {
        desktop: redactLogText(input.logs.desktop),
        daemon: redactLogText(input.logs.daemon),
      },
    },
    null,
    2,
  )}\n`;
}
