import type { Express, Request, Response } from "express";
import { z } from "zod";
import * as db from "./db";

const runnerHeaderSchema = z.object({
  runnerKey: z.string().regex(/^runner-[a-f0-9]{12}$/),
  token: z.string().min(32).max(256),
});

const heartbeatSchema = z.object({
  capabilities: z.record(z.string(), z.unknown()).optional(),
});

const reportSchema = z.object({
  requestId: z.number().int().positive(),
  status: z.enum(["completed", "failed"]),
  exitCode: z.number().int().min(0).max(255),
  stdout: z.string().max(16_000).optional(),
  stderr: z.string().max(16_000).optional(),
  durationMs: z.number().int().min(0).max(60_000),
});

function getRunnerCredentials(req: Request) {
  const authorization = req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const parsed = runnerHeaderSchema.safeParse({ runnerKey: req.header("x-agenthub-runner") ?? "", token });
  if (!parsed.success) return null;
  return parsed.data;
}

function sendAuthError(res: Response) {
  return res.status(401).json({ error: "Local runner authentication failed." });
}

export function registerLocalRunnerRoutes(app: Express) {
  app.post("/api/local-runner/heartbeat", async (req, res) => {
    const credentials = getRunnerCredentials(req);
    const body = heartbeatSchema.safeParse(req.body);
    if (!credentials || !body.success) return sendAuthError(res);
    try {
      const runner = await db.heartbeatLocalRunner({ ...credentials, capabilities: body.data.capabilities });
      return res.json({ runner: { runnerKey: runner.runnerKey, status: runner.status, lastHeartbeatAt: runner.lastHeartbeatAt } });
    } catch {
      return sendAuthError(res);
    }
  });

  app.post("/api/local-runner/claim", async (req, res) => {
    const credentials = getRunnerCredentials(req);
    if (!credentials) return sendAuthError(res);
    try {
      const request = await db.claimLocalRuntimeRequest(credentials);
      return res.json({ request });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to claim runtime request." });
    }
  });

  app.post("/api/local-runner/report", async (req, res) => {
    const credentials = getRunnerCredentials(req);
    const body = reportSchema.safeParse(req.body);
    if (!credentials || !body.success) return sendAuthError(res);
    try {
      const request = await db.reportLocalRuntimeRequest({ ...credentials, ...body.data });
      return res.json({ request: { id: request.id, status: request.status, completedAt: request.completedAt } });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to record runtime result." });
    }
  });
}
