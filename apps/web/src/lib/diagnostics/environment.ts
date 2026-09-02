import type { ErrorDiagnostic } from "@otomat/domain";
import { activeExecutionHostId, remoteHostAlias } from "@web/lib/active-host";
import { desktopBridge } from "@web/lib/desktop-bridge";

export interface DiagnosticEnvironment {
  host: ErrorDiagnostic["host"];
  app: ErrorDiagnostic["app"];
}

export function diagnosticEnvironment(): DiagnosticEnvironment {
  const bridge = desktopBridge();
  if (bridge === null) {
    return { host: { id: "local", label: "Local (browser)", ssh_alias: null }, app: null };
  }
  const alias = remoteHostAlias();
  return {
    host: {
      id: activeExecutionHostId(),
      label: alias === null ? "Local" : `Remote · ${alias}`,
      ssh_alias: alias,
    },
    app: {
      version: bridge.build.version,
      commit: bridge.build.commit,
      channel: bridge.build.channel,
    },
  };
}
