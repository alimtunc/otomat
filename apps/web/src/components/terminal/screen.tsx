import type { DaemonClient } from "@otomat/client";
import type { TerminalSession } from "@otomat/domain";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

import "@xterm/xterm/css/xterm.css";

import { terminalError } from "./error";

export function TerminalScreen({
  client,
  instance,
  session,
}: {
  client: DaemonClient;
  instance: string;
  session: TerminalSession;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const id = session.id;
  // otomat-allow-effect: owns the xterm instance, resize observer and daemon stream for this mount.
  useEffect(() => {
    if (!container.current) return;
    const terminal = new Terminal({
      cursorBlink: true,
      scrollback: 2000,
      fontSize: 13,
      theme: { background: "#101114", foreground: "#e6e6e8" },
      screenReaderMode: true,
      allowProposedApi: false,
      disableStdin: true,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container.current);
    terminal.focus();
    let disposed = false;
    let cursor = 0;
    let connected = false;
    let inputFailed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let writes = Promise.resolve();
    let queuedInput = 0;
    const failInput = (error: unknown) => {
      if (disposed) return;
      inputFailed = true;
      connected = false;
      terminal.options.disableStdin = true;
      if (!disposed)
        setNotice(`${terminalError(error)} Input was not retried. Reopen this tab to reconnect.`);
    };
    const resize = () => {
      fit.fit();
      if (connected)
        void client.resizeTerminal(id, instance, terminal.cols, terminal.rows).catch(failInput);
    };
    const input = terminal.onData((data) => {
      if (!connected || inputFailed || disposed) return;
      if (data.length > 8192 || queuedInput + data.length > 16384) {
        setNotice("Input buffer full or paste exceeds 8,192 characters. Nothing was sent.");
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
    const poll = async () => {
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
        if (!wasConnected && connected) resize();
        if (!inputFailed) {
          let status = "";
          if (output.session.state === "exited")
            status = `Session ended · exit ${output.session.exit_code ?? "unknown"}${output.session.signal ? ` · signal ${output.session.signal}` : ""}`;
          else if (output.session.state === "closing") status = "Stopping session…";
          setNotice(status);
        }
        if (output.session.state === "exited") return;
      } catch (error) {
        if (disposed) return;
        connected = false;
        terminal.options.disableStdin = true;
        if (!disposed && !inputFailed)
          setNotice(`Disconnected: ${terminalError(error)} The process may still be running.`);
      }
      if (!disposed) timer = setTimeout(() => void poll(), connected ? 100 : 2000);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container.current);
    fit.fit();
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      input.dispose();
      terminal.dispose();
    };
  }, [client, instance, id]);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#101114]">
      <div
        ref={container}
        className="min-h-48 min-w-0 flex-1 p-3"
        aria-label="Terminal input and output"
      />
      <p
        role="status"
        aria-live="polite"
        className="shrink-0 border-t border-white/5 px-3 py-1.5 text-xs text-[#a1a1aa]"
      >
        {notice || "Session stays open when you switch tabs"}
      </p>
    </div>
  );
}
