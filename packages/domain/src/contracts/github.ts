import { z } from "zod";

export const GITHUB_CONNECTION_STATES = [
  "not_installed",
  "cli_outdated",
  "disconnected",
  "connecting",
  "connected",
  "failed",
] as const;

export const githubDeviceAuthorizationSchema = z.object({
  user_code: z.string(),
  verification_url: z.string(),
});
export type GitHubDeviceAuthorization = z.infer<typeof githubDeviceAuthorizationSchema>;

export const githubConnectionContractSchema = z.object({
  status: z.enum(GITHUB_CONNECTION_STATES),
  login: z.string().nullable(),
  /** Defaulted so a pre-field daemon's connection payload still parses. */
  device_authorization: githubDeviceAuthorizationSchema.nullable().default(null),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
});
export type GitHubConnectionContract = z.infer<typeof githubConnectionContractSchema>;
