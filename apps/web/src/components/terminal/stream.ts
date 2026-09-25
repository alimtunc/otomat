import type { DaemonClient } from "@otomat/client";
import { TERMINAL_INPUT_MAX, type TerminalSession } from "@otomat/domain";
import type { Terminal } from "@xterm/xterm";

import { terminalError } from "./error";

interface TerminalStreamTarget {
  client: DaemonClient;
  instance: string;
  id: string;
}

function sessionNotice(session: Pick<TerminalSession, "state" | "exit_code" | "signal">): string {
  if (session.state === "closing") return "Stopping session…";
  if (session.state !== "exited") return "";
  const signal = session.signal === null ? "" : ` · signal ${session.signal}`;
  return `Session ended · exit ${session.exit_code ?? "unknown"}${signal}`;
}

export function attachTerminalStream(
  terminal: Terminal,
  { client, instance, id }: TerminalStreamTarget,
  onNotice: (notice: string) => void,
): () => void {
  let disposed = false;
  let cursor = 0;
  let connected = false;
  let inputFailed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writes = Promise.resolve();
  let queuedInput = 0;
  let sizeFailure = "";
  const failInput = (error: unknown): void => {
    if (disposed) return;
    inputFailed = true;
    connected = false;
    terminal.options.disableStdin = true;
    onNotice(`${terminalError(error)} Input was not retried. Reopen this tab to reconnect.`);
  };
  const sendSize = (): void => {
    if (!connected) return;
    void client.resizeTerminal(id, instance, terminal.cols, terminal.rows).then(
      () => {
        sizeFailure = "";
      },
      (error: unknown) => {
        sizeFailure = `Resize failed: ${terminalError(error)} Retrying.`;
      },
    );
  };
  const resize = terminal.onResize(sendSize);
  const input = terminal.onData((data) => {
    if (!connected || inputFailed || disposed) return;
    if (data.length > TERMINAL_INPUT_MAX || queuedInput + data.length > 2 * TERMINAL_INPUT_MAX) {
      onNotice(
        `Input buffer full or paste exceeds ${TERMINAL_INPUT_MAX.toLocaleString("en-US")} characters. Nothing was sent.`,
      );
      return;
    }
    queuedInput += data.length;
    writes = writes
      .then(async () => {
        if (!disposed && !inputFailed) await client.writeTerminal(id, instance, data);
      })
      .catch(failInput)
      .finally(() => {
        queuedInput -= data.length;
      });
  });
  const poll = async (): Promise<void> => {
    try {
      const output = await client.terminalOutput(id, instance, cursor);
      if (disposed) return;
      if (output.truncated) {
        terminal.reset();
        terminal.writeln(
          "[Earlier output was truncated; refresh your terminal application if needed.]",
        );
      }
      await new Promise<void>((done) => terminal.write(output.data, done));
      if (disposed) return;
      cursor = output.cursor;
      const wasConnected = connected;
      connected = output.session.state === "running" && !inputFailed;
      terminal.options.disableStdin = !connected;
      if (connected && (!wasConnected || sizeFailure !== "")) sendSize();
      if (!inputFailed) onNotice(sessionNotice(output.session) || sizeFailure);
      if (output.session.state === "exited") return;
    } catch (error) {
      if (disposed) return;
      connected = false;
      terminal.options.disableStdin = true;
      if (!inputFailed)
        onNotice(`Disconnected: ${terminalError(error)} The process may still be running.`);
    }
    if (!disposed) timer = setTimeout(() => void poll(), connected ? 100 : 2000);
  };
  void poll();
  return () => {
    disposed = true;
    clearTimeout(timer);
    resize.dispose();
    input.dispose();
  };
}
