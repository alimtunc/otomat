import { Container, getContainer } from "@cloudflare/containers";

import {
  authorizedClient,
  CLIENT_ID_HEADER,
  CLIENT_SECRET_HEADER,
  DAEMON_PORT,
  daemonUrl,
} from "./gate.mjs";

export class PreviewDaemon extends Container {
  defaultPort = DAEMON_PORT;
  sleepAfter = "1h";
}

export default {
  async fetch(request, env) {
    if (!(await authorizedClient(request.headers, env))) {
      return Response.json(
        {
          error: "preview_client_unauthorized",
          message: "This preview daemon only answers its own pull request's façade.",
        },
        { status: 403 },
      );
    }
    // Named by the build: a redeploy reaches a fresh container of the new image immediately
    // instead of an old instance still draining on the previous commit.
    const container = getContainer(env.PREVIEW_DAEMON, env.PREVIEW_BUILD ?? "unknown");
    try {
      await container.startAndWaitForPorts();
    } catch (error) {
      return Response.json(
        {
          error: "preview_daemon_starting",
          message: `The daemon container is not answering yet: ${error instanceof Error ? error.message : String(error)}`,
        },
        { status: 503 },
      );
    }
    const upstream = new Request(daemonUrl(request.url), request);
    upstream.headers.delete(CLIENT_ID_HEADER);
    upstream.headers.delete(CLIENT_SECRET_HEADER);
    return container.fetch(upstream);
  },
};
