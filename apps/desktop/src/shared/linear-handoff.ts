import { createDaemonClient, DaemonRequestError } from "@otomat/client";
import {
  linearErrorSchema,
  type LinearConnectionContract,
  type LinearErrorCode,
} from "@otomat/domain";

interface LinearHandoffOptions {
  daemonUrl: string;
  apiKey: string;
}

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

export async function pushLinearKey(options: LinearHandoffOptions): Promise<void> {
  const client = createDaemonClient({ baseUrl: options.daemonUrl });
  let connection: LinearConnectionContract;
  try {
    connection = await client.connectLinear({ api_key: options.apiKey });
  } catch (error) {
    if (error instanceof DaemonRequestError) {
      const refusal = linearErrorSchema.safeParse(error.body);
      if (refusal.success) {
        throw new LinearHandoffError(refusal.data.error, refusal.data.message, { cause: error });
      }
    }
    throw error;
  }
  if (connection.status !== "connected") {
    if (connection.status === "failed") {
      throw new LinearHandoffError(connection.error_code, connection.error_message);
    }
    throw new Error("The daemon did not connect to Linear.");
  }
}

export async function clearLinearKey(daemonUrl: string): Promise<void> {
  await createDaemonClient({ baseUrl: daemonUrl }).disconnectLinear();
}
