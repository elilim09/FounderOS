import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateJson, generateText } from "./openaiClient.js";
import { AgentDebate, AgentOpinion, AgentRole, BuildResult, DesignResult, DesignProgress, SystemBlueprint, UserIdeaInput, WorkshopApproval, WorkshopEvent, WorkshopState, WorkshopTask } from "./types.js";

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

export async function designMultiAgentSystem(
  input: UserIdeaInput,
  onProgress: (progress: DesignProgress) => void
): Promise<DesignResult> {
  onProgress({ type: "step", message: "🚀 AI 설계를 시작합니다..." });
  const roles = pickRoles(input.requestedAgentCount);

  onProgress({ type: "step", message: `👥 ${roles.length}명의 AI 전문가를 소집하고 있습니다...` });

  // 1. Collect Opinions
  onProgress({ type: "step", message: "🧠 1차 의견 수집 중: 각 전문가가 아이디어를 분석하고 있습니다..." });
  const opinions = await Promise.all(
    roles.map(async (role) => {
      onProgress({ type: "log", role, content: "분석 시작..." });
      const opinion = await collectOpinion(input, role);
      onProgress({ type: "log", role, content: `의견 제출 완료 (Stance: ${opinion.stance})` });
      return opinion;
    })
  );

  // 2. Debate
  onProgress({ type: "step", message: "🔥 2차 상호 토론 중: 전문가들이 서로의 의견을 검토하고 논의합니다..." });
  const debateRound = await Promise.all(
    roles.map(async (role) => {
      onProgress({ type: "log", role, content: "다른 전문가 의견을 검토하고 응답을 준비 중..." });
      const debateResult = await debate(input, role, opinions);
      onProgress({ type: "log", role, content: "토론 의견 제출 완료" });
      return debateResult;
    })
  );

  // 3. Consensus
  onProgress({ type: "step", message: "🤝 최종 합의 도출 중: 모든 논의를 종합하여 결론을 내립니다..." });
  const consensusSummary = await consensus(input, opinions, debateRound);
  onProgress({ type: "log", content: "최종 합의안 작성 완료" });

  // 4. Blueprint
  onProgress({ type: "step", message: "📐 최종 설계도 작성 중: 시스템 구조와 리스크 관리 방안을 수립합니다..." });
  const systemBlueprint = await createBlueprint(input, consensusSummary);
  onProgress({ type: "log", content: "설계도 작성 완료" });

  const result: DesignResult = {
    designId: randomUUID(),
    timestamp: new Date().toISOString(),
    input,
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
    "You are an implementation council composed of multiple agents.",
    "Generate practical and executable startup build output in Korean.",
    JSON.stringify(design, null, 2),
    "Must include: detailed technical plan, milestone schedule, deployment checklist, observability strategy."
  ].join("\n");
}

export async function buildFromDesign(design: DesignResult): Promise<BuildResult> {
  // 1. Generate Build Plan
  const buildPlanPromise = generateText(
    "You are a senior multi-agent implementation orchestrator for startup platforms.",
    composeBuildPrompt(design)
  );

  // 2. Generate Optimized Prompts (OpenAI Academy Style)
  const promptsPromise = generateJson<Record<string, string>>(
    "You are a Prompt Engineering Expert. Generate high-quality system prompts for each agent role. Respond in valid JSON.",
    [
      "Follow OpenAI Best Practices:",
      "1. Assign a distinct Persona.",
      "2. Provide specific Context & Constraints from the design.",
      "3. Use 'Chain of Thought' instructions.",
      "4. Define clear Output Formats.",
      `Design Context: ${JSON.stringify(design.input)}`,
      `Consensus: ${design.consensusSummary}`,
      `Roles: ${design.opinions.map(o => o.role).join(", ")}`,
      "Return JSON: { [RoleName]: 'System Prompt Text...' }"
    ].join("\n")
  );

  const [buildPlan, prompts] = await Promise.all([buildPlanPromise, promptsPromise]);

  // 3. Generate Executable Runner Code
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
    outputDirectory,
    agentPrompts: prompts
  };
}


function seedWorkshopTasks(design: DesignResult): WorkshopTask[] {
  const roles = design.opinions.map((opinion) => opinion.role);
  return [
    {
      id: randomUUID(),
      title: "핵심 사용자 여정 가설 정교화",
      owner: roles[0] ?? "ProductStrategist",
      status: "queued",
      critical: false,
      notes: "설계 산출물 기반으로 자동 세분화"
    },
    {
      id: randomUUID(),
      title: "결제/개인정보 처리 정책 최종 확정",
      owner: roles[1] ?? roles[0] ?? "OperationsDesigner",
      status: "queued",
      critical: true,
      notes: "법적/신뢰 이슈가 있어 사용자 승인 필요"
    },
    {
      id: randomUUID(),
      title: "MVP 기술 스택 배포 파이프라인 점검",
      owner: roles[2] ?? roles[0] ?? "TechArchitect",
      status: "queued",
      critical: false,
      notes: "멀티 에이전트 자동 실행 가능"
    },
    {
      id: randomUUID(),
      title: "초기 유료화 실험 정책 확정",
      owner: roles[3] ?? roles[0] ?? "GrowthPlanner",
      status: "queued",
      critical: true,
      notes: "가격/브랜드 영향이 커서 승인 게이트 필요"
    }
  ];
}

export function createWorkshopFromBuild(design: DesignResult): WorkshopState {
  const now = new Date().toISOString();
  const tasks = seedWorkshopTasks(design);
  return {
    designId: design.designId,
    startupName: design.input.startupName,
    status: "idle",
    cycle: 0,
    tasks,
    pendingApprovals: [],
    events: [
      {
        id: randomUUID(),
        timestamp: now,
        role: "Facilitator",
        type: "auto_progress",
        message: "가상 작업실이 초기화되었습니다. 자동 실행 준비 완료."
      }
    ],
    summary: "가상 작업실 준비 완료",
    createdAt: now,
    updatedAt: now
  };
}

function updateSummary(tasks: WorkshopTask[], pendingApprovals: WorkshopApproval[]): string {
  const done = tasks.filter((task) => task.status === "done").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  return `완료 ${done}/${tasks.length} · 차단 ${blocked} · 승인대기 ${pendingApprovals.length}`;
}

export function runWorkshopCycle(workshop: WorkshopState): WorkshopState {
  const next: WorkshopState = JSON.parse(JSON.stringify(workshop));
  const now = new Date().toISOString();
  next.cycle += 1;
  next.status = "running";

  for (const task of next.tasks) {
    if (task.status === "done" || task.status === "blocked") continue;

    if (task.critical) {
      const existing = next.pendingApprovals.find((approval) => approval.taskId === task.id && approval.status === "pending");
      if (!existing) {
        const approval: WorkshopApproval = {
          id: randomUUID(),
          taskId: task.id,
          role: task.owner,
          reason: `중요 사안 '${task.title}' 진행 전 사용자 확인 필요`,
          status: "pending",
          requestedAt: now
        };
        next.pendingApprovals.push(approval);
        task.status = "blocked";
        next.events.unshift({
          id: randomUUID(),
          timestamp: now,
          role: task.owner,
          type: "approval_requested",
          message: `승인 요청: ${task.title}`
        });
      }
      continue;
    }

    task.status = task.status === "queued" ? "in_progress" : "done";
    next.events.unshift({
      id: randomUUID(),
      timestamp: now,
      role: task.owner,
      type: "auto_progress",
      message: `${task.title} → ${task.status === "in_progress" ? "자동 실행 시작" : "자동 완료"}`
    });
  }

  if (next.tasks.every((task) => task.status === "done" || task.status === "blocked")) {
    next.status = next.pendingApprovals.length ? "paused" : "completed";
  }

  next.summary = updateSummary(next.tasks, next.pendingApprovals);
  next.updatedAt = now;
  return next;
}

export function resolveWorkshopApproval(
  workshop: WorkshopState,
  approvalId: string,
  decision: "approved" | "rejected"
): WorkshopState {
  const next: WorkshopState = JSON.parse(JSON.stringify(workshop));
  const now = new Date().toISOString();
  const approval = next.pendingApprovals.find((item) => item.id === approvalId);

  if (!approval || approval.status !== "pending") {
    return next;
  }

  approval.status = decision;
  approval.resolvedAt = now;

  const task = next.tasks.find((item) => item.id === approval.taskId);
  if (task) {
    task.status = decision === "approved" ? "queued" : "blocked";
  }

  next.events.unshift({
    id: randomUUID(),
    timestamp: now,
    role: "Facilitator",
    type: "approval_resolved",
    message: `${task?.title ?? "작업"} 승인 결과: ${decision === "approved" ? "승인" : "반려"}`
  });

  next.pendingApprovals = next.pendingApprovals.filter((item) => item.status === "pending");
  next.status = decision === "approved" ? "running" : "paused";
  next.summary = updateSummary(next.tasks, next.pendingApprovals);
  next.updatedAt = now;
  return next;
}
