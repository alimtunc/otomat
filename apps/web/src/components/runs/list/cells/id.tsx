import type { RunContract } from "@otomat/domain";
import { FOCUS_RING_INSET } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { TableCellProps } from "@web/lib/table";

export function RunIdCell({ row, getValue }: TableCellProps<RunContract, string>) {
  return (
    <Link
      to="/runs/$runId"
      params={{ runId: row.original.id }}
      className={`flex h-full items-center px-3 after:absolute after:inset-0 ${FOCUS_RING_INSET}`}
    >
      {getValue()}
    </Link>
  );
}
