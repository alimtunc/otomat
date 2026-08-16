import { ErrorState, Skeleton } from "@otomat/ui";
import { usePullRequestGenerator } from "@web/api/daemon/queries";
import { PullRequestGeneratorForm } from "@web/components/settings/pr-generator/form";
import { SectionHeading } from "@web/components/settings/section-heading";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function PullRequestGeneratorSection() {
  const query = usePullRequestGenerator();

  return (
    <div>
      <SectionHeading
        title="PR metadata generator"
        description="The runtime, model and effort that write a pull request's title, description, branch and publication commit."
      />
      <QueryBoundary
        query={query}
        pending={<Skeleton height={32} />}
        error={
          <ErrorState
            variant="inline"
            title="The daemon did not report its PR metadata generator."
            onRetry={() => void query.refetch()}
          />
        }
      >
        {(generator) => <PullRequestGeneratorForm generator={generator} />}
      </QueryBoundary>
    </div>
  );
}
