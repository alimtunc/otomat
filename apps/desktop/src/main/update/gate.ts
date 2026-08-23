import { createDaemonClient, type DaemonClient } from "@otomat/client";
import type { LaunchHold } from "@otomat/domain";

import type { HostTarget } from "../remote/host/catalog.js";
import { remoteBusyRuns } from "../remote/idle.js";

/** Why the app may not be replaced right now, or nothing left in its way. */
export type GateVerdict = { clear: true } | { clear: false; reason: string };

const CLEAR: GateVerdict = { clear: true };

export interface UpdateGateOptions {
  /** Every configured execution host, local first; asking warms an idle remote tunnel. */
  hosts(): HostTarget[];
  fetchImpl?: typeof fetch;
  log(message: string): void;
}

function unreachable(label: string): GateVerdict {
  return { clear: false, reason: `${label} could not be reached, so its runs cannot be read.` };
}

function busy(label: string, runs: number): GateVerdict {
  const plural = runs === 1 ? "run" : "runs";
  return { clear: false, reason: `${label} still has ${String(runs)} ${plural} in flight.` };
}

export class UpdateGate {
  constructor(private readonly options: UpdateGateOptions) {}

  /** What the operator is shown before deciding; nothing is held. */
  async observe(): Promise<GateVerdict> {
    for (const target of this.options.hosts()) {
      if (target.url === null) return unreachable(target.host.label);
      const runs = await remoteBusyRuns({
        baseUrl: target.url,
        fetchImpl: this.options.fetchImpl ?? fetch,
        log: this.options.log,
      });
      // An unreadable answer is not an idle one: a daemon that cannot list its runs keeps the app.
      if (runs === null) return unreachable(target.host.label);
      if (runs > 0) return busy(target.host.label, runs);
    }
    return CLEAR;
  }

  /** Holds every host and reports the first one that is not idle; the caller releases on any verdict but `clear`. */
  async arm(): Promise<GateVerdict> {
    for (const target of this.options.hosts()) {
      if (target.url === null) return unreachable(target.host.label);
      const hold = await this.hold(target.url, true);
      if (hold === null) {
        return { clear: false, reason: `${target.host.label} did not accept the update hold.` };
      }
      if (!hold.held) return { clear: false, reason: `${target.host.label} refused to hold.` };
      if (hold.active_runs > 0) return busy(target.host.label, hold.active_runs);
    }
    return CLEAR;
  }

  /** Best effort on every host: a hold left behind expires by itself, but a live one must not. */
  async release(): Promise<void> {
    for (const target of this.options.hosts()) {
      if (target.url === null) continue;
      if ((await this.hold(target.url, false)) === null) {
        this.options.log(`Update hold on ${target.host.label} could not be lifted.`);
      }
    }
  }

  /** Null for a host that refused, could not be reached, or answered something else entirely. */
  private async hold(baseUrl: string, held: boolean): Promise<LaunchHold | null> {
    const client: DaemonClient = createDaemonClient({
      baseUrl,
      fetch: this.options.fetchImpl,
    });
    try {
      return await client.setLaunchHold({ held });
    } catch (error) {
      this.options.log(`Update hold on ${baseUrl} failed: ${String(error)}`);
      return null;
    }
  }
}
