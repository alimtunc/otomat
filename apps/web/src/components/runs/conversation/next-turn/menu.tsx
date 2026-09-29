import { codexPermissionProblem, type RunDetail } from "@otomat/domain";
import {
  ConfigMenu,
  ConfigMenuContent,
  ConfigMenuNote,
  ConfigMenuProblem,
  ConfigMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
} from "@otomat/ui";
import { ExecutionOptionSubmenu } from "@web/components/execution/execution-option-submenu";
import { modelLabel } from "@web/lib/execution/labels";
import { catalogModelLabel } from "@web/lib/model-choice";
import { effortDescriptor } from "@web/lib/provider-options";

import { NextTurnModelSubmenu } from "./model-submenu";
import { NextTurnPermissions } from "./permissions";
import { useNextTurn } from "./use-next-turn";

const APPLIES_NOTE =
  "Applies from the next turn on this step. Turns already launched keep their configuration.";

export function NextTurnMenu({ detail, stepRunId }: { detail: RunDetail; stepRunId: string }) {
  const turn = useNextTurn(detail, stepRunId);
  if (turn === null) return null;
  const { config, effort } = turn;
  const descriptor = effortDescriptor(turn.support.data);
  const current = catalogModelLabel(turn.catalog.data, turn.configModel);
  const summary = effort === undefined ? current : `${current} · ${effort}`;
  const picked = catalogModelLabel(turn.catalog.data, turn.model);

  return (
    <>
      <ConfigMenu onOpenChange={turn.release}>
        <ConfigMenuTrigger
          size="xs"
          label="Next turn"
          summary={summary}
          leading={<Icon name="cpu" aria-hidden className="shrink-0" />}
          detail={`${modelLabel(config.model)}${effort === undefined ? "" : ` · effort ${effort}`}. ${APPLIES_NOTE}`}
          pending={turn.pending}
        />
        <ConfigMenuContent aria-label="Next turn settings">
          <ConfigMenuNote>{APPLIES_NOTE}</ConfigMenuNote>
          {turn.refusal === null ? (
            <>
              <DropdownMenuSeparator />
              <NextTurnModelSubmenu
                catalog={turn.catalog.data}
                catalogPending={turn.catalog.isPending}
                catalogError={turn.catalog.isError}
                model={turn.model}
                onPick={(model) => void turn.pickModel(model)}
              />
              {turn.incompatible ? (
                <ConfigMenuNote>
                  {descriptor === undefined
                    ? `${picked} takes no effort: switch without one, or pick another model.`
                    : `${picked} does not offer effort ${effort}. Choose an effort it offers.`}
                </ConfigMenuNote>
              ) : null}
              {descriptor === undefined ? null : (
                <ExecutionOptionSubmenu
                  level="turn"
                  profileName={config.profile_name}
                  option={{
                    key: descriptor.key,
                    descriptor,
                    resolved: {
                      value: effort ?? null,
                      source: config.sources?.options[descriptor.key] ?? "turn",
                    },
                  }}
                  selection={effort === undefined ? undefined : { kind: "value", value: effort }}
                  onSelectionChange={(selection) =>
                    turn.pickEffort(
                      descriptor.key,
                      selection?.kind === "value" ? selection.value : undefined,
                    )
                  }
                />
              )}
              {turn.support.isPending ? (
                <ConfigMenuNote>Checking the efforts this model offers…</ConfigMenuNote>
              ) : null}
              {turn.support.isError ? (
                <ConfigMenuProblem
                  message="Could not read this runtime's options."
                  onRetry={() => void turn.support.refetch()}
                />
              ) : null}
              {turn.incompatible && descriptor === undefined ? (
                <DropdownMenuItem onClick={() => turn.pickEffort("effort", undefined)}>
                  Switch without an effort
                </DropdownMenuItem>
              ) : null}
            </>
          ) : (
            <ConfigMenuNote>{turn.refusal}</ConfigMenuNote>
          )}
        </ConfigMenuContent>
      </ConfigMenu>
      {config.runtime === "codex" && turn.refusal === null && turn.support.data ? (
        <NextTurnPermissions
          value={config.options}
          onChange={turn.pickOptions}
          support={turn.support.data}
          error={codexPermissionProblem(config.options)}
        />
      ) : null}
    </>
  );
}
