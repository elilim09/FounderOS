import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required. Set it in your environment before using this service.");
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export async function generateText(system: string, user: string): Promise<string> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned an empty text response.");
  }

  return text;
}

export async function generateJson<T>(system: string, user: string): Promise<T> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${system}\nAlways return valid JSON object only.` },
      { role: "user", content: user }
    ]
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty JSON response.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`OpenAI returned non-JSON content: ${raw.slice(0, 240)}`);
  }
}
