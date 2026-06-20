import { useRepositories } from "@web/api/daemon/queries";
import { RepositoriesList } from "@web/components/settings/repositories-list";
import { SectionHeading } from "@web/components/settings/section-heading";

export function RepositoriesSection() {
  const repositories = useRepositories();
  return (
    <div>
      <SectionHeading
        title="Repositories"
        description="Register local git repositories so runs can create isolated worktrees."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <RepositoriesList query={repositories} />
      </div>
    </div>
  );
}
