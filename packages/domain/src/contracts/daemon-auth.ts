export const DAEMON_TOKEN_ENV = "OTOMAT_DAEMON_TOKEN";

/** EventSource and `<img>` cannot set a header. */
export const DAEMON_TOKEN_QUERY = "access_token";

export const DAEMON_TOKEN_FILE = "daemon-token";

export function daemonAuthorization(token: string): string {
  return `Bearer ${token}`;
}
