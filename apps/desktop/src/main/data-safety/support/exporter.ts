import {
  healthResponseSchema,
  type ErrorDiagnostic,
  type SupportBundleExportResult,
} from "@otomat/domain";

import { withAbortTimeout } from "#shared/abort-timeout";

import {
  buildSupportBundle,
  type SupportBundleHealth,
  type SupportBundleVersions,
} from "./bundle.js";

interface SupportBundleExporterOptions {
  versions: SupportBundleVersions;
  daemonUrl(): string;
  readLogs(): { desktop: string; daemon: string };
  chooseDestination(): Promise<string | null>;
  write(path: string, contents: string): void | Promise<void>;
  /** Incident the export was triggered from; omitted when the user exported from the menu. */
  incident?: ErrorDiagnostic | null;
  fetch?: typeof fetch;
  healthTimeoutMs?: number;
}

export async function exportSupportBundle(
  options: SupportBundleExporterOptions,
): Promise<SupportBundleExportResult> {
  const destination = await options.chooseDestination();
  if (destination === null) return { status: "canceled" };

  const daemonUrl = options.daemonUrl();
  let health: SupportBundleHealth = {
    status: "unavailable",
    detail: "The daemon did not report healthy.",
  };
  let schema = null;
  if (daemonUrl !== "") {
    try {
      const parsed = await withAbortTimeout(
        options.healthTimeoutMs ?? 3000,
        undefined,
        async (signal) => {
          const response = await (options.fetch ?? fetch)(`${daemonUrl}/api/health`, { signal });
          if (!response.ok) throw new Error(`health responded ${response.status}`);
          return healthResponseSchema.parse(await response.json());
        },
      );
      health = {
        status: parsed.status,
        name: parsed.name,
        version: parsed.version,
        started_at: parsed.started_at,
      };
      schema = parsed.schema;
    } catch {
      health = {
        status: "unavailable",
        detail: "The daemon health response was unavailable or invalid.",
      };
    }
  }
  await options.write(
    destination,
    buildSupportBundle({
      versions: options.versions,
      health,
      schema,
      incident: options.incident ?? null,
      logs: options.readLogs(),
    }),
  );
  return { status: "written", path: destination };
}
