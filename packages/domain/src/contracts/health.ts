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
  started_at: z.iso.datetime(),
  db_path: z.string(),
  schema: schemaMetadataSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
