/** Sleeps without unreffing the timer: the pollers that use it must keep their process alive until the deadline. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
