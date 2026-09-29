import type {
  ProviderOptionKey,
  ProviderOptions,
  ProviderOptionSet,
  RunDetail,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  providerOptionSetOptions,
  useRuntimeModels,
  useRuntimeProviderOptions,
  useRuntimes,
} from "@web/api/daemon/queries";
import { useSetNextTurnModel } from "@web/api/runs/step-mutations";
import { useQueryKeys } from "@web/api/use-query-keys";
import { daemonErrorMessage } from "@web/lib/daemon-error";
import { catalogModelLabel } from "@web/lib/model-choice";
import { effortValue, offersEffort, withEffort } from "@web/lib/provider-options";
import { nextTurnRefusal } from "@web/lib/run/next-turn";
import { stepParticipant } from "@web/lib/run/participant";
import { useState } from "react";

interface HeldModel {
  model: string | null;
}

export function useNextTurn(detail: RunDetail, stepRunId: string) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  const runtimes = useRuntimes();
  const [held, setHeld] = useState<HeldModel | null>(null);
  const [reading, setReading] = useState(false);
  const { session, config } = stepParticipant(detail, stepRunId);
  const runtimeId = config?.runtime ?? null;
  const runtime = runtimes.data?.find((descriptor) => descriptor.id === runtimeId);
  const refusal = nextTurnRefusal(
    runtime?.capabilities.resume_model,
    runtimes.isPending,
    runtimes.isError,
    session?.provider_session_id ?? null,
  );
  const revisableRuntimeId = refusal === null ? runtimeId : null;
  const configModel = config?.model?.id ?? null;
  const model = held === null ? configModel : held.model;
  const catalog = useRuntimeModels(revisableRuntimeId);
  const support = useRuntimeProviderOptions(revisableRuntimeId, model);
  const mutation = useSetNextTurnModel(detail.run.id, stepRunId);
  if (config === null) return null;

  const busy = reading || mutation.isPending;
  const effort = effortValue(config.options);

  const apply = (nextModel: string | null, options: ProviderOptions): void => {
    if (session === null) return;
    mutation.mutate(
      {
        agent_session_id: session.id,
        current_config_hash: config.config_hash,
        model: nextModel,
        options,
      },
      { onSuccess: () => setHeld(null) },
    );
  };

  const pickModel = async (nextModel: string | null): Promise<void> => {
    if (busy || revisableRuntimeId === null || nextModel === model) return;
    if (nextModel === configModel) {
      setHeld(null);
      return;
    }
    if (effort === undefined) {
      apply(nextModel, config.options);
      return;
    }
    let announced: ProviderOptionSet;
    setReading(true);
    try {
      announced = await client.fetchQuery(
        providerOptionSetOptions(keys, revisableRuntimeId, nextModel),
      );
    } catch (error) {
      toast.error(
        daemonErrorMessage(
          error,
          `Could not read the efforts ${catalogModelLabel(catalog.data, nextModel)} offers — the next turn is unchanged.`,
        ),
      );
      return;
    } finally {
      setReading(false);
    }
    if (offersEffort(announced, effort)) apply(nextModel, config.options);
    else setHeld({ model: nextModel });
  };

  const pickEffort = (key: ProviderOptionKey, value: string | undefined): void => {
    if (busy || (held === null && value === effort)) return;
    apply(model, withEffort(config.options, key, value));
  };

  const pickOptions = (options: ProviderOptions): void => {
    if (!busy) apply(configModel, options);
  };

  return {
    config,
    effort,
    refusal,
    catalog,
    support,
    configModel,
    model,
    incompatible:
      effort !== undefined && support.data !== undefined && !offersEffort(support.data, effort),
    release: () => setHeld(null),
    pickModel,
    pickEffort,
    pickOptions,
    pending: busy,
  };
}
