import { beforeAll, describe, expect, it } from "vitest";

import { accessRefusal } from "#functions/_access";

const TEAM = "example.cloudflareaccess.com";
const AUD = "3fbe4c70a3fbe4c70a3fbe4c70a3fbe4c70a3fbe4c70a3fbe4c70a3fbe4c70a";
const ENV = { OTOMAT_PREVIEW_ACCESS_TEAM_DOMAIN: TEAM, OTOMAT_PREVIEW_ACCESS_AUD: AUD };

const RSA = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

interface TokenClaims {
  aud: string[];
  iss: string;
  exp: number;
}

interface AccessKeySet {
  keys: JsonWebKey[];
}

let keyPair: CryptoKeyPair;
let strangerPair: CryptoKeyPair;
let certs: AccessKeySet;

function segment(value: TokenClaims | { alg: string; kid: string }): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function token(
  tokenClaims: TokenClaims,
  key: CryptoKey = keyPair.privateKey,
  kid = "preview-key",
): Promise<string> {
  const signed = `${segment({ alg: "RS256", kid })}.${segment(tokenClaims)}`;
  const signature = await crypto.subtle.sign(RSA, key, new TextEncoder().encode(signed));
  return `${signed}.${Buffer.from(signature).toString("base64url")}`;
}

function claims(overrides: Partial<TokenClaims> = {}): TokenClaims {
  return {
    aud: [AUD],
    iss: `https://${TEAM}`,
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  };
}

function request(jwt: string | null): Request {
  return new Request("https://preview.example/api/health", {
    headers: jwt === null ? {} : { "cf-access-jwt-assertion": jwt },
  });
}

const servingCerts: typeof fetch = () => Promise.resolve(Response.json(certs));

async function refusalCode(response: Response | null): Promise<string | null> {
  if (response === null) return null;
  // SAFETY: every refusal the façade builds is `{ error, message }` JSON; the status is asserted too.
  const body = (await response.json()) as { error: string };
  expect(response.status).toBe(403);
  return body.error;
}

beforeAll(async () => {
  const generate = () =>
    crypto.subtle.generateKey(
      { ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
      true,
      ["sign", "verify"],
    );
  keyPair = await generate();
  strangerPair = await generate();
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  certs = { keys: [{ ...jwk, kid: "preview-key" }] };
});

describe("accessRefusal", () => {
  it("stays closed while no Access application is configured", async () => {
    const refused = await accessRefusal(request(await token(claims())), {}, servingCerts);
    expect(await refusalCode(refused)).toBe("preview_access_unconfigured");
  });

  it("admits a token Access signed for this application", async () => {
    const admitted = await accessRefusal(request(await token(claims())), ENV, servingCerts);
    expect(admitted).toBeNull();
  });

  it("refuses a request carrying no identity at all", async () => {
    expect(await refusalCode(await accessRefusal(request(null), ENV, servingCerts))).toBe(
      "preview_access_denied",
    );
  });

  it("refuses a token signed by anyone but Access", async () => {
    const forged = await token(claims(), strangerPair.privateKey);
    expect(await refusalCode(await accessRefusal(request(forged), ENV, servingCerts))).toBe(
      "preview_access_denied",
    );
  });

  it("refuses a token for another application, an expired one, and an unknown key", async () => {
    for (const jwt of [
      await token(claims({ aud: ["someone-else"] })),
      await token(claims({ exp: Math.floor(Date.now() / 1000) - 60 })),
      await token(claims(), keyPair.privateKey, "rotated-away"),
    ]) {
      expect(await refusalCode(await accessRefusal(request(jwt), ENV, servingCerts))).toBe(
        "preview_access_denied",
      );
    }
  });

  it("refuses garbage rather than throwing through the façade", async () => {
    expect(await refusalCode(await accessRefusal(request("not-a-jwt"), ENV, servingCerts))).toBe(
      "preview_access_denied",
    );
  });
});
