import { providerOptionSet } from "#support/runtime-options";

/** What a current Claude Code announces, under Claude's own keys: the `--permission-mode` values, `auto` being the autonomous one Otomat sends by default, and an effort. */
export const CLAUDE_ANNOUNCED = providerOptionSet({
  detection: { status: "ok", detail: "Announced by `claude --help`." },
  options: [
    {
      key: "permission_mode",
      description: "How Claude Code decides whether a tool call may proceed.",
      choices: [
        { value: "auto", description: "The provider decides for itself.", dangerous: false },
        { value: "acceptEdits", description: "Auto-approves edits.", dangerous: false },
        { value: "plan", description: "Plans the work without applying it.", dangerous: false },
        { value: "bypassPermissions", description: "Skips every check.", dangerous: true },
      ],
      default_value: "auto",
    },
    {
      key: "effort",
      description: "How much reasoning effort Claude Code spends.",
      choices: [
        { value: "low", description: null, dangerous: false },
        { value: "high", description: null, dangerous: false },
      ],
      default_value: null,
    },
  ],
});

/** What a current Codex announces: a sandbox and a per-model reasoning effort, under Codex's own keys. */
export const CODEX_ANNOUNCED = providerOptionSet({
  runtime: "codex",
  model: "gpt-5.6-sol",
  detection: { status: "ok", detail: "Announced by `codex exec --help`." },
  options: [
    {
      key: "sandbox",
      description: "What the OS-level sandbox lets Codex write while it runs.",
      choices: [
        { value: "workspace-write", description: null, dangerous: false },
        { value: "danger-full-access", description: "No sandbox.", dangerous: true },
      ],
      default_value: "workspace-write",
    },
    {
      key: "reasoning_effort",
      description: "How much reasoning effort this model spends. Codex applies its own by default.",
      choices: [
        { value: "medium", description: null, dangerous: false },
        { value: "xhigh", description: null, dangerous: false },
      ],
      default_value: null,
    },
  ],
});
