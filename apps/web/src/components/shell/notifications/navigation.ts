import type { DesktopNotification, OtomatDesktopBridge } from "@otomat/domain";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import { projectSelectionStore } from "@web/components/shell/project-selection/store";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { activeHostStore } from "@web/lib/active-host";
import { inboxRoute } from "@web/lib/inbox/target";

export function notificationRoute(notification: DesktopNotification) {
  const target = notification.target;
  if (target.kind === "run" && notification.category === "review") {
    return { to: "/runs/$runId/diff" as const, params: { runId: target.run_id } };
  }
  if (target.kind === "run") {
    return {
      to: "/runs/$runId" as const,
      params: { runId: target.run_id },
      search: { step: notification.step_run_id ?? undefined },
      hash:
        notification.interaction_id === null
          ? undefined
          : `interaction-${notification.interaction_id}`,
    };
  }
  return inboxRoute(target);
}

export async function selectNotificationProject(
  bridge: OtomatDesktopBridge,
  notification: DesktopNotification,
): Promise<void> {
  const snapshot = await bridge.executionHost.snapshot();
  if (notification.host_id === "remote" && snapshot.remote_ssh_alias !== notification.host_alias) {
    throw new Error("This notification belongs to a remote host that is no longer configured.");
  }
  const result = await bridge.executionHost.select(notification.host_id);
  if (!result.ok) throw new Error(describeOperationFailure(result));
  activeHostStore.actions.activate({ id: notification.host_id, daemonUrl: result.url });
  projectSelectionStore.actions.select(notification.host_id, notification.project_id);
  projectTabsStore.actions.open(projectSwitcherKey(notification.host_id, notification.project_id));
}
