/**
 * Actionable readiness of one project on the host that owns it: repository, base
 * branch, worktrees root, Linear and GitHub integrations, runtimes, and agent
 * profiles with their skills. Every check is a read — it installs nothing,
 * connects nothing, repairs nothing — and it forwards no command output, so a
 * remote URL or a provider argument can never carry a credential into a report.
 * Entry point: {@link checkProjectHealth}.
 *
 * @packageDocumentation
 */
export { checkProjectHealth, type ProjectHealthContext } from "./report.js";
