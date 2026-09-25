import { createFileRoute } from "@tanstack/react-router";
import { RunTerminalView } from "@web/components/terminal/run-view";

export const Route = createFileRoute("/runs/$runId/terminal")({ component: RunTerminalView });
