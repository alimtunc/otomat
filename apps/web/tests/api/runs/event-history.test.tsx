// @vitest-environment happy-dom
import type { RunEventsHandlers } from "@otomat/client";
import type { EventEnvelope, RunEventWindow } from "@otomat/domain";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";
import { mountWithQuery, type Mounted } from "#support/mount";

const PAGE_SIZE = 3;

interface WindowRequest {
  before: number | undefined;
}

let ledger: EventEnvelope[] = [];
let requests: WindowRequest[] = [];
let failNext = false;
let holdNext = false;
let releaseHeld: (() => void) | null = null;
let stream: RunEventsHandlers | null = null;
let subscriptions: (number | undefined)[] = [];

function page(before: number | undefined): RunEventWindow {
  const below = ledger.filter((event) => before === undefined || event.seq < before);
  const events = below.slice(Math.max(below.length - PAGE_SIZE, 0));
  const hasOlder = below.length > events.length;
  return {
    run_id: "run-1",
    events,
    older_cursor: hasOlder ? (events[0]?.seq ?? null) : null,
  };
}

vi.mock("@web/api/client", () => ({
  daemon: {
    getRunEventWindow: (_runId: string, params: { before?: number } = {}) => {
      requests.push({ before: params.before });
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error("window read failed"));
      }
      const answer = page(params.before);
      if (!holdNext) return Promise.resolve(answer);
      holdNext = false;
      return new Promise<RunEventWindow>((resolve) => {
        releaseHeld = () => resolve(answer);
      });
    },
    subscribeRunEvents: (_runId: string, handlers: RunEventsHandlers) => {
      stream = handlers;
      subscriptions.push(handlers.afterSeq);
      return { close: () => {} };
    },
  },
}));

function Probe() {
  const { events, history } = useRunEventStream();
  return (
    <div>
      <span data-testid="seqs">{events.map((event) => event.seq).join(",")}</span>
      <span data-testid="state">
        {history.status}
        {history.hasOlder ? "|older" : ""}
        {history.olderFailed ? "|failed" : ""}
      </span>
      <button type="button" onClick={history.loadOlder}>
        older
      </button>
    </div>
  );
}

let view: Mounted;

const text = (testId: string) =>
  view.container.querySelector(`[data-testid="${testId}"]`)?.textContent;

const flush = async () => {
  for (let tick = 0; tick < 2; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const clickOlder = async () => {
  const button = view.container.querySelector("button");
  await act(async () => button?.click());
};

const loadOlder = async () => {
  await clickOlder();
  await flush();
};

beforeEach(() => {
  ledger = [0, 1, 2, 3, 4, 5, 6].map((seq) => envelope({ id: `e${seq}`, seq }));
  requests = [];
  subscriptions = [];
  stream = null;
  failNext = false;
  holdNext = false;
  releaseHeld = null;
});

afterEach(async () => {
  await view.cleanup();
});

async function open(): Promise<void> {
  view = await mountWithQuery(
    <RunEventsProvider runId="run-1">
      <Probe />
    </RunEventsProvider>,
  );
}

describe("run event history", () => {
  it("opens on the newest page instead of the whole ledger", async () => {
    await open();

    expect(requests).toEqual([{ before: undefined }]);
    expect(text("seqs")).toBe("4,5,6");
    expect(text("state")).toBe("ready|older");
  });

  it("resumes the live stream at the newest loaded event", async () => {
    await open();
    expect(subscriptions).toEqual([6]);

    await act(async () => stream?.onEvent(envelope({ id: "e7", seq: 7 })));

    expect(text("seqs")).toBe("4,5,6,7");
  });

  it("prepends the page above without a duplicate or a reorder", async () => {
    await open();
    await loadOlder();

    expect(requests.at(-1)).toEqual({ before: 4 });
    expect(text("seqs")).toBe("1,2,3,4,5,6");

    await loadOlder();
    expect(text("seqs")).toBe("0,1,2,3,4,5,6");
    expect(text("state")).toBe("ready");
  });

  it("keeps events that arrive while the page above is still being read", async () => {
    await open();
    holdNext = true;
    await clickOlder();

    await act(async () => stream?.onEvent(envelope({ id: "e7", seq: 7 })));
    expect(text("seqs")).toBe("4,5,6,7");

    await act(async () => releaseHeld?.());
    await flush();

    expect(text("seqs")).toBe("1,2,3,4,5,6,7");
  });

  it("keeps the loaded pages when one above them fails, and recovers on retry", async () => {
    await open();
    failNext = true;
    await loadOlder();

    expect(text("seqs")).toBe("4,5,6");
    expect(text("state")).toBe("ready|older|failed");

    await loadOlder();

    expect(text("seqs")).toBe("1,2,3,4,5,6");
    expect(text("state")).toBe("ready|older");
  });
});
