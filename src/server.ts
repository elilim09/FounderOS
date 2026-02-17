import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { OPENAI_MODEL } from "./openaiClient.js";
import { buildFromDesign, designMultiAgentSystem } from "./orchestrator.js";
import { getBuild, getDesign, saveBuild, saveDesign } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../public")));

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
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const design = await designMultiAgentSystem(parsed.data);
    saveDesign(design);
    return res.json(design);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to generate design";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

app.post("/api/build/:designId", async (req, res) => {
  const design = getDesign(req.params.designId);
  if (!design) {
    return res.status(404).json({ error: "design not found" });
  }

  try {
    const build = await buildFromDesign(design);
    saveBuild(build);
    return res.json(build);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to build";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

app.get("/api/design/:designId", (req, res) => {
  const design = getDesign(req.params.designId);
  if (!design) {
    return res.status(404).json({ error: "design not found" });
  }
  return res.json(design);
});

app.get("/api/build/:designId", (req, res) => {
  const build = getBuild(req.params.designId);
  if (!build) {
    return res.status(404).json({ error: "build not found" });
  }
  return res.json(build);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`FounderOS server running at http://localhost:${port}`);
});
