import type { ErrorDiagnostic } from "@otomat/domain";

export interface ErrorCategoryCopy {
  title: string;
  description: string;
}

export function describeErrorCategory(diagnostic: ErrorDiagnostic): ErrorCategoryCopy {
  if (diagnostic.category === "renderer") {
    return {
      title: "The cockpit hit a renderer error",
      description:
        "This failed in the interface on this machine, not in the daemon. No daemon log holds " +
        "it — the details below are the whole record, and they are what to attach to a report.",
    };
  }
  if (diagnostic.category === "transport") {
    return {
      title: `Otomat could not reach ${diagnostic.host.label}`,
      description:
        "The request never arrived, so no daemon log describes it. Check that the host is " +
        "running and, for a remote host, that its connection is up, then retry.",
    };
  }
  const status = diagnostic.request === null ? "an error" : String(diagnostic.request.status);
  return {
    title: `${diagnostic.host.label} could not complete this request`,
    description: `The daemon on the active execution host answered ${status}. What it recorded for this exact request is below.`,
  };
}
