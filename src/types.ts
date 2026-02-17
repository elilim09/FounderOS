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
  opinion: string;
}

export interface DesignResult {
  designId: string;
  timestamp: string;
  input: UserIdeaInput;
  opinions: AgentOpinion[];
  consensusSummary: string;
  systemBlueprint: {
    architecture: string;
    agentTopology: string;
    coreFlows: string[];
    riskControls: string[];
  };
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
}
