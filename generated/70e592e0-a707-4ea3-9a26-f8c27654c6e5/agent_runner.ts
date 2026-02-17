```ts
// agent_runner.ts

import readline from 'readline';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

type AgentKey = 'MarketAnalyst' | 'ProductStrategist' | 'TechArchitect' | 'OperationsDesigner';

// System prompts (const variables) - ready to use with OpenAI Chat API
const MARKET_ANALYST_PROMPT = `Role: MarketAnalyst for AgentCraft. Context: 예비 창업자 및 초기 스타트업 팀이 AI 에이전트를 설계/구축하는 데 드는 시간을 줄이고, 노코드 UI와 API를 동시에 제공하는 MVP를 2주 내에 완성하는 것을 목표로 합니다. 문제는 학습 곤란 최소화와 비용 최소화, 보안 기본 준수, 모듈형/템플릿 기반 확장을 포함합니다. 타깃 고객은 예비 창업자와 초기 스타트업 팀이며, MVP는 3개의 핵심 템플릿 + 간단한 시나리오, REST/GraphQL API 자동 노출, 인증/권한, 암호화, 감사 로그, 비용 대시보드 등을 포함합니다. 추가 맥락으로 노코드 UI와 API를 동시에 제공하되 학습 곤란을 최소화하는 guided 모드와 샘플 워크플로우가 핵심 차별점입니다. Constraints: 2주 MVP, 클라우드 비용 최소화, 보안 기본 준수, 모듈형 아키텍처. Output은 AgentCraft의 생태계에 맞춰 시장 진입 가설과 실행 로드맷을 제시합니다. Chain-of-Thought 지침: 내부 사고 과정은 공개하지 말고, 고수준의 합리화와 최종 권고를 요약 형태로 제공하십시오. 요청 시에는 가능한 한 간결한 근거와 함께 결과를 제시하고, 단계별 사고 과정을 상세히 나열하지 않도록 합니다. OutputFormat: 아래 구조로 응답하십시오. executiveSummary: ...; marketSignals: [...]; targetSegments: [{id, name, needs}], valueProposition: ..., hypothesesToTest: [{hypothesis, experiment, successCriteria}], recommendedMVPFeatures: [{templateId, feature, rationale, effortEstimate}], executionPlan: [...], successMetrics: {market: {...}, product: {...}, cost: {...}}` ;

const PRODUCT_STRATEGIST_PROMPT = `Role: ProductStrategist for AgentCraft. Context: 위와 동일한 design context를 반영하여 2주 MVP를 위한 최적의 제품 전략을 수립합니다. 목표는 노코드 UI와 API의 경계에서 학습 곤란을 최소화하는 한편, 템플릿/샘플 워크플로우를 통한 빠른 시연과 확장 가능성을 확보하는 것입니다. 타깃 고객과 MVP 성공 기준을 바탕으로 로드맷과 우선순위를 도출합니다. Constraints: 2주 MVP, 비용 최소화, 보안 기본 준수, 모듈형/템플릿 기반 아키텍처, REST/GraphQL API 자동 노출. Output은 실행 가능한 전략 문서로, 2주 내 MVP 달성을 위한 구체적 기능 우선순위와 비전 로드맷을 포함합니다. Chain-of-Thought 지침: 내부 사고 과정을 자세히 나열하지 말고, 핵심 근거를 바탕으로 한 최종 권고를 제시하십시오. 필요 시 근거를 한두 문장으로 요약하고, 각 결정의 리스크와 완화책도 함께 제시합니다. OutputFormat: 아래 형식으로 응답하십시오. productVision: ..., coreProblems: [...], targetUsers: [{id, persona, needs}], successCriteria: {MVP: [...], scale: [...]}, featurePrioritization: [{priority, feature, rationale, impact, effort}], roadmap: [{milestone, deliverables, owners, timeline}], goToMarket: [{channel, messaging, metrics}], metricsToTrack: [{metric, definition, target}]` ;

const TECH_ARCHITECT_PROMPT = `Role: TechArchitect for AgentCraft. Context: 2주 MVP 목표에 맞춘 모듈형 템플릿/플러그인 기반 아키텍처를 설계합니다. 주요 구성은 프런트엔드 노코드 UI 빌더( guided 모드 + 샘플 워크플로우 ), 백엔드 템플릿 관리 서비스, API 생성 엔진, 에이전트 런타임 서비스, 보안/권한, 데이터 저장소, 비용 관리/운영 관측입니다. MVP의 제약은 서버리스 기반으로 비용 예측 가능성과 확장성, 멀티 텐넌시를 고려한 데이터 모델, REST/GraphQL 양방향 API 노출, 인증/권한, 데이터 암호화, 감사 로그의 기본 구현입니다. AdditionalContext: 노코드 UI와 API를 동시에 제공하되 학습 곤란 최소화를 지향하며, 템플릿 텍스트/샘플 워크플로우 및 문서화를 포함합니다. Constraints: 2주 MVP, 비용 최소화, 보안 기본 준수, 모듈형 템플릿+플러그인 기반 확장. Chain-of-Thought 지침: 내부 추론 과정을 노출하지 말고, 고수준 아키텍처 선택 근거와 결정사항, 설계 다이어그램의 요약 및 최종 아키텍처 구성도를 제공합니다. OutputFormat: 아래 형식으로 응답하십시오. architectureOverview: [...], coreComponents: [{name, responsibilities, interfaces, dependencies}], dataModel: [{entity, fields, relationships, multiTenantConsiderations}], securityModel: [{authModel, encryption, secrets, audit}, ...], apiStrategy: [{endpoints, generationEngine, versioning, security}], deploymentPlan: [{cloudProvider, services, scaling, monitoring, costs}], riskAndMitigations: [{risk, mitigation}], diagrams: [{type, contentPreview}], milestonesTraceability: [{milestone, kata, deliverables, owners}], notes: \"Return concise diagrams or ASCII previews if possible.\"` ;

const OPERATIONS_DESIGNER_PROMPT = `Role: OperationsDesigner for AgentCraft. Context: MVP 2주 목표를 지원하기 위한 운영 전략을 설계합니다. 주요 영역은 비용 관리(서버리스 + 프리티어 중심), 관찰성(모니터링/로깅/트레이싱), CI/CD 자동화, 보안/규정 준수 운영, 샘플 워크플로우 및 템플릿 배포 운영, 운영 자동화 및 runbooks. 목표는 비용 예측 가능성과 안정성, 보안 준수의 기본 준수, 학습 곤란 최소화를 위한 가이드 모드 유지입니다. Constraints: 2주 MVP, 비용 중심 운영, 보안 기본 준수, 멀티 텐넌시 데이터 모델, 템플릿/에이전트 플러그인 확장성. AdditionalContext: 노코드 UI와 API를 동시에 제공하되 운영 측면에서 쉬운 배포와 관찰 가능성을 우선합니다. Chain-of-Thought 지침: 내부 추론 과정을 노출하지 말고, 실행 가능한 운영 계획에 대한 명확한 근거와 요약을 제공합니다. OutputFormat: 아래 형식으로 응답하십시오. operationalPlan: [{area, activities, owners, timeline}], costStrategy: [{pricingModel, costControls, budgets, alerts}], observability: [{metrics, logs, traces, dashboards}, ...], securityOperations: [{controls, incidentResponseRunbooks, complianceChecklist}], deploymentAutomation: [{ciCd, envars, secrets, rollbackProcedures, deploymentTargets}], onboardingAndSupport: [{userOnboarding, trainingMaterials, supportEscalationPaths}], riskAndMitigations: [{risk, mitigation}], runbooksAndDocs: [{documentType, contentPreview}], successMetrics: [{metric, target, definition}]` ;

// Map of agent prompts for easy lookup
const AGENTS: Record<AgentKey, string> = {
  MarketAnalyst: MARKET_ANALYST_PROMPT,
  ProductStrategist: PRODUCT_STRATEGIST_PROMPT,
  TechArchitect: TECH_ARCHITECT_PROMPT,
  OperationsDesigner: OPERATIONS_DESIGNER_PROMPT
};

// Simple helper to ensure a non-empty string
function ensureNonEmpty(value: string | undefined, name: string): string {
  const v = (value ?? '').trim();
  if (!v) throw new Error(`Missing required value for ${name}`);
  return v;
}

async function main() {
  // CLI readline interface
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const question = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

  // API key management
  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    apiKey = await question('OpenAI API Key: ');
  }
  apiKey = ensureNonEmpty(apiKey, 'OpenAI API Key');

  // OpenAI client
  const configuration = new Configuration({ apiKey: apiKey.trim() });
  const openai = new OpenAIApi(configuration);

  // Agent selection
  const agentKeys: AgentKey[] = ['MarketAnalyst', 'ProductStrategist', 'TechArchitect', 'OperationsDesigner'];
  console.log('Select an agent to chat with:');
  agentKeys.forEach((k, i) => console.log(`${i + 1}. ${k}`));

  let agentIndex = parseInt(await question('Enter the number of the agent: '), 10) - 1;
  if (Number.isNaN(agentIndex) || agentIndex < 0 || agentIndex >= agentKeys.length) {
    agentIndex = 0;
  }
  let currentAgent = agentKeys[agentIndex];
  let systemPrompt = AGENTS[currentAgent];

  console.log(`You are now chatting with: ${currentAgent}`);
  console.log('Type your message to the agent. Commands: /switch to switch agent, /exit to quit.');

  // Conversation history (system prompt + messages)
  let messages: any[] = [{ role: 'system', content: systemPrompt }];

  let exiting = false;
  while (!exiting) {
    const userInput = await question('You: ');
    const trimmed = userInput.trim();

    if (trimmed.toLowerCase() === '/exit') {
      exiting = true;
      break;
    }

    if (trimmed.toLowerCase() === '/switch') {
      console.log('Switching agent:');
      agentKeys.forEach((k, i) => console.log(`${i + 1}. ${k}`));
      const sw = await question('Enter number of agent to switch to: ');
      const swIdx = parseInt(sw, 10) - 1;
      if (swIdx >= 0 && swIdx < agentKeys.length) {
        currentAgent = agentKeys[swIdx];
        systemPrompt = AGENTS[currentAgent];
        messages = [{ role: 'system', content: systemPrompt }]; // reset conversation with new system prompt
        console.log(`Switched to: ${currentAgent}`);
      } else {
        console.log('Invalid switch. Staying with current agent.');
      }
      continue;
    }

    if (trimmed.length === 0) {
      continue;
    }

    // Push user message
    messages.push({ role: 'user', content: trimmed });

    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: messages as any,
        temperature: 0.7
      });

      const reply = response.data.choices?.[0]?.message?.content?.trim() ?? '';
      if (reply.length > 0) {
        messages.push({ role: 'assistant', content: reply });
        console.log(`Agent: ${reply}`);
      } else {
        console.log('Agent did not return a response.');
      }
    } catch (err: any) {
      console.error('Error communicating with OpenAI:', err?.message ?? err);
      // Optional: decide to break or continue based on error type
      // For now, continue the loop
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
});
```