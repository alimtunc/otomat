import type { ErrorDiagnostic, ErrorDiagnosticCategory, ProblemReportDraft } from "@otomat/domain";

const MAX_TITLE_CHARACTERS = 120;
const MAX_BODY_CHARACTERS = 6_000;

const CATEGORY_TITLES: Record<ErrorDiagnosticCategory, string> = {
  renderer: "Renderer error",
  daemon: "Daemon error",
  transport: "Execution host unreachable",
};

const TRACES_OMITTED_NOTE =
  "Stacks and the host log excerpt were left out to keep this draft short. They are in the " +
  "exported support bundle, which is not attached automatically.";

function body(diagnostic: ErrorDiagnostic, note: string | null): string {
  const sections = [
    "### What happened",
    "",
    "<!-- Add what you were doing when this appeared. -->",
    "",
    "### Diagnostic",
    "",
    ...(note === null ? [] : [note, ""]),
    "```json",
    JSON.stringify(diagnostic, null, 2),
    "```",
    "",
  ];
  return sections.join("\n");
}

/**
 * The exact text a report would carry, rendered so the user can read it before deciding. Nothing
 * is written or opened by building it; the draft is only ever published from an explicit confirm.
 */
export function problemReportDraft(diagnostic: ErrorDiagnostic): ProblemReportDraft {
  const title = `${CATEGORY_TITLES[diagnostic.category]}: ${diagnostic.message}`;
  const full = body(diagnostic, null);
  if (full.length <= MAX_BODY_CHARACTERS) {
    return { title: title.slice(0, MAX_TITLE_CHARACTERS), body: full };
  }
  const compact = { ...diagnostic, stack: null, component_stack: null, daemon_log: null };
  return {
    title: title.slice(0, MAX_TITLE_CHARACTERS),
    body: body(compact, TRACES_OMITTED_NOTE),
  };
}
