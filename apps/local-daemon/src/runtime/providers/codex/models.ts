import { modelIdSchema, type BinaryProbe, type RuntimeModel } from "@otomat/domain";
import { z } from "zod";

import type { ModelDiscoveryResult, RuntimeModelSupport } from "#runtime/models/support";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { firstMeaningfulLine } from "#runtime/probe/command";

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
      /** The reasoning level this model runs at when no override is sent. */
      default_reasoning_level: z.string().nullish(),
      /** Every reasoning level this model accepts; absent on a catalog that does not publish them. */
      supported_reasoning_levels: z.array(z.string()).nullish(),
    }),
  ),
});

export type CodexCatalogEntry = z.infer<typeof codexCatalogSchema>["models"][number];

/** The installed binary's bundled catalog, or an honest probe verdict and no entries. */
export interface CodexBundledCatalog {
  probe: BinaryProbe;
  entries: CodexCatalogEntry[];
}

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

function parseCatalog(stdout: string): { entries: CodexCatalogEntry[] } | { error: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const parsed = codexCatalogSchema.safeParse(payload);
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };
  return {
    entries: parsed.data.models.toSorted(
      (left, right) =>
        (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER),
    ),
  };
}

/** Feature-detected against the installed binary: an older Codex without the listing degrades to an honest unsupported catalog. */
export function codexBundledCatalog(binary: string): CodexBundledCatalog {
  const probe = cachedProviderProbe(binary, CODEX_MODEL_LIST_ARGS);
  if (probe.status !== "ok") {
    return { probe: { status: probe.status, detail: probe.detail }, entries: [] };
  }
  const parsed = parseCatalog(probe.stdout);
  if ("error" in parsed) {
    return {
      probe: {
        status: "failed",
        detail: `codex returned a model catalog Otomat cannot read: ${firstMeaningfulLine(parsed.error)}`,
      },
      entries: [],
    };
  }
  return { probe: { status: "ok", detail: CODEX_DISCOVERY_DETAIL }, entries: parsed.entries };
}

export function discoverCodexModels(binary: string): ModelDiscoveryResult {
  const { probe, entries } = codexBundledCatalog(binary);
  return {
    discovery: probe,
    models: entries
      .filter((entry) => entry.visibility === LISTED_VISIBILITY)
      .map(toRuntimeModel)
      .filter((model): model is RuntimeModel => model !== null),
  };
}

/** Codex ships no Otomat-maintained static set: its own binary is the only honest source, and anything else is an explicit manual identifier. */
export function codexModelSupport(binary: string): RuntimeModelSupport {
  return {
    allowsCustom: true,
    staticModels: [],
    discover: () => discoverCodexModels(binary),
  };
}
