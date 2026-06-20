import { defaultDbPath } from "@otomat/db";
import { runMachine } from "@otomat/domain";

// OTO-5 ships the daemon shell only; the HTTP+SSE API (OTO-9) and supervisor/reconciliation loop (OTO-10) are added by their owning tickets.
export function describeFoundation(): string {
  return `[otomat] local-daemon shell ready — db ${defaultDbPath()}, run initial state "${runMachine.initial}"`;
}

if (!process.env.VITEST) {
  console.log(describeFoundation());
}
