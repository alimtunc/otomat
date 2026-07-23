import {
  desktopStartupDiagnosticSchema,
  STARTUP_DIAGNOSTIC_PREFIX,
  type DesktopStartupDiagnostic,
} from "@otomat/domain";

export type StartupDiagnosticLine =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "valid"; diagnostic: DesktopStartupDiagnostic };

export function parseStartupDiagnosticLine(line: string): StartupDiagnosticLine {
  if (!line.startsWith(STARTUP_DIAGNOSTIC_PREFIX)) return { kind: "none" };
  let decoded: unknown;
  try {
    decoded = JSON.parse(line.slice(STARTUP_DIAGNOSTIC_PREFIX.length));
  } catch {
    return { kind: "invalid" };
  }
  const parsed = desktopStartupDiagnosticSchema.safeParse(decoded);
  return parsed.success ? { kind: "valid", diagnostic: parsed.data } : { kind: "invalid" };
}
