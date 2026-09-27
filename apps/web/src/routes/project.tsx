import { createFileRoute } from "@tanstack/react-router";
import { ProjectHome } from "@web/components/shell/project-desk/home";
export const Route = createFileRoute("/project")({ component: ProjectHome });
