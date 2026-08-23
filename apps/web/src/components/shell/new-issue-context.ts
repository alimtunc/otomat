import { createContext, useContext } from "react";

export const NewIssueContext = createContext<(() => void) | null>(null);

export function useNewIssue(): () => void {
  const openNewIssue = useContext(NewIssueContext);
  if (!openNewIssue) throw new Error("useNewIssue must be used inside RouteShell");
  return openNewIssue;
}
