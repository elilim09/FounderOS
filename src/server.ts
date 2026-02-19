import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { OPENAI_MODEL, generateText } from "./openaiClient.js";
import { buildFromDesign, createWorkshopFromBuild, designMultiAgentSystem, resolveWorkshopApproval, runWorkshopCycle } from "./orchestrator.js";
import { getBuild, getDesign, getWorkshop, saveBuild, saveDesign, saveWorkshop } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../public")));


const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"])
});

const designInputSchema = z.object({
  startupName: z.string().min(1),
  problem: z.string().min(5),
  targetCustomer: z.string().min(2),
  constraints: z.string().min(2),
  additionalContext: z.string().optional(),
  requestedAgentCount: z.number().int().min(2).max(6)
});

app.get("/api/health", (_req, res) => {
  return res.json({
    ok: true,
    model: OPENAI_MODEL,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/design", async (req, res) => {
  const parsed = designInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const summary = Object.entries(fieldErrors)
      .flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`))
      .join(" | ");
    return res.status(400).json({
      error: summary || "입력 내용을 다시 한번 확인해 주세요. 빈 칸이 있거나 너무 짧은 항목이 있을 수 있습니다.",
      fieldErrors
    });
  }

  // Enable streaming
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const design = await designMultiAgentSystem(parsed.data, (progress) => {
      res.write(JSON.stringify(progress) + "\n");
    });
    saveDesign(design);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to generate design";
    res.write(JSON.stringify({ type: "error", message }) + "\n");
    res.end();
  }
});

app.post("/api/build/:designId", async (req, res) => {
  const design = getDesign(req.params.designId);
  if (!design) {
    return res.status(404).json({ error: "해당 설계를 찾을 수 없습니다. 먼저 설계를 실행해주세요." });
  }

  try {
    const build = await buildFromDesign(design);
    saveBuild(build);
    const workshop = createWorkshopFromBuild(design);
    saveWorkshop(workshop);
    return res.json(build);
  } catch (error) {
    const message = error instanceof Error ? error.message : "구축 중 문제가 발생했습니다. 다시 시도해주세요.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

app.get("/api/design/:designId", (req, res) => {
  const design = getDesign(req.params.designId);
  if (!design) {
    return res.status(404).json({ error: "해당 설계를 찾을 수 없습니다." });
  }
  return res.json(design);
});

app.get("/api/build/:designId", (req, res) => {
  const build = getBuild(req.params.designId);
  if (!build) {
    return res.status(404).json({ error: "해당 구축 결과를 찾을 수 없습니다." });
  }
  return res.json(build);
});



app.get("/api/workshop/:designId", (req, res) => {
  const workshop = getWorkshop(req.params.designId);
  if (!workshop) {
    return res.status(404).json({ error: "가상 작업실 데이터를 찾을 수 없습니다." });
  }
  return res.json(workshop);
});

app.post("/api/workshop/:designId/cycle", (req, res) => {
  const workshop = getWorkshop(req.params.designId);
  if (!workshop) {
    return res.status(404).json({ error: "가상 작업실 데이터를 찾을 수 없습니다." });
  }

  const updated = runWorkshopCycle(workshop);
  saveWorkshop(updated);
  return res.json(updated);
});

app.post("/api/workshop/:designId/approval/:approvalId", (req, res) => {
  const workshop = getWorkshop(req.params.designId);
  if (!workshop) {
    return res.status(404).json({ error: "가상 작업실 데이터를 찾을 수 없습니다." });
  }

  const parsed = approvalDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "승인 결정값이 올바르지 않습니다." });
  }

  const updated = resolveWorkshopApproval(workshop, req.params.approvalId, parsed.data.decision);
  saveWorkshop(updated);
  return res.json(updated);
});

app.post("/api/chat/:designId", async (req, res) => {
  const { designId } = req.params;
  const { role, message } = req.body;

  const build = getBuild(designId);
  if (!build) return res.status(404).json({ error: "구축 결과를 먼저 생성해주세요." });

  const systemPrompt = build.agentPrompts?.[role];
  if (!systemPrompt) return res.status(400).json({ error: "해당 전문가를 찾을 수 없습니다." });

  try {
    const response = await generateText(systemPrompt, message);
    return res.json({ response });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`FounderOS server running at http://localhost:${port}`);
});
