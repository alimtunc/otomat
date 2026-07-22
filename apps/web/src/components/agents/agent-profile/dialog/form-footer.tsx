import type { AgentProfileContract } from "@otomat/domain";
import { Button, DialogFooter } from "@otomat/ui";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";

export function AgentProfileFormFooter({
  form,
  profile,
  isPending,
  onCancel,
}: {
  form: AgentProfileFormApi;
  profile: AgentProfileContract | null;
  isPending: boolean;
  onCancel: () => void;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <form.Subscribe selector={(state) => [state.values.name, state.values.runtime] as const}>
        {([name, runtime]) => (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={name.trim().length === 0 || runtime.length === 0 || isPending}
          >
            {profile ? "Save changes" : "Create profile"}
          </Button>
        )}
      </form.Subscribe>
    </DialogFooter>
  );
}
