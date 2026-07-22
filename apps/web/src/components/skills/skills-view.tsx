import { Button, EmptyState, ErrorState, Icon, Skeleton } from "@otomat/ui";
import { useScanSkills } from "@web/api/skills/mutations";
import { useSkills } from "@web/api/skills/queries";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { SkillRow } from "@web/components/skills/skill-row";

export function SkillsView() {
  const skills = useSkills();
  const scan = useScanSkills();

  return (
    <RouteShell
      active="skills"
      titleIcon="book"
      titleNote="Declarative instructions discovered from local roots; never executed by Otomat."
      breadcrumbs={[{ label: "Skills", current: true }]}
      actions={
        <Button variant="outline" size="sm" loading={scan.isPending} onClick={() => scan.mutate()}>
          <Icon name="search" aria-hidden />
          Rescan
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-3xl p-4">
        <div className="rounded-lg border border-border-subtle bg-card">
          <QueryList
            query={skills}
            pending={<Skeleton className="m-4" height={40} />}
            error={
              <ErrorState
                variant="inline"
                title="Couldn’t load skills"
                onRetry={() => void skills.refetch()}
              />
            }
            empty={
              <CenteredState>
                <EmptyState
                  icon="book"
                  title="No skills found"
                  description="Otomat scans .agents/skills and .claude/skills in your registered repositories and ~/.claude/skills. Add a SKILL.md there, then rescan."
                  action={
                    <Button variant="outline" size="sm" onClick={() => scan.mutate()}>
                      Rescan
                    </Button>
                  }
                />
              </CenteredState>
            }
          >
            {(items) => (
              <div className="divide-y divide-border-subtle">
                {items.map((skill) => (
                  <SkillRow key={skill.id} skill={skill} />
                ))}
              </div>
            )}
          </QueryList>
        </div>
      </div>
    </RouteShell>
  );
}
