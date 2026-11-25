import type { Register } from "claude-code";

import { registerAgentRows } from "./agent-rows";
import { registerBranchProtection } from "./branch-protection";
import { registerEffortCap } from "./effort-cap";
import { registerStatusLine } from "./status-line";

export const register: Register = (on) => {
  registerStatusLine(on);
  registerAgentRows(on);
  registerBranchProtection(on);
  registerEffortCap(on);
};
