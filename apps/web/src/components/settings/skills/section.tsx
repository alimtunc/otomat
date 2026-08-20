import { Button, EmptyState, ErrorState, Icon, Skeleton } from "@otomat/ui";
import { useScanSkills } from "@web/api/skills/mutations";
import { useSkills } from "@web/api/skills/queries";
import { SectionHeading } from "@web/components/settings/section-heading";
import { SkillRow } from "@web/components/settings/skills/row";
import { QueryList } from "@web/components/shell/query-list";

export function SkillsSection() {
  const skills = useSkills();
  const scan = useScanSkills();

  return (
    <div>
      <SectionHeading
        title="Skills"
        description="Declarative instructions discovered from local roots; never executed by Otomat. Enable a skill here before a profile can activate it."
      />
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" loading={scan.isPending} onClick={() => scan.mutate()}>
          <Icon name="search" aria-hidden />
          Rescan
        </Button>
      </div>
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
            <EmptyState
              icon="book"
              variant="inline"
              title="No skills found"
              description="Otomat scans .agents/skills and .claude/skills in your registered repositories and ~/.claude/skills. Add a SKILL.md there, then rescan."
              action={
                <Button variant="outline" size="sm" onClick={() => scan.mutate()}>
                  Rescan
                </Button>
              }
            />
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
  );
}
