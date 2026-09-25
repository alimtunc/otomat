import { createFileRoute } from "@tanstack/react-router";
import { ProjectTerminalView } from "@web/components/terminal/project-view";

export const Route = createFileRoute("/terminal")({ component: ProjectTerminalView });
