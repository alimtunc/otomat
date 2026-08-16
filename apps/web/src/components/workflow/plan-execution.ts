import type { LaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import type { ExecutionSelection } from "@web/lib/execution/selection";

/** The agent catalog every node's picker reads, plus what a node selecting nothing inherits. */
export interface WorkflowPlanExecution {
  agents: LaunchAgentChoice;
  /** Empty where no level sits above the plan, as in a preset composed away from any launch. */
  inherited: ExecutionSelection;
}
