/**
 * The sandbox performs no network call, so a request's origin is irrelevant and only its path is
 * read. This base exists to make the typed client's relative paths parseable in any environment.
 */
const SANDBOX_BASE_URL = "http://sandbox.invalid";

export function sandboxUrl(url: string): URL {
  return new URL(url, SANDBOX_BASE_URL);
}
