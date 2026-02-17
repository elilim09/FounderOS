import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function generateWithOpenAI(system: string, user: string): Promise<string> {
  if (!client) {
    return [
      "[MOCK MODE] OPENAI_API_KEY가 없어 샘플 응답을 반환합니다.",
      "핵심 목표: 린 MVP를 빠르게 출시하고 사용자 피드백 루프를 강화하세요.",
      "권장: 역할 기반 멀티 에이전트 + 이벤트 로그 + 휴먼 승인 게이트를 채택하세요."
    ].join("\n");
  }

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  return completion.choices[0]?.message?.content ?? "응답을 생성하지 못했습니다.";
}
