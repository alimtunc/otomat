import { linearError } from "./errors.js";
import { LINEAR_API_URL } from "./graphql.js";
import type { LinearTransport } from "./types.js";

function headerRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, name) => {
    record[name.toLowerCase()] = value;
  });
  return record;
}

/**
 * The only place the API key touches the network. A Personal API key is sent as
 * a bare `Authorization` value with no `Bearer` prefix, and no failure path
 * carries the request back out: transport faults become a fixed unavailable
 * error so the key can never reach a log or an HTTP response.
 */
export function createLinearTransport(fetchImpl: typeof fetch = fetch): LinearTransport {
  return async ({ query, variables, apiKey }) => {
    let response: Response;
    try {
      response = await fetchImpl(LINEAR_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: apiKey },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw linearError("linear_unavailable");
    }

    const text = await response.text().catch(() => "");
    let body: unknown = null;
    if (text !== "") {
      try {
        body = JSON.parse(text);
      } catch {
        throw linearError("linear_request_failed");
      }
    }

    return { status: response.status, headers: headerRecord(response.headers), body };
  };
}
