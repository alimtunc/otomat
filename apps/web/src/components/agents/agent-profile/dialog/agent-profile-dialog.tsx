import type { AgentProfileContract } from "@otomat/domain";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ErrorState,
} from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { useSkills } from "@web/api/skills/queries";
import { AgentProfileForm } from "@web/components/agents/agent-profile/dialog/form";
import { AgentProfileDialogLoading } from "@web/components/agents/agent-profile/dialog/loading";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export interface AgentProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AgentProfileContract | null;
}

export function AgentProfileDialog({ open, onOpenChange, profile }: AgentProfileDialogProps) {
  const runtimes = useRuntimes();
  const skills = useSkills();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={profile ? "Edit agent profile" : "New agent profile"}
        className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>{profile ? "Edit agent profile" : "New agent profile"}</DialogTitle>
        </DialogHeader>
        <QueryBoundary
          query={runtimes}
          pending={<AgentProfileDialogLoading />}
          error={
            <DialogBody>
              <ErrorState
                variant="compact"
                title="Couldn’t load runtimes"
                onRetry={() => void runtimes.refetch()}
              />
            </DialogBody>
          }
        >
          {(descriptors) => (
            <QueryBoundary
              query={skills}
              pending={<AgentProfileDialogLoading />}
              error={
                <DialogBody>
                  <ErrorState
                    variant="compact"
                    title="Couldn’t load the skill catalog"
                    onRetry={() => void skills.refetch()}
                  />
                </DialogBody>
              }
            >
              {(skillCatalog) => (
                <AgentProfileForm
                  profile={profile}
                  descriptors={descriptors}
                  skills={skillCatalog}
                  onSaved={() => onOpenChange(false)}
                  onCancel={() => onOpenChange(false)}
                />
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}
