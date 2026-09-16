export interface DaemonCredential {
  url: string;
  token: string;
}

export type DaemonCredentials = () => ReadonlyArray<DaemonCredential | null>;

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function daemonAuthorization(credentials: DaemonCredentials, url: string): string | null {
  const origin = originOf(url);
  if (origin === null) return null;
  for (const credential of credentials()) {
    if (credential !== null && originOf(credential.url) === origin) {
      return `Bearer ${credential.token}`;
    }
  }
  return null;
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

export function authorizedFetch(credentials: DaemonCredentials): typeof fetch {
  return (input, init) => {
    const authorization = daemonAuthorization(credentials, urlOf(input));
    if (authorization === null) return fetch(input, init);
    const headers = new Headers(init?.headers);
    headers.set("authorization", authorization);
    return fetch(input, { ...init, headers });
  };
}
