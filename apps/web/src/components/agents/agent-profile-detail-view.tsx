import type { AgentProfileContract } from "@otomat/domain";
import { Button, EmptyState, ErrorState, Skeleton, toast } from "@otomat/ui";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useDeleteAgentProfile, useDuplicateAgentProfile } from "@web/api/agent-profiles/mutations";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { useSkills } from "@web/api/skills/queries";
import { AgentProfileDetail } from "@web/components/agents/agent-profile-detail";
import { AgentProfileDialog } from "@web/components/agents/agent-profile-dialog";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { useState } from "react";

function DetailSkeleton() {
  return (
    <div className="grid min-h-full grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="border-b border-border-subtle bg-sidebar p-4 lg:border-r lg:border-b-0">
        <Skeleton width={40} height={40} className="mb-2" />
        <Skeleton width="60%" height={18} className="mb-4" />
        <Skeleton width="100%" height={116} className="mb-2.5" />
        <Skeleton width="100%" height={176} />
      </div>
      <div className="p-4.5">
        <Skeleton width={180} height={34} className="mb-4.5" />
        <Skeleton width="min(720px,100%)" height={280} />
      </div>
    </div>
  );
}

function HeaderActions({ profile }: { profile: AgentProfileContract }) {
  const navigate = useNavigate();
  const duplicate = useDuplicateAgentProfile();
  const remove = useDeleteAgentProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        {confirmingDelete ? (
          <>
            <Button
              variant="destructive"
              size="xs"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(profile.id, {
                  onSuccess: () => {
                    toast.success("Profile deleted");
                    void navigate({ to: "/agents" });
                  },
                  onError: () => toast.error("Could not delete the profile."),
                })
              }
            >
              Confirm delete
            </Button>
            <Button autoFocus variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="xs" onClick={() => setDialogOpen(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="xs"
              loading={duplicate.isPending}
              onClick={() =>
                duplicate.mutate(profile.id, {
                  onSuccess: (copy) => {
                    toast.success("Profile duplicated");
                    void navigate({
                      to: "/agents/$profileId",
                      params: { profileId: copy.id },
                    });
                  },
                  onError: () => toast.error("Could not duplicate the profile."),
                })
              }
            >
              Duplicate
            </Button>
            <Button variant="destructive" size="xs" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </>
        )}
      </div>

      {dialogOpen ? (
        <AgentProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} profile={profile} />
      ) : null}
    </>
  );
}

function NotFoundState() {
  return (
    <CenteredState>
      <EmptyState
        icon="bot"
        title="Agent profile not found"
        description="It may have been deleted or duplicated under a different identifier."
        action={
          <Button variant="outline" size="sm" render={<Link to="/agents" />}>
            Back to agents
          </Button>
        }
      />
    </CenteredState>
  );
}

export function AgentProfileDetailView() {
  const { profileId } = useParams({ from: "/agents/$profileId" });
  const profiles = useAgentProfiles();
  const runtimes = useRuntimes();
  const skills = useSkills();
  const profile = profiles.data?.find((candidate) => candidate.id === profileId);

  return (
    <RouteShell
      active="agents"
      breadcrumbs={[
        { label: "Agents", href: "/agents" },
        { label: profile?.name ?? "Profile", current: true },
      ]}
      actions={profile ? <HeaderActions profile={profile} /> : null}
    >
      <QueryList
        query={profiles}
        pending={<DetailSkeleton />}
        error={
          <CenteredState>
            <ErrorState
              title="Couldn’t load the agent profile"
              onRetry={() => void profiles.refetch()}
            />
          </CenteredState>
        }
        empty={<NotFoundState />}
      >
        {(items) => {
          const selectedProfile = items.find((candidate) => candidate.id === profileId);
          if (!selectedProfile) return <NotFoundState />;
          return (
            <QueryBoundary
              query={runtimes}
              pending={<DetailSkeleton />}
              error={
                <CenteredState>
                  <ErrorState
                    title="Couldn’t load runtime capabilities"
                    onRetry={() => void runtimes.refetch()}
                  />
                </CenteredState>
              }
            >
              {(descriptors) => (
                <QueryBoundary
                  query={skills}
                  pending={<DetailSkeleton />}
                  error={
                    <CenteredState>
                      <ErrorState
                        title="Couldn’t load the skill catalog"
                        onRetry={() => void skills.refetch()}
                      />
                    </CenteredState>
                  }
                >
                  {(skillCatalog) => (
                    <AgentProfileDetail
                      profile={selectedProfile}
                      descriptors={descriptors}
                      skills={skillCatalog}
                    />
                  )}
                </QueryBoundary>
              )}
            </QueryBoundary>
          );
        }}
      </QueryList>
    </RouteShell>
  );
}
