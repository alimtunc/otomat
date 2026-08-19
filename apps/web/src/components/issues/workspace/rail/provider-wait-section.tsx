import { useRunDetail } from "@web/api/runs/queries";
import { RailSection } from "@web/components/issues/workspace/rail/rail-primitives";
import { ProviderWaitPanel } from "@web/components/runs/provider-wait/panel";
import { providerWaitTarget } from "@web/lib/run/provider-wait";

/** Renders only for a cycle actually suspended on a quota; the cockpit reports a run detail that could not be read. */
export function ProviderWaitSection({ runId }: { runId: string }) {
  const detail = useRunDetail(runId);
  const target = detail.data === undefined ? null : providerWaitTarget(detail.data);
  if (target === null) return null;

  return (
    <RailSection title="Waiting on provider">
      <ProviderWaitPanel runId={runId} target={target} />
    </RailSection>
  );
}
