import { z } from "zod";

/** Daemon liveness/identity surface served at `GET /api/health`. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  name: z.string(),
  version: z.string(),
  started_at: z.iso.datetime(),
  db_path: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
