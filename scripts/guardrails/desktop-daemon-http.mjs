import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { listFiles } from "./files.mjs";

// The daemon HTTP contract is spoken through @otomat/client (typed errors, schema
// validation, correlation ids). These files keep bespoke fetches on purpose — boot
// and health probes with their own retry/abort shape, preview seeding, and the idle
// check that must tolerate a stale build's contract — and this list only shrinks.
const ALLOWLIST = new Set([
  "apps/desktop/src/main/daemon.ts",
  "apps/desktop/src/main/data-safety/support/exporter.ts",
  "apps/desktop/src/main/preview/seed.ts",
  "apps/desktop/src/main/remote/idle.ts",
  "apps/desktop/src/main/remote/session.ts",
]);

export function checkDesktopDaemonHttp(root, report) {
  for (const file of listFiles(root, "apps/desktop/src")) {
    if (ALLOWLIST.has(relative(root, file).replaceAll("\\", "/"))) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      const trimmed = text.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      const col = text.indexOf("/api/");
      if (col === -1) return;
      report(
        file,
        i + 1,
        col + 1,
        "desktop-daemon-http",
        "apps/desktop speaks the daemon HTTP contract through @otomat/client. Hand-rolled `/api/*` requests are limited to the shrink-only allowlist in scripts/guardrails/desktop-daemon-http.mjs.",
      );
    });
  }
}
