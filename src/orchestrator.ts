import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateJson, generateText } from "./openaiClient.js";
import { AgentDebate, AgentOpinion, AgentRole, BuildResult, DesignResult, SystemBlueprint, UserIdeaInput } from "./types.js";

const ROLE_POOL: AgentRole[] = [
  "MarketAnalyst",
  "ProductStrategist",
  "TechArchitect",
  "OperationsDesigner",
  "GrowthPlanner",
  "ImplementationLead"
];

function pickRoles(count: number): AgentRole[] {
  const normalized = Number.isFinite(count) ? count : 4;
  const c = Math.max(2, Math.min(ROLE_POOL.length, normalized));
  return ROLE_POOL.slice(0, c);
}

async function collectOpinion(input: UserIdeaInput, role: AgentRole): Promise<AgentOpinion> {
  const system = `You are ${role}, a member of a startup multi-agent council. Respond in Korean.`;
  const user = [
    `Startup Name: ${input.startupName}`,
    `Problem: ${input.problem}`,
    `Target Customer: ${input.targetCustomer}`,
    `Constraints: ${input.constraints}`,
    `Additional Context: ${input.additionalContext ?? "N/A"}`,
    "Return JSON keys: stance(string), priorities(string[] 3-6), objections(string[] 2-5)."
  ].join("\n");

  const data = await generateJson<Omit<AgentOpinion, "role">>(system, user);

  return {
    role,
    stance: data.stance,
    priorities: Array.isArray(data.priorities) ? data.priorities.slice(0, 6) : [],
    objections: Array.isArray(data.objections) ? data.objections.slice(0, 5) : []
  };
}

async function debate(input: UserIdeaInput, role: AgentRole, opinions: AgentOpinion[]): Promise<AgentDebate> {
  const system = `You are ${role}. Debate with other agents and update your priorities. Respond in Korean JSON.`;
  const user = [
    `Context: ${JSON.stringify(input)}`,
    "Other agents' opinions:",
    ...opinions.filter((o) => o.role !== role).map((o) => `${o.role}: stance=${o.stance}; priorities=${o.priorities.join(", ")}; objections=${o.objections.join(", ")}`),
    "Return JSON keys: rebuttal(string), updatedPriorities(string[] 3-6)."
  ].join("\n");

  const data = await generateJson<Omit<AgentDebate, "role">>(system, user);

  return {
    role,
    rebuttal: data.rebuttal,
    updatedPriorities: Array.isArray(data.updatedPriorities) ? data.updatedPriorities.slice(0, 6) : []
  };
}

async function consensus(input: UserIdeaInput, opinions: AgentOpinion[], debateRound: AgentDebate[]): Promise<string> {
  const system = "You are the chief multi-agent facilitator. Merge disagreements into one actionable consensus in Korean.";
  const user = [
    "Startup context:",
    JSON.stringify(input, null, 2),
    "\nRound-1 opinions:",
    ...opinions.map((o) => `- ${o.role}: ${o.stance} | priorities=${o.priorities.join(", ")} | objections=${o.objections.join(", ")}`),
    "\nRound-2 debates:",
    ...debateRound.map((d) => `- ${d.role}: rebuttal=${d.rebuttal} | updatedPriorities=${d.updatedPriorities.join(", ")}`),
    "\nOutput format:\n1) 합의 아키텍처\n2) 트레이드오프 결정\n3) 2주 MVP 실행순서"
  ].join("\n");

  return generateText(system, user);
}

async function createBlueprint(input: UserIdeaInput, consensusSummary: string): Promise<SystemBlueprint> {
  const system = "You are a startup systems architect. Return valid Korean JSON only.";
  const user = [
    `Input context: ${JSON.stringify(input)}`,
    `Consensus: ${consensusSummary}`,
    "Return JSON keys: architecture(string), agentTopology(string), coreFlows(string[] 3-6), riskControls(string[] 3-6)."
  ].join("\n");

  const data = await generateJson<SystemBlueprint>(system, user);

  return {
    architecture: data.architecture,
    agentTopology: data.agentTopology,
    coreFlows: Array.isArray(data.coreFlows) ? data.coreFlows.slice(0, 6) : [],
    riskControls: Array.isArray(data.riskControls) ? data.riskControls.slice(0, 6) : []
  };
}

export async function designMultiAgentSystem(input: UserIdeaInput): Promise<DesignResult> {
  const roles = pickRoles(input.requestedAgentCount);

  const opinions = await Promise.all(roles.map((role) => collectOpinion(input, role)));
  const debateRound = await Promise.all(roles.map((role) => debate(input, role, opinions)));
  const consensusSummary = await consensus(input, opinions, debateRound);
  const systemBlueprint = await createBlueprint(input, consensusSummary);

  return {
    designId: randomUUID(),
    timestamp: new Date().toISOString(),
    input,
    opinions,
    debateRound,
    consensusSummary,
    systemBlueprint
  };
}

function composeBuildPrompt(design: DesignResult): string {
  return [
    "You are an implementation council composed of multiple agents.",
    "Generate practical and executable startup build output in Korean.",
    JSON.stringify(design, null, 2),
    "Must include: detailed technical plan, milestone schedule, deployment checklist, observability strategy."
  ].join("\n");
}

export async function buildFromDesign(design: DesignResult): Promise<BuildResult> {
  const buildPlan = await generateText(
    "You are a senior multi-agent implementation orchestrator for startup platforms.",
    composeBuildPrompt(design)
  );

  const generatedArtifacts = [
    {
      name: "agent-topology.yaml",
      content: `designId: ${design.designId}\nroles:\n${design.opinions.map((o) => `  - ${o.role}`).join("\n")}\nstrategy: |\n  ${design.systemBlueprint.agentTopology.replace(/\n/g, "\n  ")}\n`
    },
    {
      name: "execution-plan.md",
      content: `# Execution Plan\n\n${buildPlan}\n`
    },
    {
      name: "system-blueprint.json",
      content: JSON.stringify(design.systemBlueprint, null, 2)
    }
  ];

  const outputDirectory = path.join(process.cwd(), "generated", design.designId);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    generatedArtifacts.map((artifact) =>
      writeFile(path.join(outputDirectory, artifact.name), artifact.content, "utf-8")
    )
  );

  const operationsChecklist = [
    "OPENAI_API_KEY/OPENAI_MODEL 운영 키 분리 및 회전 정책 적용",
    "프롬프트/응답 로깅 및 PII 마스킹 적용",
    "설계 단계와 구축 단계 각각에 human-in-the-loop 승인 게이트 적용",
    "SLO(응답시간, 성공률) 기반 모니터링 대시보드 운영",
    "릴리즈 전 샌드박스 환경에서 회귀 테스트 실행"
  ];

  return {
    designId: design.designId,
    timestamp: new Date().toISOString(),
    buildPlan,
    generatedArtifacts,
    operationsChecklist,
    outputDirectory
  };
}
