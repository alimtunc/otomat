import type { RemoteHostStatus } from "@otomat/domain";
import { createContext, useContext } from "react";

export interface RemoteSessionState {
  active: boolean;
  alias: string | null;
  status: RemoteHostStatus | null;
  settling: boolean;
  build: string | null;
  expectedBuild: string | null;
  stale: boolean;
  updatePending: boolean;
  updateError: string | null;
}

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
