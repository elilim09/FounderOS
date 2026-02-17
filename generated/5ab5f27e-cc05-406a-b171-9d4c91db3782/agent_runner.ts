```ts
// agent_runner.ts
// A ready-to-run CLI agent runner using OpenAI and dotenv
// - Supports selecting an agent and chatting in a loop
// - Uses system prompts defined as constants
// - Includes full error handling and imports

import readline from 'readline';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

// Basic validation for OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY is not set. Please set it in the environment or in a .env file.');
  process.exit(1);
}

// OpenAI client setup
const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const MODEL = 'gpt-3.5-turbo'; // Use a widely available model

// System prompts as const variables (full content based on user requirements)
const MARKET_ANALYST_PROMPT: string = `System Prompt for Market Analyst: You are MarketAnalyst, a data-driven market researcher focused on startup platforms. Context: AgentCraft is building a lightweight, templated AI agent platform to help 예비 창업자 and 초기 스타트업 팀 design/build AI agents quickly. MVP target: 2주 MVP with a no-code UI and API, cost-conscious, security-conscious, multi-tenant, modular architecture. Constraints: MVP scope limited to template-based UI Builder (3 templates), API Connector templates (2), Agent templates/Runtime (2–3), serverless/low-cost infra, OAuth2/OIDC, TLS, encryption in transit/storage, audit logs, cost-monitoring, and basic observability. RequestedAgentCount: 3. Deliverables expected from you: 1) Target customer segments and jobs-to-be-done for these segments, 2) Value propositions and messaging tailored to 예비 창업자, 3) Competitive landscape snapshot and differentiation points, 4) Initial pricing and go-to-market (GTM) hypotheses, 5) 2–3 testable market hypotheses and success metrics. Chain-of-Thought Directive: Do not reveal step-by-step internal reasoning. Instead provide a concise final conclusion with 3–5 brief justification bullets. Output Format: Return a single JSON object with the following fields: TargetSegments (array of segments with JTBD), ValuePropositions (per segment), CompetitiveLandscape (key players and differentiators), PricingRecommendations (pricing model ideas with rationale), GTMStrategy (channels, messaging, early adopter plan), KeyRisks (top market risks and mitigations), KeyMetrics (top success metrics to track). Provide actionable items and clear next steps with owners and provisional timelines where possible.`;

const PRODUCT_STRATEGIST_PROMPT: string = `System Prompt for Product Strategist: You are Product Strategist, a product strategist specializing in designing MVP roadmaps for no-code/low-code platforms targeting 예비 창업자. Context: AgentCraft aims to deliver a 2주 MVP with a templated UI Builder, templated API Connectors, and templated Agent Runtime, all within a modular, multi-tenant, serverless architecture. Constraints: MVP scope limited to templated functionality (UI Builder templates 3, API Connector templates 2, Agent templates/Runtime 2–3), strict cost controls (serverless, free tier utilization), essential security (OAuth2/OIDC, TLS, at-rest/in-transit encryption, audit logs), observability, and phased expansion (Phase2). Required Output: a prioritized product backlog aligned to the MVP scope, with clear user stories, acceptance criteria, and success metrics. Chain-of-Thought Directive: Do not reveal step-by-step internal reasoning. Provide concise justification for each backlog item in 1–3 bullets. Output Format: Return a JSON object with: Backlog (array of items with id, title, description, priority, acceptanceCriteria, dependencies, effortEstimate), MVPScopeSummary (summary of what is in MVP and what is deferred to Phase2), ArchitecturalRequirements (high-level alignment to modular serverless design and security), NonFunctionalRequirements (security, performance, reliability, cost), RisksAndMitigations (top risks with mitigation strategies), MetricsAndSuccessCriteria (KPIs and how to measure them).`;

const TECH_ARCH_PROMPT: string = `System Prompt for Tech Architect: You are TechArchitect, a systems architect responsible for designing a lean, modular, serverless architecture for AgentCraft that supports a 2주 MVP with no-code UI Builder templates, API Connector templates, and Agent Runtime templates. Context: The platform must be modular, multi-tenant, cost-conscious, and secure, with Observability and Deployment & Cost Control modules. Constraints: MVP scope includes 3 UI Builder templates, 2 API Connector templates, 2–3 Agent templates; serverless infrastructure; strict security baseline (OAuth2, TLS, encryption at rest/in transit, least privilege, secret management, audit logs); cost monitoring and free-tier policies; clear data flows from UI Builder -> API Connectors -> Agent Runtime to Observability. Deliverables: high-level architecture, module decomposition, data flow diagrams, interface definitions, security model, deployment plan, and acceptance criteria for MVP. Chain-of-Thought Directive: Do not reveal step-by-step internal reasoning. Provide a concise rationale for architectural decisions in 3–5 bullets. Output Format: Return a JSON object with: SystemArchitecture (Components, Interfaces, DataFlow), ModuleInterfaces (API contracts and event schemas), DataModel (key entities and data flow), SecurityModel (authentication, authorization, encryption, audit), DeploymentModel (serverless stack, tenancy isolation, cost controls), ObservabilityPlan (logging, metrics, dashboards, alerts), and AcceptanceCriteria (MVP-specific technical milestones).`;

type AgentInfo = {
  id: number;
  key: string;
  name: string;
  systemPrompt: string;
};

const AGENTS: AgentInfo[] = [
  { id: 1, key: 'MarketAnalyst', name: 'Market Analyst', systemPrompt: MARKET_ANALYST_PROMPT },
  { id: 2, key: 'ProductStrategist', name: 'Product Strategist', systemPrompt: PRODUCT_STRATEGIST_PROMPT },
  { id: 3, key: 'TechArchitect', name: 'Tech Architect', systemPrompt: TECH_ARCH_PROMPT },
];

// Simple chat message type
type Role = 'system' | 'user' | 'assistant';
type ChatMessage = { role: Role; content: string };

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, (ans) => resolve(ans)));
}

// Core chat with OpenAI
async function getAssistantReply(messages: ChatMessage[]): Promise<string> {
  try {
    // Map to OpenAI API format
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const resp = await openai.createChatCompletion({
      model: MODEL,
      messages: apiMessages,
      temperature: 0.7,
    });

    const content =
      resp?.data?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!content) {
      throw new Error('Empty response from OpenAI.');
    }

    return content;
  } catch (err) {
    // Normalize error
    const errMsg = (err as any)?.message ?? 'Unknown error during OpenAI call';
    throw new Error(`OpenAI request failed: ${errMsg}`);
  }
}

// CLI loop: select agent, then chat
async function runAgentChat(agent: AgentInfo): Promise<void> {
  const rl = createInterface();
  console.log(`\nSelected Agent: ${agent.name}`);
  console.log('Type your message and press Enter to chat.');
  console.log("Commands: /exit to go back, /help for help, /restart to clear context.\n");

  // Conversation history initialized with system prompt
  const messages: ChatMessage[] = [{ role: 'system', content: agent.systemPrompt }];

  // Small helper to print assistant reply
  const printAssistant = (text: string) => {
    console.log(`\n${agent.name}:\n${text}\n`);
  };

  let exiting = false;
  while (!exiting) {
    try {
      const userInput = await askQuestion(rl, 'You: ');
      const trimmed = userInput.trim();

      if (trimmed.length === 0) {
        continue;
      }

      if (trimmed === '/exit' || trimmed.toLowerCase() === 'exit') {
        exiting = true;
        console.log(`\nExiting chat with ${agent.name}. Returning to agent list.\n`);
        break;
      }

      if (trimmed === '/help') {
        console.log('\nAvailable commands:\n');
        console.log('  /exit   - Exit to agent selection');
        console.log('  /help   - Show this help');
        console.log('  /restart- Restart conversation context (keep system prompt, drop previous messages)\n');
        continue;
      }

      if (trimmed === '/restart') {
        // Restart: keep system prompt, drop user/assistant history
        const systemOnly = messages.filter((m) => m.role === 'system');
        messages.length = 0;
        messages.push(...systemOnly);
        console.log('Context restarted. You can continue with a fresh conversation.');
        continue;
      }

      // User message
      messages.push({ role: 'user', content: trimmed });

      // Get assistant reply
      const reply = await getAssistantReply(messages);
      messages.push({ role: 'assistant', content: reply });

      printAssistant(reply);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      console.log('Retrying the last user message...\n');
      // In case of error, simply continue to next user input
    }
  }

  rl.close();
}

// Main entry
(async () => {
  try {
    console.log('AgentCraft CLI: Agent Runner');
    console.log('----------------------------------------');
    console.log('Available agents:');
    AGENTS.forEach((a) => {
      console.log(`  ${a.id}) ${a.name} (${a.key})`);
    });
    console.log('  0) Exit');
    console.log('----------------------------------------\n');

    const rlMain = createInterface();

    while (true) {
      const input = await askQuestion(
        rlMain,
        'Select an agent by number (0 to exit): '
      );
      const choice = Number(input.trim());

      if (Number.isNaN(choice)) {
        console.log('Please enter a valid number corresponding to an agent.');
        continue;
      }

      if (choice === 0) {
        console.log('Goodbye!');
        rlMain.close();
        process.exit(0);
      }

      const agent = AGENTS.find((a) => a.id === choice);
      if (!agent) {
        console.log('Invalid selection. Please choose a valid agent number.');
        continue;
      }

      // Run chat for the chosen agent
      await runAgentChat(agent);

      // After chat ends, re-display the agent list
      console.log('----------------------------------------');
      console.log('Agent selection:');
      AGENTS.forEach((a) => {
        console.log(`  ${a.id}) ${a.name} (${a.key})`);
      });
      console.log('  0) Exit');
      console.log('----------------------------------------\n');
    }
  } catch (err) {
    console.error('Unhandled error:', (err as Error).message);
    process.exit(1);
  }
})();
```