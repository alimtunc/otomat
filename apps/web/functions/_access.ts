// Follows https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/.

export interface AccessEnv {
  OTOMAT_PREVIEW_ACCESS_TEAM_DOMAIN?: string;
  OTOMAT_PREVIEW_ACCESS_AUD?: string;
}

const JWT_HEADER = "cf-access-jwt-assertion";
const KEYS_TTL_MS = 10 * 60_000;

interface CachedKeys {
  fetchedAt: number;
  keys: Map<string, CryptoKey>;
}

let cachedKeys: CachedKeys | undefined;

function refusal(error: string, message: string): Response {
  return Response.json({ error, message }, { status: 403 });
}

function denied(detail: string): Response {
  return refusal("preview_access_denied", `The Access identity could not be verified: ${detail}`);
}

function decodeSegment(segment: string): Uint8Array<ArrayBuffer> {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.codePointAt(0) ?? 0);
}

function decodedText(segment: string): string {
  return new TextDecoder().decode(decodeSegment(segment));
}

async function importedKeys(certs: unknown): Promise<Map<string, CryptoKey>> {
  const keys = new Map<string, CryptoKey>();
  // SAFETY: narrowed to a non-null object first; the field itself is checked for being an array.
  const list =
    typeof certs === "object" && certs !== null ? (certs as { keys?: unknown }).keys : [];
  for (const jwk of Array.isArray(list) ? list : []) {
    // SAFETY: a malformed entry fails `importKey` and is reported as a denial by the caller.
    const candidate = jwk as JsonWebKey & { kid?: string };
    if (typeof candidate.kid !== "string") continue;
    keys.set(
      candidate.kid,
      await crypto.subtle.importKey(
        "jwk",
        candidate,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }
  return keys;
}

async function signingKey(
  team: string,
  kid: string,
  fetchImpl: typeof fetch,
): Promise<CryptoKey | null> {
  if (
    cachedKeys !== undefined &&
    Date.now() - cachedKeys.fetchedAt <= KEYS_TTL_MS &&
    cachedKeys.keys.has(kid)
  ) {
    return cachedKeys.keys.get(kid) ?? null;
  }
  const response = await fetchImpl(`https://${team}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new Error(`the Access key set answered ${String(response.status)}`);
  }
  cachedKeys = { fetchedAt: Date.now(), keys: await importedKeys(await response.json()) };
  return cachedKeys.keys.get(kid) ?? null;
}

function claimsValid(payload: unknown, team: string, aud: string): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  // SAFETY: narrowed to a non-null object above; every claim read below is validated on its own.
  const claims = payload as { aud?: unknown; iss?: unknown; exp?: unknown };
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(aud)) return false;
  if (claims.iss !== `https://${team}`) return false;
  return typeof claims.exp === "number" && claims.exp * 1000 > Date.now();
}

/** Null when the request carries a verified Access identity; otherwise the refusal to answer with. */
export async function accessRefusal(
  request: Request,
  env: AccessEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const team = env.OTOMAT_PREVIEW_ACCESS_TEAM_DOMAIN ?? "";
  const aud = env.OTOMAT_PREVIEW_ACCESS_AUD ?? "";
  if (team === "" || aud === "") {
    return refusal(
      "preview_access_unconfigured",
      "Access verification is not configured for this preview, so its daemon hop stays closed.",
    );
  }
  const token = request.headers.get(JWT_HEADER);
  if (token === null) return denied("no Access identity reached the preview origin");
  const [headerSegment, payloadSegment, signatureSegment] = token.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    return denied("the token is not a JWT");
  }
  try {
    const header: { alg?: unknown; kid?: unknown } = JSON.parse(decodedText(headerSegment));
    if (header.alg !== "RS256" || typeof header.kid !== "string") {
      return denied("the token names no RS256 signing key");
    }
    const key = await signingKey(team, header.kid, fetchImpl);
    if (key === null) return denied("the token's signing key is not in the Access key set");
    const authentic = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeSegment(signatureSegment),
      new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
    if (!authentic) return denied("the signature does not match");
    if (!claimsValid(JSON.parse(decodedText(payloadSegment)), team, aud)) {
      return denied("the token is expired or names another application");
    }
    return null;
  } catch (error) {
    return denied(error instanceof Error ? error.message : String(error));
  }
}
