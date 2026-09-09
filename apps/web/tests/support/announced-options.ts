import { providerOptionSet } from "#support/runtime-options";

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

export const CODEX_ANNOUNCED = providerOptionSet({
  runtime: "codex",
  model: "gpt-5.6-sol",
  detection: { status: "ok", detail: "Announced by `codex exec --help`." },
  options: [
    {
      key: "approvals_reviewer",
      description: "Automatic review keeps the sandbox and may deny a request.",
      choices: [
        { value: "user", description: "No automatic review.", dangerous: false },
        {
          value: "auto_review",
          description: "Approve for me requires on-request.",
          dangerous: false,
        },
      ],
      default_value: null,
    },
    {
      key: "approval_policy",
      description: "When approval is requested.",
      choices: [
        { value: "never", description: "No approval requests.", dangerous: false },
        {
          value: "on-request",
          description: "Requires automatic review in exec.",
          dangerous: false,
        },
      ],
      default_value: null,
    },
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
