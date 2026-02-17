import { randomUUID } from "node:crypto";
import { generateWithOpenAI } from "./openaiClient.js";
import { AgentOpinion, AgentRole, BuildResult, DesignResult, UserIdeaInput } from "./types.js";

const ROLE_POOL: AgentRole[] = [
  "MarketAnalyst",
  "ProductStrategist",
  "TechArchitect",
  "OperationsDesigner",
  "GrowthPlanner",
  "ImplementationLead"
];

function pickRoles(count: number): AgentRole[] {
  const c = Math.max(2, Math.min(ROLE_POOL.length, count));
  return ROLE_POOL.slice(0, c);
}

async function collectOpinion(input: UserIdeaInput, role: AgentRole): Promise<AgentOpinion> {
  const system = `You are ${role}. You are part of a startup multi-agent council. Use only OpenAI model based reasoning and provide practical output in Korean.`;
  const user = [
    `Startup Name: ${input.startupName}`,
    `Problem: ${input.problem}`,
    `Target Customer: ${input.targetCustomer}`,
    `Constraints: ${input.constraints}`,
    `Additional Context: ${input.additionalContext ?? "N/A"}`,
    "Return: role-specific strategy, key objections to other roles, and concrete implementation priorities in 5-8 bullet points."
  ].join("\n");

  const opinion = await generateWithOpenAI(system, user);
  return { role, opinion };
}

async function consensus(input: UserIdeaInput, opinions: AgentOpinion[]): Promise<string> {
  const system = "You are a chief multi-agent facilitator. Merge disagreements into an actionable consensus. Output in Korean.";
  const user = [
    "User startup context:",
    JSON.stringify(input, null, 2),
    "\nAgent opinions:",
    ...opinions.map((o) => `### ${o.role}\n${o.opinion}`),
    "\nProvide: 1) final consensus architecture 2) tradeoff decisions 3) what to build first in 2 weeks"
  ].join("\n");

  return generateWithOpenAI(system, user);
}

async function blueprint(input: UserIdeaInput, consensusSummary: string): Promise<DesignResult["systemBlueprint"]> {
  const system = "You are a startup systems architect producing JSON-like sections in Korean.";
  const user = [
    "Based on context and consensus, generate concise sections:",
    `Context: ${JSON.stringify(input)}`,
    `Consensus: ${consensusSummary}`,
    "Return sections titled architecture, agentTopology, coreFlows(3-6), riskControls(3-6)."
  ].join("\n");

  const raw = await generateWithOpenAI(system, user);

  const lines = raw.split("\n").map((v) => v.trim()).filter(Boolean);
  return {
    architecture: lines.slice(0, 4).join("\n") || raw,
    agentTopology: lines.slice(4, 8).join("\n") || "역할 기반 에이전트 토폴로지",
    coreFlows: lines.filter((l) => l.match(/^[-*\d]/)).slice(0, 6),
    riskControls: lines.slice(-4)
  };
}

export async function designMultiAgentSystem(input: UserIdeaInput): Promise<DesignResult> {
  const roles = pickRoles(input.requestedAgentCount);
  const opinions = await Promise.all(roles.map((role) => collectOpinion(input, role)));
  const consensusSummary = await consensus(input, opinions);
  const systemBlueprint = await blueprint(input, consensusSummary);

  return {
    designId: randomUUID(),
    timestamp: new Date().toISOString(),
    input,
    opinions,
    consensusSummary,
    systemBlueprint
  };
}

export async function buildFromDesign(design: DesignResult): Promise<BuildResult> {
  const system = "You are an implementation council made of multi agents. Produce build-ready output in Korean.";
  const user = [
    "Given this design, generate a concrete build plan and code/config artifacts.",
    JSON.stringify(design, null, 2),
    "Return sections: buildPlan, artifacts(3 files with content snippets), operationsChecklist(5 items)."
  ].join("\n");

  const response = await generateWithOpenAI(system, user);

  const artifacts = [
    {
      name: "agent-topology.yaml",
      content: `# Generated blueprint\n# designId: ${design.designId}\n${design.systemBlueprint.agentTopology}\n`
    },
    {
      name: "execution-plan.md",
      content: `# Build Plan\n\n${response}\n`
    },
    {
      name: "kpi-dashboard-spec.md",
      content: `# KPI\n- Activation\n- Weekly active founders\n- Build success rate\n- Human override ratio\n`
    }
  ];

  return {
    designId: design.designId,
    timestamp: new Date().toISOString(),
    buildPlan: response,
    generatedArtifacts: artifacts,
    operationsChecklist: [
      "OpenAI API Key 및 모델 정책 점검",
      "에이전트 역할별 프롬프트 버전 고정",
      "설계-구축 이벤트 로그 저장 및 추적",
      "인간 승인 게이트(배포 전) 적용",
      "A/B 실험으로 설계 품질 개선"
    ]
  };
}
