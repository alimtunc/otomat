import type { PermissionModeStatus } from "@otomat/domain";

/** Four refusals that look alike in a log and need four different answers, so each one names the fix. */
export function permissionDiagnosisText(status: PermissionModeStatus, mode: string | null): string {
  const named = mode === null ? "the mode it ran under" : `“${mode}”`;
  switch (status) {
    case "unfrozen":
      return `This step froze no permission mode, so the runtime fell back to ${named}. Relaunch to freeze the mode Otomat resolves today.`;
    case "unannounced":
      return `The CLI installed on the execution host announces no ${named} mode, so it never applied. Check the runtime installed where the run executes, not where the cockpit runs.`;
    case "autonomous":
      return `${named} was in effect and the provider's own classifier refused this call. Autonomy was not lost: narrow the command, or allow it in the provider's own settings.`;
    case "supervised":
      return `${named} was in effect, and it defers this call to a human answer the run never got — Otomat cannot approve one mid-run. Move the step to the recommended mode to let the provider decide for itself.`;
  }
}
