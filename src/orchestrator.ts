import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateJson, generateText } from "./openaiClient.js";
import {
  AgentDebate,
  AgentOpinion,
  AgentRole,
  BuildResult,
  DesignProgress,
  DesignResult,
  OperatingAgent,
  SystemBlueprint,
  UserIdeaInput
} from "./types.js";

interface HierarchyGeneration {
  operatingHierarchy: OperatingAgent[];
}

function clampOperatingAgentCount(count: number): number {
  const normalized = Number.isFinite(count) ? count : 12;
  return Math.max(2, Math.min(100, Math.floor(normalized)));
}

function normalizeHierarchy(raw: OperatingAgent[], requestedCount: number): OperatingAgent[] {
  const allowedTiers: OperatingAgent["tier"][] = ["Executive", "Management", "Operation"];
  const cleaned = raw
    .filter((agent) => agent && typeof agent.role === "string")
    .map((agent, idx) => ({
      role: agent.role.trim() || `Agent-${idx + 1}`,
      tier: allowedTiers.includes(agent.tier) ? agent.tier : "Operation",
      mission: typeof agent.mission === "string" && agent.mission.trim() ? agent.mission.trim() : "운영 목표 달성",
      reportsTo: typeof agent.reportsTo === "string" && agent.reportsTo.trim() ? agent.reportsTo.trim() : undefined
    }));

  const unique: OperatingAgent[] = [];
  const seen = new Set<string>();
  for (const agent of cleaned) {
    if (seen.has(agent.role)) continue;
    unique.push(agent);
    seen.add(agent.role);
    if (unique.length >= requestedCount) break;
  }

  let executiveAnchor = unique.find((a) => a.tier === "Executive")?.role;
  if (!executiveAnchor) {
    executiveAnchor = "ChiefOrchestrator";
    unique.unshift({
      role: executiveAnchor,
      tier: "Executive",
      mission: "전체 운영 전략 수립 및 자율 실행 품질 관리"
    });
  }

  while (unique.length < requestedCount) {
    unique.push({
      role: `OperationAgent${unique.length + 1}`,
      tier: "Operation",
      mission: "할당된 워크플로우를 자율적으로 실행하고 결과를 보고",
      reportsTo: executiveAnchor
    });
  }

  const roleSet = new Set(unique.map((a) => a.role));
  return unique.slice(0, requestedCount).map((agent) => ({
    ...agent,
    reportsTo: agent.reportsTo && roleSet.has(agent.reportsTo) && agent.reportsTo !== agent.role ? agent.reportsTo : undefined
  }));
}

async function generateHierarchy(input: UserIdeaInput): Promise<OperatingAgent[]> {
  const operatingAgentCount = clampOperatingAgentCount(input.requestedAgentCount);
  const system = "You design AI organizations for autonomous startup execution. Respond in Korean JSON only.";
  const user = [
    `Startup Name: ${input.startupName}`,
    `Problem: ${input.problem}`,
    `Target Customer: ${input.targetCustomer}`,
    `Constraints: ${input.constraints}`,
    `Additional Context: ${input.additionalContext ?? "N/A"}`,
    `Required operating agent count: ${operatingAgentCount}`,
    "Create a company-like hierarchy for autonomous operations with tiers Executive/Management/Operation.",
    "The hierarchy must prioritize proactive execution with minimal human intervention.",
    "Role names must be dynamic and tailored to this startup context (do not use fixed predefined role lists).",
    "Return JSON key: operatingHierarchy(OperatingAgent[]).",
    "OperatingAgent schema: { role: string, tier: 'Executive'|'Management'|'Operation', mission: string, reportsTo?: string }"
  ].join("\n");

  const data = await generateJson<HierarchyGeneration>(system, user);
  return normalizeHierarchy(Array.isArray(data.operatingHierarchy) ? data.operatingHierarchy : [], operatingAgentCount);
}

function pickCouncilRoles(hierarchy: OperatingAgent[]): AgentRole[] {
  const executives = hierarchy.filter((agent) => agent.tier === "Executive");
  const managers = hierarchy.filter((agent) => agent.tier === "Management");
  const operators = hierarchy.filter((agent) => agent.tier === "Operation");

  const council = [
    ...executives.slice(0, 2),
    ...managers.slice(0, 3),
    ...operators.slice(0, 3)
  ];

  const uniqueRoles = [...new Set(council.map((agent) => agent.role))];
  return uniqueRoles.length >= 2 ? uniqueRoles : hierarchy.slice(0, Math.max(2, Math.min(4, hierarchy.length))).map((agent) => agent.role);
}

async function collectOpinion(input: UserIdeaInput, role: AgentRole, hierarchy: OperatingAgent[]): Promise<AgentOpinion> {
  const system = `You are ${role}, part of a hierarchical startup AI organization. Respond in Korean.`;
  const user = [
    `Startup Name: ${input.startupName}`,
    `Problem: ${input.problem}`,
    `Target Customer: ${input.targetCustomer}`,
    `Constraints: ${input.constraints}`,
    `Additional Context: ${input.additionalContext ?? "N/A"}`,
    `Organization hierarchy snapshot: ${JSON.stringify(hierarchy.slice(0, 20))}`,
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
    ...opinions
      .filter((o) => o.role !== role)
      .map((o) => `${o.role}: stance=${o.stance}; priorities=${o.priorities.join(", ")}; objections=${o.objections.join(", ")}`),
    "Return JSON keys: rebuttal(string), updatedPriorities(string[] 3-6)."
  ].join("\n");

  const data = await generateJson<Omit<AgentDebate, "role">>(system, user);

  return {
    role,
    rebuttal: data.rebuttal,
    updatedPriorities: Array.isArray(data.updatedPriorities) ? data.updatedPriorities.slice(0, 6) : []
  };
}

async function consensus(input: UserIdeaInput, opinions: AgentOpinion[], debateRound: AgentDebate[], hierarchy: OperatingAgent[]): Promise<string> {
  const system = "You are the chief multi-agent facilitator. Merge disagreements into one actionable consensus in Korean.";
  const user = [
    "Startup context:",
    JSON.stringify(input, null, 2),
    `\nOperating hierarchy headcount: ${hierarchy.length}`,
    ...hierarchy.slice(0, 30).map((agent) => `- ${agent.tier} | ${agent.role} | mission=${agent.mission} | reportsTo=${agent.reportsTo ?? "none"}`),
    "\nRound-1 opinions:",
    ...opinions.map((o) => `- ${o.role}: ${o.stance} | priorities=${o.priorities.join(", ")} | objections=${o.objections.join(", ")}`),
    "\nRound-2 debates:",
    ...debateRound.map((d) => `- ${d.role}: rebuttal=${d.rebuttal} | updatedPriorities=${d.updatedPriorities.join(", ")}`),
    "\nOutput format:\n1) 합의 아키텍처\n2) 트레이드오프 결정\n3) 2주 MVP 실행순서"
  ].join("\n");

  return generateText(system, user);
}

async function createBlueprint(input: UserIdeaInput, consensusSummary: string, hierarchy: OperatingAgent[]): Promise<SystemBlueprint> {
  const system = "You are a startup systems architect. Return valid Korean JSON only.";
  const user = [
    `Input context: ${JSON.stringify(input)}`,
    `Operating hierarchy: ${JSON.stringify(hierarchy)}`,
    `Consensus: ${consensusSummary}`,
    "Return JSON keys: architecture(string), agentTopology(string), coreFlows(string[] 3-6), riskControls(string[] 3-6)."
  ].join("\n");

  const data = await generateJson<Omit<SystemBlueprint, "operatingHierarchy">>(system, user);

  return {
    architecture: data.architecture,
    agentTopology: data.agentTopology,
    coreFlows: Array.isArray(data.coreFlows) ? data.coreFlows.slice(0, 6) : [],
    riskControls: Array.isArray(data.riskControls) ? data.riskControls.slice(0, 6) : [],
    operatingHierarchy: hierarchy
  };
}

export async function designMultiAgentSystem(
  input: UserIdeaInput,
  onProgress: (progress: DesignProgress) => void
): Promise<DesignResult> {
  onProgress({ type: "step", message: "🚀 AI 설계를 시작합니다..." });

  const operatingAgentCount = clampOperatingAgentCount(input.requestedAgentCount);
  onProgress({ type: "step", message: `🏢 계층형 운영 조직(${operatingAgentCount}명) 설계 중...` });
  const hierarchy = await generateHierarchy({ ...input, requestedAgentCount: operatingAgentCount });

  const councilRoles = pickCouncilRoles(hierarchy);
  onProgress({ type: "step", message: `👥 ${hierarchy.length}명의 운영 에이전트와 ${councilRoles.length}명의 전략 위원회를 구성했습니다...` });

  onProgress({ type: "step", message: "🧠 1차 의견 수집 중: 전략 위원회가 아이디어를 분석하고 있습니다..." });
  const opinions = await Promise.all(
    councilRoles.map(async (role) => {
      onProgress({ type: "log", role, content: "분석 시작..." });
      const opinion = await collectOpinion(input, role, hierarchy);
      onProgress({ type: "log", role, content: `의견 제출 완료 (Stance: ${opinion.stance})` });
      return opinion;
    })
  );

  onProgress({ type: "step", message: "🔥 2차 상호 토론 중: 전략 위원회가 의견을 조정합니다..." });
  const debateRound = await Promise.all(
    councilRoles.map(async (role) => {
      onProgress({ type: "log", role, content: "다른 전문가 의견을 검토하고 응답을 준비 중..." });
      const debateResult = await debate(input, role, opinions);
      onProgress({ type: "log", role, content: "토론 의견 제출 완료" });
      return debateResult;
    })
  );

  onProgress({ type: "step", message: "🤝 최종 합의 도출 중: 모든 논의를 종합하여 결론을 내립니다..." });
  const consensusSummary = await consensus(input, opinions, debateRound, hierarchy);
  onProgress({ type: "log", content: "최종 합의안 작성 완료" });

  onProgress({ type: "step", message: "📐 최종 설계도 작성 중: 계층형 운영 구조와 리스크 관리 방안을 수립합니다..." });
  const systemBlueprint = await createBlueprint(input, consensusSummary, hierarchy);
  onProgress({ type: "log", content: "설계도 작성 완료" });

  const result: DesignResult = {
    designId: randomUUID(),
    timestamp: new Date().toISOString(),
    input: {
      ...input,
      requestedAgentCount: hierarchy.length
    },
    opinions,
    debateRound,
    consensusSummary,
    systemBlueprint
  };

  onProgress({ type: "result", data: result });
  return result;
}

function composeBuildPrompt(design: DesignResult): string {
  return [
    "You are an implementation council composed of hierarchical startup agents.",
    "Generate practical and executable startup build output in Korean.",
    JSON.stringify(design, null, 2),
    "Must include: detailed technical plan, milestone schedule, deployment checklist, observability strategy.",
    "The operating model should support proactive autonomous execution with minimal human intervention."
  ].join("\n");
}

export async function buildFromDesign(design: DesignResult): Promise<BuildResult> {
  const operatingRoles = design.systemBlueprint.operatingHierarchy.map((agent) => agent.role);

  const buildPlanPromise = generateText(
    "You are a senior multi-agent implementation orchestrator for startup platforms.",
    composeBuildPrompt(design)
  );

  const promptsPromise = generateJson<Record<string, string>>(
    "You are a Prompt Engineering Expert. Generate high-quality system prompts for each agent role. Respond in valid JSON.",
    [
      "Follow OpenAI Best Practices:",
      "1. Assign a distinct Persona.",
      "2. Provide specific Context & Constraints from the design.",
      "3. Use 'Chain of Thought' instructions.",
      "4. Define clear Output Formats.",
      "5. Include reporting line and autonomous execution responsibility.",
      `Design Context: ${JSON.stringify(design.input)}`,
      `Consensus: ${design.consensusSummary}`,
      `Operating Roles: ${operatingRoles.join(", ")}`,
      `Operating Hierarchy: ${JSON.stringify(design.systemBlueprint.operatingHierarchy)}`,
      "Return JSON: { [RoleName]: 'System Prompt Text...' }"
    ].join("\n")
  );

  const [buildPlan, prompts] = await Promise.all([buildPlanPromise, promptsPromise]);

  const runnerCodePromise = generateText(
    "You are a Senior TypeScript Developer. Generate a ready-to-run 'agent_runner.ts' file.",
    [
      "Requirements:",
      "1. Use 'openai' and 'dotenv' packages.",
      "2. Include the following system prompts as const variables.",
      "3. Implement a CLI loop using 'readline' to select an agent and chat.",
      "4. Code must be complete, with imports and error handling.",
      "5. No placeholders. Make it work immediately.",
      `Prompts: ${JSON.stringify(prompts, null, 2)}`
    ].join("\n")
  );

  const runnerCode = await runnerCodePromise;

  const generatedArtifacts = [
    {
      name: "agent-prompts.json",
      content: JSON.stringify(prompts, null, 2)
    },
    {
      name: "agent_runner.ts",
      content: runnerCode
    },
    {
      name: "agent-topology.yaml",
      content: `designId: ${design.designId}\noperatingAgentCount: ${design.systemBlueprint.operatingHierarchy.length}\nroles:\n${design.systemBlueprint.operatingHierarchy
        .map((agent) => `  - role: ${agent.role}\n    tier: ${agent.tier}\n    mission: ${agent.mission.replace(/\n/g, " ")}\n    reportsTo: ${agent.reportsTo ?? "none"}`)
        .join("\n")}\nstrategy: |\n  ${design.systemBlueprint.agentTopology.replace(/\n/g, "\n  ")}\n`
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
    generatedArtifacts.map((artifact) => writeFile(path.join(outputDirectory, artifact.name), artifact.content, "utf-8"))
  );

  const operationsChecklist = [
    "OPENAI_API_KEY/OPENAI_MODEL 운영 키 분리 및 회전 정책 적용",
    "프롬프트/응답 로깅 및 PII 마스킹 적용",
    "계층형 보고 체계 기준으로 승인 게이트 및 예외 escalation 경로 정의",
    "운영 에이전트 자율 실행 KPI(완료율, 재시도율, 에러율) 대시보드 운영",
    "릴리즈 전 샌드박스 환경에서 회귀 테스트 실행"
  ];

  return {
    designId: design.designId,
    timestamp: new Date().toISOString(),
    buildPlan,
    generatedArtifacts,
    operationsChecklist,
    outputDirectory,
    agentPrompts: prompts
  };
}
