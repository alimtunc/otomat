import { linearError } from "./errors.js";

const LINEAR_API_URL = "https://api.linear.app/graphql";

export interface LinearTransportRequest {
  query: string;
  variables: Record<string, unknown>;
  apiKey: string;
  signal?: AbortSignal;
}

export interface LinearTransportResponse {
  status: number;
  body: unknown;
}

export type LinearTransport = (request: LinearTransportRequest) => Promise<LinearTransportResponse>;

export const LINEAR_REQUEST_TIMEOUT_MS = 10_000;

export function createLinearTransport(): LinearTransport {
  return async ({ query, variables, apiKey, signal: requestSignal }) => {
    let response: Response;
    const timeoutSignal = AbortSignal.timeout(LINEAR_REQUEST_TIMEOUT_MS);
    try {
      response = await fetch(LINEAR_API_URL, {
        method: "POST",
        signal:
          requestSignal === undefined
            ? timeoutSignal
            : AbortSignal.any([requestSignal, timeoutSignal]),
        headers: { "content-type": "application/json", authorization: apiKey },
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      throw linearError("linear_unavailable", error);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      throw linearError(
        timeoutSignal.aborted ? "linear_unavailable" : "linear_request_failed",
        error,
      );
    }
    let body: unknown = null;
    if (text !== "") {
      try {
        body = JSON.parse(text);
      } catch (error) {
        throw linearError("linear_request_failed", error);
      }
    }

    return { status: response.status, body };
  };
}
