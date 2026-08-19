import { setTimeout as sleep } from "node:timers/promises";

import { z } from "zod";

import { GitHubCliError } from "./errors.js";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
// GitHub CLI's public OAuth app: tokens minted through this flow are exactly
// what `gh auth login` would store itself, so `gh` accepts them unchanged.
const GITHUB_CLI_CLIENT_ID = "178c6fc778ccc68e1d6a";
const TOKEN_SCOPES = "repo read:org workflow";

const startResponseSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  expires_in: z.number().positive(),
  interval: z.number().positive(),
});

const tokenResponseSchema = z.union([
  z.object({ access_token: z.string().min(1) }),
  z.object({ error: z.string() }),
]);

export interface DeviceAuthorizationStart {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  intervalMs: number;
  expiresAt: number;
}

export interface DeviceAuthorization {
  start(): Promise<DeviceAuthorizationStart>;
  awaitToken(start: DeviceAuthorizationStart): Promise<string>;
}

export interface DeviceAuthorizationConfig {
  fetchImpl?: typeof fetch;
  delay?: (ms: number) => Promise<void>;
  now?: () => number;
}

function flowError(message: string): GitHubCliError {
  return new GitHubCliError("github_device_flow_failed", message);
}

async function postForm<T>(
  fetchImpl: typeof fetch,
  url: string,
  form: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
  } catch {
    throw flowError("GitHub could not be reached to sign in.");
  }
  if (!response.ok) throw flowError("GitHub rejected the sign-in request.");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw flowError("GitHub returned an invalid sign-in response.");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw flowError("GitHub returned an invalid sign-in response.");
  return parsed.data;
}

export function createDeviceAuthorization(
  config: DeviceAuthorizationConfig = {},
): DeviceAuthorization {
  const fetchImpl = config.fetchImpl ?? fetch;
  const delay = config.delay ?? ((ms: number) => sleep(ms));
  const now = config.now ?? Date.now;

  return {
    async start() {
      const parsed = await postForm(
        fetchImpl,
        DEVICE_CODE_URL,
        { client_id: GITHUB_CLI_CLIENT_ID, scope: TOKEN_SCOPES },
        startResponseSchema,
      );
      return {
        deviceCode: parsed.device_code,
        userCode: parsed.user_code,
        verificationUrl: parsed.verification_uri,
        intervalMs: parsed.interval * 1_000,
        expiresAt: now() + parsed.expires_in * 1_000,
      };
    },

    async awaitToken(start) {
      let intervalMs = start.intervalMs;
      while (now() < start.expiresAt) {
        await delay(intervalMs);
        const parsed = await postForm(
          fetchImpl,
          ACCESS_TOKEN_URL,
          {
            client_id: GITHUB_CLI_CLIENT_ID,
            device_code: start.deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          },
          tokenResponseSchema,
        );
        if ("access_token" in parsed) return parsed.access_token;
        switch (parsed.error) {
          case "authorization_pending":
            break;
          case "slow_down":
            intervalMs += 5_000;
            break;
          case "expired_token":
            throw new GitHubCliError(
              "github_device_login_expired",
              "The GitHub sign-in code expired before it was entered. Start the sign-in again.",
            );
          case "access_denied":
            throw new GitHubCliError(
              "github_device_login_denied",
              "The GitHub sign-in was denied.",
            );
          default:
            throw flowError("GitHub rejected the sign-in request.");
        }
      }
      throw new GitHubCliError(
        "github_device_login_expired",
        "The GitHub sign-in code expired before it was entered. Start the sign-in again.",
      );
    },
  };
}
