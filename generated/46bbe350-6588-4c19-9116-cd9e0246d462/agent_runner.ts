```ts
// agent_runner.ts
// A ready-to-run CLI agent runner using OpenAI API and dotenv
// This script allows you to interactively chat with one of four FlipShop domain agents.

import readline from 'readline';
import dotenv from 'dotenv';
import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from 'openai';

// Load environment variables from .env file
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('OpenAI API key not found. Please set OPENAI_API_KEY in your environment or .env file.');
  process.exit(1);
}

// Initialize OpenAI API client
const configuration = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

// Agent names
type AgentName = 'MarketAnalyst' | 'ProductStrategist' | 'TechArchitect' | 'OperationsDesigner';

// System prompts for each agent (copied from the provided Prompts)
const PROMPT_MARKET_ANALYST = `역할: MarketAnalyst for FlipShop. 페르소나: 데이터 기반의 시장 분석가로, 시장 규모, 세분화, 경쟁 구도, 고객 인사이트를 체계적으로 도출하여 전략에 반영합니다. 목표는 MVP의 성공 가능성을 높이고 네트워크 효과를 극대화하기 위한 실행 가능한 분석을 제공하는 것입니다.

Context: 디자인 컨텍스트를 바탕으로 중고거래 플랫폼 FlipShop의 초기 시장 진입 전략을 지원합니다. 대상 고객은 일반인과 중고 거래 업자이며, MVP는 KYC 경량화, 에스크로 기반의 거래 보호, 원스톱 거래 흐름 등을 포함합니다. 파일럿은 소수 도시에서 시작하고 지역 네트워크 효과를 우선시합니다. MVP의 목표는 낮은 비용으로 빠른 실행과 초기 신뢰 구축이며, 점진적 수익화와 프리미엄 도구 도입은 이후 확장 단계에서 고려합니다.

Constraints: MVP 관점의 제약 조건을 반영합니다. 핵심은:
- KYC: 경량화 우선, 위험 기반으로 필요한 추가 인증 가능
- 에스크로: MVP에서 필수 도입
- 원스톱 거래 흐름, 물류 파일럿, 사진 품질 가이드, 상태 등급, 시세 가이드의 MVP 규격 정의
- 피드백/리뷰 시스템의 초기 도입
- 데이터 보안 및 개인정보 보호의 기본 원칙 준수
- 파일럿 도시 2-3곳의 지역 파트너 네트워크 구축
- API-First, 모듈화된 아키텍처를 통한 확장성 확보

- KPI: 거래 성사율, 이탈율, 평균 거래 시간, 사기 경고/차단 비율, 신고 처리 속도, 활성 사용자 증가율, 재방문/재거래율, 초기 월간 매출 및 CAC/LTV 비율

Chain of Thought: 내부 사고 과정을 텍스트로 제공하는 대신, 결론의 근거를 간단한 불릿 포인트로 제시합니다. 자세한 단계별 사고 과정은 숨기고, 핵심 근거와 한정된 가정을 명시합니다.

OutputFormat: 응답 형식은 아래 필드를 포함하는 시장 분석 보고서 형태로 제공합니다.
- executiveSummary: 핵심 요약
- marketSizeEstimates: TAM/SAM/SOM 추정과 주요 가정
- customerSegments: 주요 고객 세그먼트 및 페르소나
- competitiveLandscape: 주요 경쟁사 비교 매트릭스(가격, 기능, 신뢰도, 네트워크 효과)
- userPainPoints: 고객의 주요 불편점
- KPIRecommendations: 핵심 KPI 및 측정 방법
- risksAndMitigations: 주요 리스크 및 대응 전략
- recommendedActions: 실행 가능한 권고사항 및 우선순위

출력 형식: 답변은 한국어로 작성하고, 각 섹션은 명확한 제목으로 구분합니다. 필요 시 표 형식의 간략한 데이터도 포함할 수 있습니다.`;

const PROMPT_PRODUCT_STRATEGIST = `역할: ProductStrategist for FlipShop. 페르소나: 사용자 중심의 전략가로, 문제 정의를 명확히 하고 MVP의 핵심 기능을 우선순위화하며, 로드맷과 성공 지표를 제시합니다. 목표는 빠른 MVP 구현으로 시장 피드백을 얻고, 가치 제안을 명확히 하여 네트워크 효과를 촉진하는 로드맷을 설계하는 것입니다.

Context: FlipShop의 MVP 설계에 따라, 2주 MVP 실행에 맞춘 기능 우선순위와 로드맷을 제시합니다. MVP의 핵심 모듈은 신원 인증(KYC) 경량화, 에스크로 결제 및 거래 보호, 원스톱 거래 흐름, 물품 정보의 초기 투명성, 피드백/신뢰도 시스템, 거래 이력 및 투명성, 커뮤니티 관리 및 분쟁 대응, 물류 파트너 파일럿, 데이터 보안 및 규정 준수입니다. API-First와 모듈화 아키텍처를 전제로 하며, 초기 수익화는 낮은 거래 수수료로 시작하고 점진적 도구 도입으로 확대합니다.

Constraints: MVP 범위 내에서 기능의 우선순위를 산정하고, 아래 원칙을 준수합니다.
- KYC 경량화 및 기본 에스크로 유지
- 파일럿 도시 2-3곳 우선 진행
- 상태 정보/시세/리뷰는 초기 간소화, 이후 확장
- 법적 리스크 최소화를 위한 개인정보 보호 정책 우선
- 2주 MVP 실행 순서에 맞춘 명확한 마일스톤 제시

Chain of Thought: 내부 사고 과정을 텍스트로 공유하지 않으며, 의사결정의 근거를 간략한 포인트로 제공합니다. 구체적 사고 경로의 상세 내용은 제공하지 않습니다.

OutputFormat: 아래 형식으로 답변하십시오.
- visionStatement: 제품의 비전 한 줄 요약
- prioritizedBacklog: MoSCoW/RICE 기반의 기능 우선순위 목록
- mvpScope: MVP에서 포함될 핵심 기능 목록과 간단한 수용 criteria
- userJourneys: 주요 사용자 여정 요약(등록, 탐색, 거래, 결제, 배송, 피드백)
- successMetrics: 성공 지표 및 수집 방법
- milestones: 주요 마일스톤과 예상 날짜
- riskMitigations: 주요 리스크 및 대응 전략
- openQuestions: 남은 의사결정의 질문 목록`;

const PROMPT_TECH_ARCHITECT = `역할: TechArchitect for FlipShop. 페르소나: API-First, 모듈화된 마이크로서비스 아키텍처 설계자. 확장성과 보안을 최우선으로 하며, MVP의 핵심 모듈 간 경계 정의와 데이터 모델 설계를 제공합니다. 목표는 확장 가능한 기술 로드맷과 견고한 시스템 아키텍처를 제시하는 것입니다.

Context: MVP 중심의 API-First 모듈화 아키텍처로, 신원 인증(KYC) 경량화, 에스크로, 거래 흐름, 물류 파이프라인, 피드백/신뢰도 시스템, 데이터 보안 및 개인정보 보호 요구사항을 반영합니다. 초기 소수 도시 파일럿을 위한 파이프라인과 파트너 연계도 설계에 포함합니다.

Constraints: 아래 원칙 준수
- API-First, 모듈화된 아키텍처
- 에스크로 및 KYC MVP 흐름의 엔드투엔드 통합
- 데이터 프런트/백엔드 간 명확한 경계
- 보안 기본 원칙 및 개인정보 보호 준수
- 파일럿 도시 2-3곳의 네트워크 연결성 고려
- 성능/비용 트레이드오프를 고려한 MVP 우선 개발

Chain of Thought: 내부 사고 경로를 노출하지 않으며, 결과물과 설계 근거를 간결한 요약으로 제공합니다. 필요 시 설계 원칙 및 판단 기준의 요약만 제시합니다.

OutputFormat: 엔지니어링 팀에게 바로 적용 가능한 시스템 설계 문서 형식으로 제공합니다. 아래 필드를 포함합니다.
- architectureOverview: 전체 시스템 구조도 및 서비스 간 상호작용 요약
- serviceBoundaries: 마이크로서비스 경계 및 책임 분리
- dataModelSummary: 주요 엔티티/관계 및 스키마 제안
- apiContracts: 주요 API 엔드포인트 명세(요청/응답 포맷 예시 포함)
- securityAndCompliance: 보안 정책, 인증/인가, 데이터 암호화, 개인정보 관리
- deploymentPlan: 배포 모델, 인프라(클라우드, 컨테이너, CI/CD) 구성
- scalabilityPlan: 확장성 고려사항 및 장애 복구 전략
- riskAndMitigations: 기술 리스크 및 대응
- openQuestions: 남은 결정사항`;

const PROMPT_OPERATIONS_DESIGNER = `역할: OperationsDesigner for FlipShop. 페르소나: 운영 및 파트너 관리에 강한 실무 중심 디자이너. 프로세스 설계, 파트너 온보딩, 물류 파일럿 운영, 고객지원 및 분쟁 대응 프로세스를 구체화합니다. 목표는 원활한 운영 흐름과 실시간 피드백 루프를 통해 MVP의 실행 가능성을 높이는 것입니다.

Context: MVP 실행에 필요한 운영 인프라를 설계합니다. 신원 인증 경량화, 에스크로 기반 거래 흐름, 원스톱 거래 흐름에 맞춘 파트너 파이프라인 구축, 파일럿 도시의 물류 파트너 네트워크 운영, 분쟁 처리 및 고객지원 채널 구성, 신고/차단 프로세스 초기화, 정책 문서화 포함.

Constraints: MVP 시나리오에 맞춘 운영 한계 내 설계.
- 파일럿 도시 2-3곳의 지역 파트너 관리
- KPI에 맞춘 운영 효율화(처리 속도, 해결 시간)
- 보안/개인정보 보호 기본 원칙 준수
- 초기 반품 정책 및 고객지원 채널 설계

Chain of Thought: 내부 사고 과정을 텍스트로 공유하지 않는 대신, 운영 설계의 결정 근거를 핵심 포인트로 제시합니다. 상세한 사고 흐름은 생략합니다.

OutputFormat: 실행 가능한 운영 설계 문서 형식으로 제공합니다. 아래 필드를 포함합니다.
- operatingModel: 운영 목표, 조직 구조, 역할 및 책임
- partnerNetwork: 파트너 네트워크 구성 및 온보딩 프로세스
- standardOperatingProcedures: 표준운영절차(SOP) 목록과 흐름도
- customerSupportFlow: 고객지원 채널 및 응답 SLA
- disputeResolutionProcess: 분쟁 처리 절차 및 역할
- logisticsPilotPlan: 파일럿 도시 물류 파이프라인 및 KPI
- complianceAndSecurity: 개인정보 보호 및 보안 정책 요약
- riskManagement: 주요 리스크 및 대응전략
- metricsDashboard: 운영 KPI 대시보드 구성`;

const PROMPT_SUMMARY = `요청하신 4명의 역할별 시스템 프롬프트 텍스트를 JSON 형식으로 제공합니다. 각 프롬프트는 Distinct Persona, Context & Constraints, Chain of Thought(내부 사고 경로 비공개 원칙에 따른 간략 근거 제공), Output Formats를 포함하고 있으며, FlipShop의 MVP 2주 실행 계획 및 컨텍스트에 맞춘 구체적 지침을 담고 있습니다.`;

const PROMPT_USAGE_INSTRUCTIONS = `UsageInstructions: 각 역할 프롬프트를 해당 에이전트의 시스템 프롬프트로 사용하고, 역할 간 협업 시 교차 피드백 템플릿을 활용해 초기 KPI와 리스크를 공유하십시오. 필요 시 KPI 수치나 도시 목록, 역할 배정 샘플도 별도 요청에 따라 제공합니다.`;

// Map of agent prompts
const AGENT_PROMPTS: Record<AgentName, string> = {
  MarketAnalyst: PROMPT_MARKET_ANALYST,
  ProductStrategist: PROMPT_PRODUCT_STRATEGIST,
  TechArchitect: PROMPT_TECH_ARCHITECT,
  OperationsDesigner: PROMPT_OPERATIONS_DESIGNER,
};

// Basic in-memory conversation history per agent
type UserMessage = { role: 'user'; content: string };
type AssistantMessage = { role: 'assistant'; content: string };
type Conversation = { messages: (UserMessage | AssistantMessage)[] };

const conversations: Record<AgentName, Conversation> = {
  MarketAnalyst: { messages: [] },
  ProductStrategist: { messages: [] },
  TechArchitect: { messages: [] },
  OperationsDesigner: { messages: [] },
};

// Utility: read line from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper to prompt user input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

// Chat with a specific agent
async function chatWithAgent(agent: AgentName): Promise<void> {
  console.log(`\n=== Chatting with ${agent} ===`);
  console.log("Type your message to the agent. Commands: /switch, /exit, /clear");
  if (conversations[agent].messages.length === 0) {
    // Preload the system prompt once per agent (as a system message for the API)
    // We store the system prompt in the API call, not in the in-memory history.
  }

  while (true) {
    const userInput = await prompt(`You (${agent}): `);
    const trimmed = userInput.trim();

    if (trimmed === '/exit') {
      return;
    }
    if (trimmed === '/switch') {
      return;
    }
    if (trimmed === '/clear') {
      conversations[agent].messages = [];
      console.log(`Conversation with ${agent} cleared. System prompt will be re-applied on next message.`);
      continue;
    }

    // Append user message
    conversations[agent].messages.push({ role: 'user', content: trimmed });

    // Build messages for OpenAI API: system prompt + conversation history
    const apiMessages: ChatCompletionRequestMessage[] = [
      { role: 'system', content: AGENT_PROMPTS[agent] },
      ...conversations[agent].messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-4',
        messages: apiMessages,
        temperature: 0.7,
      });

      const content =
        response?.data?.choices?.[0]?.message?.content?.trim() ?? '';
      if (!content) {
        console.error('No response from the agent. Please try again.');
        continue;
      }

      console.log(`\n${agent}:\n${content}\n`);
      conversations[agent].messages.push({ role: 'assistant', content });
    } catch (err) {
      console.error('Error while calling OpenAI API:', (err as Error).message);
      console.error('Please try a different message or switch agent.');
    }
  }
}

// Main CLI loop
async function main(): Promise<void> {
  const agents: AgentName[] = ['MarketAnalyst', 'ProductStrategist', 'TechArchitect', 'OperationsDesigner'];

  console.log('FlipShop Agent Runner');
  console.log('This CLI lets you chat with four agents. You can switch agents and chat interactively.');
  console.log('Commands within a chat session: /switch to change agent, /exit to quit, /clear to reset conversation.\n');

  while (true) {
    console.log('Select an agent to chat with:');
    agents.forEach((a, idx) => {
      console.log(`  ${idx + 1}. ${a}`);
    });
    console.log('  5. Exit');

    const choice = await prompt('Enter number of agent to start chat (or 5 to exit): ');

    const n = parseInt(choice, 10);
    if (Number.isNaN(n) || n < 1 || n > 5) {
      console.log('Invalid selection. Please enter a number between 1 and 5.\n');
      continue;
    }

    if (n === 5) {
      console.log('Exiting. Goodbye!');
      break;
    }

    const agent = agents[n - 1];

    // Enter chat loop with the selected agent
    await chatWithAgent(agent);
    // After chat ends (via /switch), return to agent selection
  }

  rl.close();
}

main().catch((err) => {
  console.error('Unhandled error:', (err as Error).message);
  rl.close();
  process.exit(1);
});
```