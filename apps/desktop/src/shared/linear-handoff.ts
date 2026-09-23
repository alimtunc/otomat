import { createDaemonClient, DaemonRequestError, type DaemonEndpoint } from "@otomat/client";
import {
  linearErrorSchema,
  type ConnectLinearRequest,
  type LinearConnectionContract,
  type LinearErrorCode,
} from "@otomat/domain";

export class LinearHandoffError extends Error {
  constructor(
    readonly code: LinearErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LinearHandoffError";
  }
}

function refusalOf(error: unknown): LinearHandoffError | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const refusal = linearErrorSchema.safeParse(error.body);
  if (!refusal.success) return null;
  return new LinearHandoffError(refusal.data.error, refusal.data.message, { cause: error });
}

export async function pushLinearKey(
  endpoint: DaemonEndpoint,
  request: ConnectLinearRequest,
): Promise<void> {
  let connection: LinearConnectionContract;
  try {
    connection = await createDaemonClient(endpoint).connectLinear(request);
  } catch (error) {
    throw refusalOf(error) ?? error;
  }
  if (connection.status !== "connected") {
    throw new LinearHandoffError(
      connection.error_code ?? "linear_request_failed",
      connection.error_message ?? "The daemon did not connect to Linear.",
    );
  }
}

export async function clearLinearKey(
  endpoint: DaemonEndpoint,
  connectionId: string,
): Promise<void> {
  try {
    await createDaemonClient(endpoint).disconnectLinear(connectionId);
  } catch (error) {
    throw refusalOf(error) ?? error;
  }
}

export function readLinearConnections(
  endpoint: DaemonEndpoint,
): Promise<LinearConnectionContract[]> {
  return createDaemonClient(endpoint).listLinearConnections();
}
