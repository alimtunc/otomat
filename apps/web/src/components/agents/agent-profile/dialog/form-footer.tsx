import type { AgentProfileContract } from "@otomat/domain";
import { Button, DialogFooter } from "@otomat/ui";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";
import { isCompleteModelSelection } from "@web/lib/model-choice";

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
      <form.Subscribe
        selector={(state) => [state.values.name, state.values.runtime, state.values.model] as const}
      >
        {([name, runtime, model]) => (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={
              name.trim().length === 0 ||
              runtime.length === 0 ||
              !isCompleteModelSelection(model) ||
              isPending
            }
          >
            {profile ? "Save changes" : "Create profile"}
          </Button>
        )}
      </form.Subscribe>
    </DialogFooter>
  );
}
