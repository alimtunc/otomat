/** Polls until `pred` is true or the timeout elapses; resolves to the last observed value. */
export async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return pred();
}
