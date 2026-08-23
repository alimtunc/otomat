import { useRunDetail } from "@web/api/runs/queries";
import { RailSection } from "@web/components/issues/workspace/rail/rail-primitives";
import { ProviderWaitPanel } from "@web/components/runs/provider-wait/panel";
import { providerWaitTarget } from "@web/lib/run/provider-wait";

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
