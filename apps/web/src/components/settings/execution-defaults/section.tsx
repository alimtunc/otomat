import { ErrorState, Skeleton } from "@otomat/ui";
import { useExecutionDefaults } from "@web/api/daemon/queries";
import { ExecutionDefaultsForm } from "@web/components/settings/execution-defaults/form";
import { SectionHeading } from "@web/components/settings/section-heading";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function ExecutionDefaultsSection() {
  const query = useExecutionDefaults();

  return (
    <div>
      <SectionHeading
        title="Execution defaults"
        description="The runtime, model and options every new run falls back to. A step, a launch or an agent profile overrides them; nothing else does."
      />
      <QueryBoundary
        query={query}
        pending={<Skeleton height={32} />}
        error={
          <ErrorState
            variant="inline"
            title="The daemon did not report its execution defaults."
            onRetry={() => void query.refetch()}
          />
        }
      >
        {(defaults) => <ExecutionDefaultsForm defaults={defaults} />}
      </QueryBoundary>
    </div>
  );
}
