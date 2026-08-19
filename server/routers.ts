import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { getDryWorkerLoopStatus } from "./dry-worker";

const projectIdInput = z.object({ projectId: z.number().int().positive() });
const taskStatus = z.enum(["pending", "queued", "running", "verifying", "completed", "failed", "debugging", "retrying", "cancelled"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => db.listProjectsForOwner(ctx.user.id)),
    get: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.getProjectForOwner(ctx.user.id, input.projectId)),
    create: protectedProcedure.input(z.object({
      name: z.string().trim().min(2).max(255),
      code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/),
      description: z.string().trim().max(4000).optional(),
      budgetLimit: z.number().min(0.5).max(10000).optional(),
    })).mutation(({ ctx, input }) => db.createProjectForOwner(ctx.user.id, input)),
  }),
  workspace: router({
    get: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.getWorkspaceForProject(ctx.user.id, input.projectId)),
    ensure: protectedProcedure.input(projectIdInput).mutation(({ ctx, input }) => db.ensureWorkspaceForProject(ctx.user.id, input.projectId)),
    audit: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listWorkspaceAuditForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    files: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listWorkspaceFilesForProject(ctx.user.id, input.projectId, input.limit ?? 100)),
    readFile: protectedProcedure.input(projectIdInput.extend({ path: z.string().trim().min(1).max(512) })).query(({ ctx, input }) => db.readWorkspaceFileForProject(ctx.user.id, input)),
    writeFile: protectedProcedure.input(projectIdInput.extend({ path: z.string().trim().min(1).max(512), content: z.string().max(64_000) })).mutation(({ ctx, input }) => db.writeWorkspaceFileForProject(ctx.user.id, input)),
  }),
  sensitiveChanges: router({
    list: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listSensitiveWorkspaceChangesForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    listApplied: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listAppliedSensitiveWorkspaceChangesForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    submit: protectedProcedure.input(projectIdInput.extend({ path: z.string().trim().min(1).max(512), content: z.string().min(1).max(64_000) })).mutation(({ ctx, input }) => db.submitSensitiveWorkspaceChange(ctx.user.id, input)),
  }),
  tasks: router({
    list: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listProjectTasks(ctx.user.id, input.projectId)),
    create: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      title: z.string().trim().min(2).max(255),
      description: z.string().trim().max(4000).optional(),
      stage: z.string().trim().min(2).max(128).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      assignedAgentId: z.number().int().positive().optional(),
    })).mutation(({ ctx, input }) => db.createTaskForProject(ctx.user.id, input)),
    setStatus: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), taskId: z.number().int().positive(), status: taskStatus })).mutation(({ ctx, input }) => db.updateTaskStatus(ctx.user.id, input)),
  }),
  agents: router({
    list: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listProjectAgents(ctx.user.id, input.projectId)),
    create: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      key: z.string().trim().min(2).max(64).regex(/^[a-z0-9_-]+$/),
      name: z.string().trim().min(2).max(128),
      role: z.string().trim().min(2).max(128),
      capabilities: z.string().trim().max(8000).optional(),
      permissions: z.string().trim().max(8000).optional(),
    })).mutation(({ ctx, input }) => db.createProjectAgent(ctx.user.id, input)),
  }),
  worker: router({
    getStatus: protectedProcedure.query(async ({ ctx }) => ({ worker: await db.getWorkerSettingsForOwner(ctx.user.id), loop: getDryWorkerLoopStatus() })),
    setDesiredState: protectedProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ ctx, input }) => db.setWorkerDesiredState(ctx.user.id, input.enabled)),
  }),
  approvals: router({
    list: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listProjectApprovals(ctx.user.id, input.projectId)),
    inbox: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional()).query(({ ctx, input }) => db.listOwnerApprovalsWithEngineContext(ctx.user.id, input?.limit ?? 100)),
    create: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      taskId: z.number().int().positive().optional(),
      requestedBy: z.string().trim().min(2).max(128),
      title: z.string().trim().min(2).max(255),
      detail: z.string().trim().min(2).max(8000),
      impact: z.string().trim().min(2).max(255),
      level: z.enum(["auto", "review", "approval"]),
    })).mutation(({ ctx, input }) => db.createApprovalRequest(ctx.user.id, input)),
    resolve: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      approvalId: z.number().int().positive(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().trim().max(4000).optional(),
    })).mutation(({ ctx, input }) => db.resolveApproval(ctx.user.id, input)),
  }),
  costs: router({
    summary: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.getProjectCostSummary(ctx.user.id, input.projectId)),
    record: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      taskId: z.number().int().positive().optional(),
      agentId: z.number().int().positive().optional(),
      model: z.string().trim().min(2).max(128),
      inputTokens: z.number().int().min(0).optional(),
      outputTokens: z.number().int().min(0).optional(),
      durationMs: z.number().int().min(0).optional(),
      amount: z.number().positive().max(100000),
    })).mutation(({ ctx, input }) => db.recordProjectCost(ctx.user.id, input)),
  }),
  commands: router({
    list: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listProjectCommands(ctx.user.id, input.projectId, input.limit ?? 50)),
    enqueue: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      taskId: z.number().int().positive().optional(),
      command: z.enum(["run_project", "run_task", "resume_task"]),
      payload: z.string().trim().max(12000).optional(),
    })).mutation(({ ctx, input }) => db.enqueueExecutionCommand(ctx.user.id, input)),
  }),
  runtime: router({
    listPlans: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listProjectExecutionPlans(ctx.user.id, input.projectId, input.limit ?? 50)),
  }),
  engine: router({
    listRuns: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listTaskEngineRunsForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    getRun: protectedProcedure.input(projectIdInput.extend({ runId: z.number().int().positive() })).query(({ ctx, input }) => db.getTaskEngineRunForProject(ctx.user.id, input)),
    advance: protectedProcedure.input(projectIdInput.extend({ runId: z.number().int().positive() })).mutation(({ ctx, input }) => db.advanceTaskEngineRunForProject(ctx.user.id, input)),
  }),
  sandbox: router({
    list: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listSandboxChecksForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    check: protectedProcedure.input(projectIdInput.extend({ kind: z.enum(["workspace_policy", "logical_test"]), engineRunId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => db.runLogicalSandboxCheckForProject(ctx.user.id, input)),
    requestGate: protectedProcedure.input(projectIdInput.extend({ kind: z.enum(["git_gate", "publish_gate", "delete_gate"]) })).mutation(({ ctx, input }) => db.requestSandboxGateForProject(ctx.user.id, input)),
  }),
  isolatedRuntime: router({
    status: protectedProcedure.query(() => db.isolatedRuntimeEnvironment),
    listRequests: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listIsolatedRuntimeRequestsForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    requestExecution: protectedProcedure.input(projectIdInput.extend({ targetPath: z.string().trim().min(1).max(512), engineRunId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => db.requestIsolatedRuntimeExecution(ctx.user.id, input)),
  }),
  events: router({
    list: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(200).optional() })).query(({ ctx, input }) => db.listProjectEvents(ctx.user.id, input.projectId, input.limit ?? 50)),
  }),
});

export type AppRouter = typeof appRouter;
