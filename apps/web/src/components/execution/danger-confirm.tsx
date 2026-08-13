import type { ProviderOptionChoice, ProviderOptionKey } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

export interface DangerConfirmProps {
  /** A picked value that removes a boundary, held aside until it is confirmed. */
  pending: { key: ProviderOptionKey; choice: ProviderOptionChoice };
  onConfirm: () => void;
  onCancel: () => void;
}

export function DangerConfirm({ pending, onConfirm, onCancel }: DangerConfirmProps) {
  const head = `${providerOptionValueLabel(pending.choice.value)} removes a safety boundary.`;
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-danger-bg p-2">
      <p role="alert" className="text-xs text-danger">
        {pending.choice.description === null ? head : `${head} ${pending.choice.description}`}
      </p>
      <div className="flex gap-1.5">
        <Button type="button" variant="ghost" size="xs" onClick={onConfirm}>
          Use it anyway
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
          Keep the current value
        </Button>
      </div>
    </div>
  );
}
