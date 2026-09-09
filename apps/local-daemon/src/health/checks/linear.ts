import type { ProjectHealthOutcome } from "@otomat/domain";

import type { LinearService } from "#linear";

export function linearCheck(linear: LinearService, projectId: string): ProjectHealthOutcome {
  const status = linear.syncStatus(projectId);
  const connection = status.connection;

  if (connection === null) {
    return {
      status: "warning",
      message: "No Linear connection is mapped to this project on this host.",
      remediation: "Map a Linear source to this project, or work from local issues only.",
    };
  }
  if (connection.status !== "connected") {
    return {
      status: "error",
      message:
        connection.status === "disconnected"
          ? `"${connection.label}" holds no key on this host.`
          : `"${connection.label}" was refused: ${connection.error_message ?? connection.status}.`,
      remediation: `Reconnect "${connection.label}" so this host can read its issues.`,
    };
  }
  if (status.sources === 0) {
    return {
      status: "warning",
      message: `"${connection.label}" is connected but no team or project is mapped here.`,
      remediation: "Add a Linear source to this project.",
    };
  }
  if (status.last_error !== null) {
    return {
      status: "warning",
      message: `The last sync of "${connection.label}" failed: ${status.last_error.message}`,
      remediation: "Refresh this project's Linear sources and check the connection's access.",
    };
  }

  return {
    status: "ready",
    message: `${status.sources} Linear source(s) mapped through "${connection.label}".`,
    remediation: null,
  };
}
