export const DAEMON_PORT = 4331;
export const CLIENT_ID_HEADER = "cf-access-client-id";
export const CLIENT_SECRET_HEADER = "cf-access-client-secret";

// Comparing SHA-256 digests keeps the check constant-time with WebCrypto alone, which both
// workerd and the node test runner have.
async function digestsMatch(given, expected) {
  const encoder = new TextEncoder();
  const [left, right] = (
    await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(given)),
      crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    ])
  ).map((digest) => new Uint8Array(digest));
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

/** Fail closed: a worker deployed without its client pair answers nobody, not everybody. */
export async function authorizedClient(headers, env) {
  const id = env.PREVIEW_CLIENT_ID ?? "";
  const secret = env.PREVIEW_CLIENT_SECRET ?? "";
  if (id === "" || secret === "") return false;
  const [idMatches, secretMatches] = await Promise.all([
    digestsMatch(headers.get(CLIENT_ID_HEADER) ?? "", id),
    digestsMatch(headers.get(CLIENT_SECRET_HEADER) ?? "", secret),
  ]);
  return idMatches && secretMatches;
}

/** The daemon's hostGuard only admits a loopback `Host`, so the upstream URL pins one. */
export function daemonUrl(requestUrl) {
  const url = new URL(requestUrl);
  return new URL(`${url.pathname}${url.search}`, `http://127.0.0.1:${String(DAEMON_PORT)}`);
}
