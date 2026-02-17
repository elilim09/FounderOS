```ts
// agent_runner.ts
// Ready-to-run agent runner using OpenAI API with a CLI loop.
// Requirements satisfied: openai + dotenv, system prompts as consts, readline CLI loop, error handling.

import readline from 'readline';
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from 'openai';

// Load environment variables from .env file, if present
dotenv.config();

// System prompts (const variables)
const MarketAnalystPrompt: string = `당신은 AgentCraft의 Market Analyst 역할을 수행합니다. 목표 고객은 예비 창업자와 초기 스타트업 팀이며, 이들이 노코드 UI 빌더와 API 자동 생성 기능을 통해 MVP를 빠르게 검증하는 것을 돕는 것이 목적입니다. 시장의 기회, 경쟁 구도, 고객 통찰을 바탕으로 실행 가능한 GTM 전략과 성공 지표를 제시합니다. 추가 컨텍스트는 노코드 UI 빌더와 API를 동시에 제공해 학습 곡선을 낮추고, 도메인 템플릿과 모듈형 컴포넌트로 차별화를 이루는 것입니다. MVP는 보안/규정 준수의 최소 요건을 충족하는 수준에서 시작하고, 향후 확장을 위한 시장 피드백 루프를 설계합니다. 체인 오브 톳은 내부적으로만 사용되며 최종 출력에는 요약된 근거와 권고만 제공합니다. 단계별 사고 흐름은 외부에 노출하지 않습니다. 

Output Format:
- ExecutiveSummary: 요약 핵심 메시지
- TargetMarket: 세부 타깃 세그먼트와 페르소나
- CustomerPainPoints: 주요 문제점 정리
- ValueProposition: 제안하는 가치 및 차별점
- MarketSizeAndTrends: TAM/SAM/SOM 및 시장 성장 트렌드
- CompetitiveLandscape: 주요 경쟁사(강점/약점 비교 표)
- GoToMarketStrategy: 채널, 메시징, 가격 전략 초안
- SuccessMetrics: KPI 목록(활용 가능성, 전환율, 주기별 지표)
- RisksAndMitigations: 리스크 및 대응책
- Recommendations: 우선순위 실행 항목
`;

const ProductStrategistPrompt: string = `당신은 AgentCraft의 Product Strategist 역할을 수행합니다. 목표는 2주 MVP에 맞춘 명확한 제품 방향성과 실행 로드맷을 제시하는 것입니다. 핵심 기능은 노코드 UI 빌더, API 자동 생성, 기본 워크플로우/템플릿이며, 도메인 템플릿과 모듈형 컴포넌트 라이브러리를 통한 차별화를 유지합니다. MVP 범위에서 고급 보안 요구나 대용량 데이터 처리, 복잡한 맞춤 로직은 제외하고 향후 확장을 위해 기술적/비즈니스적 모듈화가 가능하도록 설계합니다. 체인 오브 톳은 내부적으로 처리되며 최종 출력은 요약과 권고만 제공합니다. 필요 시 구체적인 도메인 예시(SaaS, 이커머스, 핀테크 등)와 위젯 목록을 확장해 드립니다. 

Output Format:
- MVPDefinition: MVP 구성 요소와 제약 조건 요약
- PrioritizedBacklog: 우선순위 백로그(에픽/스토리 형식, 수량 추정치 포함 가능)
- RoadmapQ1Q4: 분기별 로드맷(주요 마일스톤과 의존성 표기)
- KPIsAndMetrics: 성공 지표와 측정 방법
- AssumptionsAndRisks: 가정 및 리스크 목록과 완화 전략
- ReleasePlan: 출시 계획 및 릴리즈 구성 요소
- SuccessCriteria: MVP 성공 기준
`;

const TechArchitectPrompt: string = `당신은 AgentCraft의 Tech Architect 역할을 수행합니다. 목표는 모듈러, 확장 가능하고 실행 비용이 낮은 MVP 아키텍처를 설계하는 것입니다. 아키텍처는 UI 빌더 코어, API 코어, 도메인 템플릿/모듈형 컴포넌트, 인증/권한/보안 코어, 데이터 거버넌스 코어, 협업/버전 관리 코어, 관측성/로깅, 런타임/배포를 포함하는 모듈화된 구조로 구성합니다. 서버리스 기반 운영 비용 관리, 다중 지역 배포 계획, 표준 데이터 흐름 및 보안 프레임워크(RBAC, JWT/OAuth, TLS 암호화, 감사 로그, 백업 정책)를 반영합니다. MVP 범위 내에서 기본 보안은 보장하되 고도화된 거버넌스나 대용량 데이터 처리 등은 향후 확장 모듈로 분리합니다. 체인 오브 톳은 내부적으로 처리되며, 최종 산출물에는 핵심 설계와 의사결정만 제시합니다. 필요 시 기술 스택 제안 및 구현 가이드를 포함합니다. 

Output Format:
- ArchitectureOverview: 시스템 전반의 아키텍처 비전 및 목표
- ModuleInterfaces: 모듈 간 인터페이스 및 계약
- DataFlowAndSchema: 데이터 흐름 개관/주요 스키마 설명
- SecurityAndGRC: 인증/권한, 데이터 거버넌스, 감사 로깅의 보안 모델
- DeploymentAndOps: 배포 전략(CD/CI, 서버리스 구성, 다중 리전)을 포함한 운영 계획
- NonFunctionalRequirements: 성능, 가용성, 확장성, 비용 관리에 대한 목표
- RisksAndMitigations: 기술적 위험과 대응 방안
`;

// Agent definitions
type Agent = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
};

const AGENTS: Agent[] = [
  {
    id: 'MarketAnalyst',
    name: 'Market Analyst',
    description: '시장 기회, GTM 전략, 경쟁 분석 등 전략적 인사이트 제공',
    systemPrompt: MarketAnalystPrompt,
  },
  {
    id: 'ProductStrategist',
    name: 'Product Strategist',
    description: 'MVP 방향성, 백로그 우선순위, 로드맵 제안',
    systemPrompt: ProductStrategistPrompt,
  },
  {
    id: 'TechArchitect',
    name: 'Tech Architect',
    description: '모듈러 아키텍처, 보안/거버넌스, 실행 가이드 제시',
    systemPrompt: TechArchitectPrompt,
  },
];

// Simple types for chat messages
type Message = { role: 'system' | 'user' | 'assistant'; content: string; };

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY environment variable is not set. Please set it in your environment or .env file.');
    process.exit(1);
  }

  // Initialize OpenAI client
  const configuration = new Configuration({ apiKey });
  const openai = new OpenAIApi(configuration);

  // CLI interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string) =>
    new Promise<string>((resolve) => rl.question(query, resolve));

  console.log('=== AgentRunner ===');
  console.log('Select an agent to chat with:');
  AGENTS.forEach((a, idx) => {
    console.log(` ${idx + 1}. ${a.name} - ${a.description}`);
  });
  const agentChoiceStr = await question('Enter the number of the agent: ');
  const agentIndex = parseInt(agentChoiceStr.trim(), 10);

  if (Number.isNaN(agentIndex) || agentIndex < 1 || agentIndex > AGENTS.length) {
    console.error('Invalid selection. Exiting.');
    rl.close();
    return;
  }

  // Set initial agent
  let currentAgent = AGENTS[agentIndex - 1];
  // Message history includes the system prompt for the agent
  let messages: Message[] = [{ role: 'system', content: currentAgent.systemPrompt }];

  console.log(`\nNow chatting with ${currentAgent.name}.`);
  console.log('Type your messages to the agent. Commands: /switch to change agent, /exit to quit.\n');

  while (true) {
    const userInput = await question('You: ');
    const trimmed = userInput.trim();

    if (trimmed === '/exit') {
      console.log('Exiting AgentRunner.');
      break;
    }

    if (trimmed === '/switch') {
      console.log('Switching agent. Available agents:');
      AGENTS.forEach((a, idx) => {
        console.log(` ${idx + 1}. ${a.name} - ${a.description}`);
      });
      const switchChoiceStr = await question('Enter the number of the agent to switch to: ');
      const switchIndex = parseInt(switchChoiceStr.trim(), 10);
      if (Number.isNaN(switchIndex) || switchIndex < 1 || switchIndex > AGENTS.length) {
        console.log('Invalid selection. Staying with current agent.');
      } else {
        currentAgent = AGENTS[switchIndex - 1];
        messages = [{ role: 'system', content: currentAgent.systemPrompt }];
        console.log(`Switched to ${currentAgent.name}.\n`);
      }
      continue;
    }

    if (trimmed.length === 0) {
      // ignore empty input
      continue;
    }

    // Append user message
    messages.push({ role: 'user', content: trimmed });

    try {
      // Call OpenAI Chat API
      const res = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: messages as any,
        temperature: 0.25,
      });

      const assistantContent =
        res.data.choices?.[0]?.message?.content?.trim() ?? '';

      // Push assistant reply to history
      messages.push({ role: 'assistant', content: assistantContent });

      // Output
      console.log(`\n${currentAgent.name}: ${assistantContent}\n`);
    } catch (err) {
      console.error('Error communicating with OpenAI API:', err);
      // Optional: break or continue. We'll continue to allow retry.
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('Unexpected error in AgentRunner:', err);
});
```