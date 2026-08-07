import type { ProviderOptions } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useRuntimeProviderOptions } from "@web/api/daemon/queries";
import { ProviderOptionField } from "@web/components/agents/agent-profile/dialog/provider-option-field";
import { providerOptionKeyLabel } from "@web/lib/provider-option-labels";
import {
  providerOptionsNote,
  unofferedProviderOptions,
  withProviderOption,
  type StoredProviderOption,
} from "@web/lib/provider-options";

/** A stored key this runtime and model do not offer at all: named, not silently dropped. */
function unofferedWarning(stored: StoredProviderOption): string {
  const name = providerOptionKeyLabel(stored.key);
  return `This profile stores ${name} “${stored.value}”, which this runtime and model do not offer. A launch with it is refused.`;
}

export interface ProviderOptionsFieldsProps {
  /** Null while no runtime is chosen: nothing can be detected yet. */
  runtime: string | null;
  /** The model the options are scoped to; null asks for the provider default's set. */
  model: string | null;
  options: ProviderOptions;
  onOptionsChange: (options: ProviderOptions) => void;
}

/**
 * Every option the installed CLI announces for the chosen runtime and model,
 * rendered from the daemon's descriptors. There is no per-provider branch here:
 * a runtime that announces nothing simply renders no field.
 */
export function ProviderOptionsFields({
  runtime,
  model,
  options,
  onOptionsChange,
}: ProviderOptionsFieldsProps) {
  const detected = useRuntimeProviderOptions(runtime, model);
  const pending = runtime !== null && detected.isPending;
  const note = providerOptionsNote(detected.data, pending, detected.isError);

  return (
    <div className="flex flex-col gap-3">
      {(detected.data?.options ?? []).map((descriptor) => (
        <ProviderOptionField
          key={descriptor.key}
          descriptor={descriptor}
          value={options[descriptor.key] ?? null}
          onValueChange={(value) =>
            onOptionsChange(withProviderOption(options, descriptor.key, value))
          }
        />
      ))}
      {unofferedProviderOptions(options, detected.data).map((stored) => (
        <div key={stored.key} className="flex flex-col gap-1.5 rounded-md bg-danger-bg p-2">
          <p role="alert" className="text-xs text-danger">
            {unofferedWarning(stored)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="self-start"
            onClick={() => onOptionsChange(withProviderOption(options, stored.key, null))}
          >
            Remove it
          </Button>
        </div>
      ))}
      {note === null ? null : <p className="text-xs text-text-tertiary">{note}</p>}
      {detected.isError ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="self-start"
          onClick={() => void detected.refetch()}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}
