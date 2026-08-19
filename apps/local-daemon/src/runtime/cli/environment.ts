const CODEX_SESSION_ENV = new Set([
  "CODEX_CI",
  "CODEX_REMOTE_PAYLOAD",
  "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_THREAD_ID",
]);

export function providerProcessEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) continue;
    if (CODEX_SESSION_ENV.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}
