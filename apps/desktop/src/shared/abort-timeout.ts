export async function withAbortTimeout<T>(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abortFromExternalSignal = (): void => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted === true) abortFromExternalSignal();
  else externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("Operation timed out.")), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}
