import { createServer } from "node:net";

import { DAEMON_HOST } from "#shared/constants";

/**
 * Asks the OS for a free TCP port on the loopback interface by binding port 0, reading the
 * assigned port, and releasing it. There is an inherent TOCTOU gap between release and the
 * daemon binding it; on loopback with immediate reuse this is negligible, and a bind clash
 * surfaces as the daemon's own `failed to bind` exit, which startup reports as recoverable.
 */
export function findFreeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, DAEMON_HOST, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("could not determine a free loopback port")));
        return;
      }
      const { port } = address;
      server.close((closeError) => (closeError ? reject(closeError) : resolve(port)));
    });
  });
}
