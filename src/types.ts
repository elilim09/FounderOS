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

export type DesignProgress =
  | { type: "step"; message: string }
  | { type: "log"; role?: AgentRole; content: string }
  | { type: "result"; data: DesignResult }
  | { type: "error"; message: string };
