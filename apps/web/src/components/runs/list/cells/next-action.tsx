import type { RunContract } from "@otomat/domain";
import { NextActionCtaButton } from "@web/components/runs/next-action/cta";
import { resolveNextAction } from "@web/lib/run/next-action";
import type { TableCellProps } from "@web/lib/table";

export function RunNextActionCell({ row }: TableCellProps<RunContract, unknown>) {
  const action = resolveNextAction({ status: row.original.status });
  if (action.cta === null) return null;
  return (
    <NextActionCtaButton
      runId={row.original.id}
      cta={action.cta}
      size="xs"
      className="relative z-[1]"
    />
  );
}
