import type { LinearIssueSnapshot } from "@otomat/domain";

export function LinearStateIcon({
  state,
}: {
  state: Pick<LinearIssueSnapshot["state"], "color" | "type">;
}) {
  const filled = state.type === "completed" || state.type === "canceled";
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      style={{ color: state.color }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill={filled ? "currentColor" : "none"}
        strokeDasharray={state.type === "backlog" ? "1.4 2.2" : undefined}
      />
      {state.type === "started" ? (
        <path d="M8 4a4 4 0 0 1 0 8Z" fill="currentColor" stroke="none" />
      ) : null}
      {state.type === "completed" ? (
        <path d="m5 8 2 2 4-4" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {state.type === "canceled" ? (
        <path d="m6 6 4 4m0-4-4 4" stroke="white" strokeLinecap="round" />
      ) : null}
      {state.type === "triage" ? (
        <path d="m5.5 7 2.5 2.5L10.5 7" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </svg>
  );
}
