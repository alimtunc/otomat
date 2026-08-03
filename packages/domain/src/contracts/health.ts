import { z } from "zod";

export const schemaMetadataSchema = z.object({
  migration_count: z.number().int().nonnegative(),
  latest_migration_at: z.number().int().nonnegative().nullable(),
  page_count: z.number().int().nonnegative(),
  page_size: z.number().int().positive(),
});
export type SchemaMetadataContract = z.infer<typeof schemaMetadataSchema>;

/** Daemon liveness/identity surface served at `GET /api/health`. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  name: z.string(),
  version: z.string(),
  /** Git commit the daemon was built from (baked into the dist bundle); null for an unstamped source run. Defaulted so a daemon deployed before the field existed still parses; a null build is never treated as stale, so such a daemon is not auto-restarted. */
  build: z.string().nullable().default(null),
  started_at: z.iso.datetime(),
  db_path: z.string(),
  schema: schemaMetadataSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
