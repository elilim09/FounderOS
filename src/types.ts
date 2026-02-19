export type AgentRole =
  | "MarketAnalyst"
  | "ProductStrategist"
  | "TechArchitect"
  | "OperationsDesigner"
  | "GrowthPlanner"
  | "ImplementationLead";

export interface UserIdeaInput {
  startupName: string;
  problem: string;
  targetCustomer: string;
  constraints: string;
  requestedAgentCount: number;
  additionalContext?: string;
}

export interface AgentOpinion {
  role: AgentRole;
  stance: string;
  priorities: string[];
  objections: string[];
}

export interface AgentDebate {
  role: AgentRole;
  rebuttal: string;
  updatedPriorities: string[];
}

export interface SystemBlueprint {
  architecture: string;
  agentTopology: string;
  coreFlows: string[];
  riskControls: string[];
}

export interface DesignResult {
  designId: string;
  timestamp: string;
  input: UserIdeaInput;
  opinions: AgentOpinion[];
  debateRound: AgentDebate[];
  consensusSummary: string;
  systemBlueprint: SystemBlueprint;
}

export interface BuildResult {
  designId: string;
  timestamp: string;
  buildPlan: string;
  generatedArtifacts: {
    name: string;
    content: string;
  }[];
  operationsChecklist: string[];
  outputDirectory: string;
  agentPrompts: Record<string, string>;
}

export type WorkshopTaskStatus = "queued" | "in_progress" | "done" | "blocked";

export interface WorkshopTask {
  id: string;
  title: string;
  owner: AgentRole;
  status: WorkshopTaskStatus;
  critical: boolean;
  notes: string;
}

export interface WorkshopApproval {
  id: string;
  taskId: string;
  role: AgentRole;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  resolvedAt?: string;
}

export interface WorkshopEvent {
  id: string;
  timestamp: string;
  role: AgentRole | "Facilitator";
  type: "auto_progress" | "approval_requested" | "approval_resolved" | "blocked";
  message: string;
}

export interface WorkshopState {
  designId: string;
  startupName: string;
  status: "idle" | "running" | "paused" | "completed";
  cycle: number;
  tasks: WorkshopTask[];
  pendingApprovals: WorkshopApproval[];
  events: WorkshopEvent[];
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export type DesignProgress =
  | { type: "step"; message: string }
  | { type: "log"; role?: AgentRole; content: string }
  | { type: "result"; data: DesignResult }
  | { type: "error"; message: string };
