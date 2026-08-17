import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

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
  approvals: router({
    list: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listProjectApprovals(ctx.user.id, input.projectId)),
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
  events: router({
    list: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(200).optional() })).query(({ ctx, input }) => db.listProjectEvents(ctx.user.id, input.projectId, input.limit ?? 50)),
  }),
});

export type AppRouter = typeof appRouter;
