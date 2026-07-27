// Pure pieces of the desktop dev runner, kept apart from process orchestration so the port
// reservation and the Vite URL handed to Electron are testable without spawning anything.
import { createServer } from "node:net";

const LOOPBACK = "127.0.0.1";

/** Mirrors `#shared/constants`; the runner is plain JS and cannot import the TypeScript source. */
export const DEV_SERVER_ENV = "OTOMAT_DESKTOP_DEV_SERVER";

/** Asks the OS for a free loopback port by binding port 0 and releasing it. */
export function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, LOOPBACK, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("could not determine a free loopback port")));
        return;
      }
      const { port } = address;
      server.close((closeError) => (closeError ? reject(closeError) : resolve(port)));
    });
  });
}

/**
 * Decides which dev server this session talks to: an explicit `OTOMAT_DESKTOP_DEV_SERVER` URL
 * (the documented override, never started or owned here), otherwise a Vite server this runner
 * starts on a port it reserved. Nothing ever falls back to a default port, so a session cannot
 * silently attach to another worktree's dev server.
 */
export async function planDevServer({ env, reservePort = reserveLoopbackPort }) {
  const override = (env[DEV_SERVER_ENV] ?? "").trim();
  if (override === "") {
    const port = await reservePort();
    return { url: `http://${LOOPBACK}:${port}`, port, managed: true };
  }
  let parsed;
  try {
    parsed = new URL(override);
  } catch (cause) {
    throw new Error(`${DEV_SERVER_ENV} is not a valid URL: "${override}"`, { cause });
  }
  // `origin` is "null" for anything else, which Electron would then be handed as a start URL.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${DEV_SERVER_ENV} must be an http(s) URL, received "${override}"`);
  }
  return { url: parsed.origin, managed: false };
}

/**
 * Vite CLI args pinning the server to the reserved port; `--strictPort` makes Vite exit instead
 * of drifting to the next free one. Passed to Vite's own binary — routing them through
 * `pnpm run` hands Vite a leading `--`, after which it ignores every flag.
 */
export function viteArgs(port) {
  return ["--host", LOOPBACK, "--port", String(port), "--strictPort"];
}

/**
 * Env for the Electron child: the exact URL this session serves, never a default. `ELECTRON_RUN_AS_NODE`
 * is dropped because an Electron-hosted terminal exports it, which would boot the shell as plain Node;
 * the daemon child sets it deliberately when it needs it.
 */
export function electronEnv(baseEnv, url) {
  const env = { ...baseEnv, [DEV_SERVER_ENV]: url };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}
