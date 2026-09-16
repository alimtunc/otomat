import { expect, it, vi } from "vitest";

type BeforeSendHeadersListener = (
  details: { url: string; requestHeaders: Record<string, string> },
  callback: (response: { requestHeaders?: Record<string, string> }) => void,
) => void;

interface Harness {
  listener: BeforeSendHeadersListener | null;
}

const harness = vi.hoisted((): Harness => ({ listener: null }));

vi.mock("electron", () => ({
  session: {
    defaultSession: {
      webRequest: {
        onBeforeSendHeaders: (listener: BeforeSendHeadersListener) => {
          harness.listener = listener;
        },
      },
    },
  },
  shell: { openExternal: vi.fn() },
}));

it("stamps the daemon bearer onto the renderer's requests to that daemon only", async () => {
  const { authorizeRendererRequests } = await import("#main/security");
  authorizeRendererRequests(() => [{ url: "http://127.0.0.1:4319", token: "local-token" }]);
  const listener = harness.listener;
  if (listener === null) throw new Error("expected a webRequest listener");

  const stamped = vi.fn();
  listener(
    {
      url: "http://127.0.0.1:4319/api/activity/stream",
      requestHeaders: { Accept: "text/event-stream" },
    },
    stamped,
  );
  expect(stamped).toHaveBeenCalledWith({
    requestHeaders: { Accept: "text/event-stream", Authorization: "Bearer local-token" },
  });

  const untouched = vi.fn();
  listener({ url: "https://github.com/login", requestHeaders: { Accept: "text/html" } }, untouched);
  expect(untouched).toHaveBeenCalledWith({});
});
