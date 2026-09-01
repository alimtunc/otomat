import { Button, EmptyState, ErrorState, Icon, Skeleton } from "@otomat/ui";
import { useScanSkills } from "@web/api/skills/mutations";
import { useSkills } from "@web/api/skills/queries";
import { SkillRow } from "@web/components/settings/skills/row";
import { QueryList } from "@web/components/shell/query-list";

export function SkillCatalogPanel({
  owner,
  emptyTitle,
  emptyDescription,
}: {
  owner: string | null;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const skills = useSkills();
  const scan = useScanSkills();

  const rescan = (
    <Button variant="outline" size="sm" loading={scan.isPending} onClick={() => scan.mutate()}>
      <Icon name="search" aria-hidden />
      Rescan
    </Button>
  );
  const empty = (
    <EmptyState
      icon="book"
      variant="inline"
      title={emptyTitle}
      description={emptyDescription}
      action={rescan}
    />
  );

  return (
    <>
      <div className="mb-4 flex justify-end">{rescan}</div>
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
          empty={empty}
        >
          {(items) => {
            const owned = items.filter((skill) => skill.project_id === owner);
            if (owned.length === 0) return empty;
            return (
              <div className="divide-y divide-border-subtle">
                {owned.map((skill) => (
                  <SkillRow key={skill.id} skill={skill} />
                ))}
              </div>
            );
          }}
        </QueryList>
      </div>
    </>
  );
}
