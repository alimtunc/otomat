import type { RemoteHostStatus } from "@otomat/domain";
import { createContext, useContext } from "react";

export interface RemoteSessionState {
  /** True while the cockpit is pointed at the remote host rather than this machine. */
  active: boolean;
  /** Configured ssh alias; null in a plain browser and on a desktop that knows only the local host. */
  alias: string | null;
  status: RemoteHostStatus | null;
  /** True while the host is still working its journey through: connecting, checking, installing. */
  settling: boolean;
  /** Build the host's daemon answers with, and the one this app asked for. */
  build: string | null;
  expectedBuild: string | null;
  /** True while the host runs a build this app did not ask for, whether or not it is the active one. */
  stale: boolean;
  /** True while the *active* host is stale: new runs wait for the update. */
  updatePending: boolean;
  /** Why the last automatic update stopped, when one did; the old daemon kept running. */
  updateError: string | null;
}

/** A browser cockpit, and any tree without the provider: one daemon, nothing to wait for. */
export const LOCAL_SESSION: RemoteSessionState = {
  active: false,
  alias: null,
  status: null,
  settling: false,
  build: null,
  expectedBuild: null,
  stale: false,
  updatePending: false,
  updateError: null,
};

export const RemoteSessionContext = createContext<RemoteSessionState>(LOCAL_SESSION);

/** Where the execution host stands, for every surface that must not mistake a bootstrap for a failure. */
export function useRemoteSession(): RemoteSessionState {
  return useContext(RemoteSessionContext);
}
