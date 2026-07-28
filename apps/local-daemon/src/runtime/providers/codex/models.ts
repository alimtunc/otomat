import { modelIdSchema, type RuntimeModel } from "@otomat/domain";
import { z } from "zod";

import { firstMeaningfulLine, probeProviderCommand } from "#runtime/models/discovery";
import type { ModelDiscoveryResult, RuntimeModelSupport } from "#runtime/models/support";

/** `--bundled` dumps the catalog shipped inside the installed binary: no network call, no account lookup. */
const CODEX_MODEL_LIST_ARGS = ["debug", "models", "--bundled"] as const;

const CODEX_DISCOVERY_DETAIL = `Listed by \`codex ${CODEX_MODEL_LIST_ARGS.join(" ")}\` from the installed binary.`;

/** Only the entries the CLI itself lists; `hide` marks internal or retired slugs. */
const LISTED_VISIBILITY = "list";

const codexCatalogSchema = z.object({
  models: z.array(
    z.object({
      slug: z.string(),
      display_name: z.string().nullish(),
      description: z.string().nullish(),
      visibility: z.string().nullish(),
      priority: z.number().nullish(),
    }),
  ),
});

type CodexCatalogEntry = z.infer<typeof codexCatalogSchema>["models"][number];

function toRuntimeModel(entry: CodexCatalogEntry): RuntimeModel | null {
  const id = modelIdSchema.safeParse(entry.slug);
  if (!id.success) return null;
  return {
    id: id.data,
    label: entry.display_name ?? id.data,
    description: entry.description ?? null,
    source: "discovered",
  };
}

function parseCatalog(stdout: string): { models: RuntimeModel[] } | { error: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const parsed = codexCatalogSchema.safeParse(payload);
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };
  return {
    models: parsed.data.models
      .filter((entry) => entry.visibility === LISTED_VISIBILITY)
      .toSorted(
        (left, right) =>
          (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER),
      )
      .map(toRuntimeModel)
      .filter((model): model is RuntimeModel => model !== null),
  };
}

/** Feature-detected against the installed binary: an older Codex without the listing degrades to an honest unsupported catalog. */
export function discoverCodexModels(binary: string): ModelDiscoveryResult {
  const outcome = probeProviderCommand(binary, CODEX_MODEL_LIST_ARGS);
  if (outcome.status !== "ok") {
    return { discovery: { status: outcome.status, detail: outcome.detail }, models: [] };
  }
  const parsed = parseCatalog(outcome.stdout);
  if ("error" in parsed) {
    return {
      discovery: {
        status: "failed",
        detail: `codex returned a model catalog Otomat cannot read: ${firstMeaningfulLine(parsed.error)}`,
      },
      models: [],
    };
  }
  return { discovery: { status: "ok", detail: CODEX_DISCOVERY_DETAIL }, models: parsed.models };
}

/** Codex ships no Otomat-maintained static set: its own binary is the only honest source, and anything else is an explicit manual identifier. */
export function codexModelSupport(binary: string): RuntimeModelSupport {
  return {
    allowsCustom: true,
    staticModels: [],
    discover: () => discoverCodexModels(binary),
  };
}
