import type { DaemonClient } from "@otomat/client";
import type { TerminalSession } from "@otomat/domain";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

import "@xterm/xterm/css/xterm.css";

import { attachTerminalStream } from "./stream";

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
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(container.current);
    fit.fit();
    const detach = attachTerminalStream(terminal, { client, instance, id }, setNotice);
    return () => {
      detach();
      observer.disconnect();
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
