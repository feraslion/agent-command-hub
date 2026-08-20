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

const repositoryScanSchema = z.object({
  projectId: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(255).regex(/^[^\\/]+$/u),
  fileCount: z.number().int().min(0).max(100_000),
  directoryCount: z.number().int().min(0).max(20_000),
  languages: z.record(z.string().min(1).max(32), z.number().int().min(0).max(100_000)).refine((value) => Object.keys(value).length <= 40),
  manifests: z.array(z.string().min(1).max(128)).max(30),
  testSignals: z.array(z.string().min(1).max(128)).max(50),
  sensitiveSignals: z.array(z.string().min(1).max(128)).max(50),
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

  app.post("/api/local-runner/repository-scan", async (req, res) => {
    const credentials = getRunnerCredentials(req);
    const body = repositoryScanSchema.safeParse(req.body);
    if (!credentials || !body.success) return sendAuthError(res);
    try {
      const scan = await db.reportRepositoryScanFromRunner({
        ...credentials,
        projectId: body.data.projectId,
        summary: {
          displayName: body.data.displayName,
          fileCount: body.data.fileCount,
          directoryCount: body.data.directoryCount,
          languages: body.data.languages,
          manifests: body.data.manifests,
          testSignals: body.data.testSignals,
          sensitiveSignals: body.data.sensitiveSignals,
        },
      });
      return res.json({ scan: { id: scan.id, projectId: scan.projectId, createdAt: scan.createdAt } });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to record repository scan." });
    }
  });
}
