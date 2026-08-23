import type { AgentCapacity, ExecutionHostId, OtomatDesktopBridge } from "@otomat/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useState } from "react";

function readCapacity(
  bridge: OtomatDesktopBridge | null,
  hostId: ExecutionHostId,
): Promise<AgentCapacity> {
  if (bridge === null) return daemon.agentCapacity();
  return bridge.executionHost.readCapacity(hostId).then((result) => {
    if (!result.ok) throw new Error(result.message);
    return result.capacity;
  });
}

function writeCapacity(
  bridge: OtomatDesktopBridge | null,
  hostId: ExecutionHostId,
  maxConcurrentSessions: number,
): Promise<AgentCapacity> {
  if (bridge === null) {
    return daemon.setAgentCapacity({ max_concurrent_sessions: maxConcurrentSessions });
  }
  return bridge.executionHost.writeCapacity(hostId, maxConcurrentSessions).then((result) => {
    if (!result.ok) throw new Error(result.message);
    return result.capacity;
  });
}

export interface UseHostCapacityResult {
  capacity: AgentCapacity | undefined;
  loadError: string | null;
  saving: boolean;
  saveError: string | null;
  save(maxConcurrentSessions: number): Promise<boolean>;
}

export function useHostCapacity(hostId: ExecutionHostId): UseHostCapacityResult {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryKey = ["host-capacity", hostId];

  const query = useQuery({ queryKey, queryFn: () => readCapacity(bridge, hostId) });

  async function save(maxConcurrentSessions: number): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      client.setQueryData(queryKey, await writeCapacity(bridge, hostId, maxConcurrentSessions));
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    capacity: query.data,
    loadError: query.error === null ? null : query.error.message,
    saving,
    saveError,
    save,
  };
}
