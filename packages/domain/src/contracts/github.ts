import { z } from "zod";

export const GITHUB_CONNECTION_STATES = [
  "not_installed",
  "disconnected",
  "connecting",
  "connected",
  "failed",
] as const;

export const githubConnectionContractSchema = z.object({
  status: z.enum(GITHUB_CONNECTION_STATES),
  login: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
});
export type GitHubConnectionContract = z.infer<typeof githubConnectionContractSchema>;
