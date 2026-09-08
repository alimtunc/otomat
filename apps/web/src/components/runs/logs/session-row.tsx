import type { AgentSessionContract } from "@otomat/domain";
import { AgentAvatar, CopyButton, StatusChip } from "@otomat/ui";
import { CodexPermissions } from "@web/components/runs/conversation/codex-permissions";
import { codexResumeCommand } from "@web/lib/workspace/open";

export function SessionRow({
  session,
  stepName,
  worktreePath,
}: {
  session: AgentSessionContract;
  stepName: string | null;
  worktreePath: string | null;
}) {
  const command =
    session.agent_id === "codex" &&
    session.provider_session_id !== null &&
    session.config != null &&
    worktreePath !== null
      ? codexResumeCommand(session.provider_session_id, session.config, worktreePath)
      : null;
  return (
    <li className="px-3.5 py-2 text-sm">
      <div className="flex items-center gap-2.5">
        <AgentAvatar size="sm" name={session.agent_id ?? "agent"} />
        <span className="truncate font-medium text-foreground">{session.agent_id ?? "agent"}</span>
        {stepName !== null ? (
          <span className="truncate text-xs text-text-tertiary">{stepName}</span>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {session.provider_session_id !== null ? (
            <span className="flex items-center gap-1 font-mono text-micro text-text-tertiary">
              <span className="max-w-40 truncate" title={session.provider_session_id}>
                {session.provider_session_id}
              </span>
              <CopyButton value={session.provider_session_id} label="Copy provider session id" />
            </span>
          ) : null}
          <StatusChip kind="session" status={session.status} />
        </span>
      </div>
      {session.agent_id === "codex" ? (
        <div className="mt-2 space-y-1.5">
          <CodexPermissions options={session.config?.options ?? null} />
          {command !== null ? (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>Resume in Codex with this session’s requested settings</span>
              <CopyButton value={command} label="Copy Codex resume command" />
            </div>
          ) : null}
          <p className="text-xs text-text-tertiary">
            Run on the same host after stopping the Otomat turn. External resume loads its own
            configuration for unset options; check /status. Global defaults are unchanged.
          </p>
        </div>
      ) : null}
    </li>
  );
}
