import { createContext, useContext } from "react";

/** Opens the shell-owned New issue dialog; provided by RouteShell. */
export const NewIssueContext = createContext<(() => void) | null>(null);

export function useNewIssue(): () => void {
  const openNewIssue = useContext(NewIssueContext);
  if (!openNewIssue) throw new Error("useNewIssue must be used inside RouteShell");
  return openNewIssue;
}
