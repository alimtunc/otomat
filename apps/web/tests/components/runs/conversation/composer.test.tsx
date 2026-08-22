import type {
  CreateRunContributionRequest,
  ResolvedAgentConfig,
  RunDetail,
  RunState,
  RuntimeDescriptor,
} from "@otomat/domain";
// @vitest-environment happy-dom
import type { ConnectionState } from "@otomat/ui";
import { ConversationComposer } from "@web/components/runs/conversation/composer";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let nextMutationError: Error | null = null;
let contributionError: Error | null = null;
const mutate = vi.fn(
  (_request: CreateRunContributionRequest, callbacks?: { onSuccess?: () => void }) => {
    if (nextMutationError === null) {
      callbacks?.onSuccess?.();
      return;
    }
    contributionError = nextMutationError;
  },
);
const onSent = vi.fn();
let connectionState: ConnectionState = "online";
let runtimesData: RuntimeDescriptor[] | undefined;

const CONFIG: ResolvedAgentConfig = {
  runtime: "claude",
  profile_id: "profile-1",
  profile_name: "Implementer",
  options: {},
  model: { id: "claude-opus", source: "manual" },
  guidance: null,
  skills: [],
  sources: { runtime: "profile", model: "profile", options: {} },
  config_hash: "config-1",
};

vi.mock("@web/api/runs/mutations", () => ({
  useCreateRunContribution: () => ({ mutate, isPending: false, error: contributionError }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useDaemonStatus: () => ({ connectionState, lastSyncAt: null, retry: vi.fn() }),
  useRuntimes: () => ({ data: runtimesData }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function runDetail(status: RunState, providerSessionId: string | null = "ps-1"): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "i1",
      status,
      branch: "otomat/run/run-1",
      plan_json: {
        version: 1,
        steps: [
          {
            id: "s1",
            name: "Agent turn",
            agent: "claude",
            prompt: "p",
            depends_on: [],
            config: CONFIG,
          },
        ],
      },
      updated_at: "2026-07-25T10:00:00.000Z",
    },
    steps: [
      {
        id: "s1",
        run_id: "run-1",
        idx: 0,
        name: "Agent turn",
        status: "succeeded",
        compete_group_id: null,
        worktree_id: null,
        branch: null,
        worktree_status: null,
        provider_wait: null,
        next_turn_config: null,
      },
    ],
    sessions: [
      {
        id: "as1",
        step_run_id: "s1",
        agent_id: "claude",
        status: "awaiting_input",
        provider_session_id: providerSessionId,
        resumed_from_session_id: null,
        config: CONFIG,
        reported_model: null,
        started_at: "2026-07-25T10:00:00.000Z",
        boundary: {
          start_tree_sha: null,
          start_head_sha: null,
          end_tree_sha: null,
          end_head_sha: null,
          error: null,
        },
      },
    ],
    compete_groups: [],
    worktree_path: null,
  };
}

function claudeDescriptor(): RuntimeDescriptor {
  return {
    id: "claude",
    display_name: "Claude Code",
    kind: "real",
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      resume_model: { status: "supported" },
      permissions: false,
      diff_hints: false,
    },
    availability: { status: "available", version: null },
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  mutate.mockClear();
  onSent.mockClear();
  connectionState = "online";
  runtimesData = undefined;
  nextMutationError = null;
  contributionError = null;
});

async function renderComposer(detail: RunDetail) {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<ConversationComposer detail={detail} stepRunId="s1" onSent={onSent} />);
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
}

function promptTextarea(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea[aria-label='Run message']",
  );
  if (!textarea) throw new Error("run message textarea not found");
  return textarea;
}

function sendButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes("message"),
  );
  if (!button) throw new Error("send button not found");
  return button;
}

async function typePrompt(value: string) {
  const textarea = promptTextarea();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ConversationComposer", () => {
  it("sends the trimmed prompt on Cmd+Enter and clears the draft", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("  add error handling  ");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutate).toHaveBeenCalledWith(
      {
        step_run_id: "s1",
        target_agent_session_id: "as1",
        target_config_hash: "config-1",
        body: "add error handling",
      },
      expect.anything(),
    );
    expect(promptTextarea().value).toBe("");
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and reports no send when the mutation fails", async () => {
    runtimesData = [claudeDescriptor()];
    nextMutationError = new Error("daemon refused the message");
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("add error handling");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(promptTextarea().value).toBe("add error handling");
    expect(onSent).not.toHaveBeenCalled();
  });

  it("submits via the button on a review-ready run", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("review_ready"));
    await typePrompt("rename the helper");

    await act(async () => {
      sendButton().click();
    });

    expect(mutate).toHaveBeenCalledWith(
      {
        step_run_id: "s1",
        target_agent_session_id: "as1",
        target_config_hash: "config-1",
        body: "rename the helper",
      },
      expect.anything(),
    );
  });

  it("does not submit a blank message", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("   ");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
      );
    });

    expect(mutate).not.toHaveBeenCalled();
  });

  it("queues a message sent while the run is active instead of refusing it", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("running"));
    await typePrompt("also add tests");

    expect(sendButton().disabled).toBe(false);
    expect(sendButton().textContent).toContain("Queue message");
    expect(document.body.textContent).toContain("next safe turn");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutate).toHaveBeenCalledWith(
      {
        step_run_id: "s1",
        target_agent_session_id: "as1",
        target_config_hash: "config-1",
        body: "also add tests",
      },
      expect.anything(),
    );
  });

  it("refuses a message on a finished run", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("completed"));

    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "To: Agent turn · Implementer · claude · claude-opus · Session as1",
    );
    expect(document.body.textContent).toContain("This run is finished");
  });

  it("disables the action while the daemon is offline", async () => {
    runtimesData = [claudeDescriptor()];
    connectionState = "offline";
    await renderComposer(runDetail("awaiting_human"));

    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("Daemon offline");
  });

  it("explains when the runtime cannot resume", async () => {
    runtimesData = [];
    await renderComposer(runDetail("awaiting_human"));

    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("runtime is not registered");
  });
});
