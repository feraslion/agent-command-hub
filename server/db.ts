import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agents,
  approvals,
  costEntries,
  executionCommands,
  executionEvents,
  projects,
  taskStatusValues,
  tasks,
  type InsertUser,
  type User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function requireOwnedProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, userId))).limit(1);
  if (!project) throw new Error("Project not found or access denied");
  return { db, project };
}

export async function listProjectsForOwner(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.ownerId, userId)).orderBy(desc(projects.updatedAt));
}

export async function getProjectForOwner(userId: number, projectId: number) {
  const { project } = await requireOwnedProject(userId, projectId);
  return project;
}

export async function createProjectForOwner(userId: number, input: { name: string; code: string; description?: string; budgetLimit?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(projects).values({
    ownerId: userId,
    name: input.name,
    code: input.code.toUpperCase(),
    description: input.description ?? null,
    budgetLimit: String(input.budgetLimit ?? 2.5),
  });
  const projectId = Number(result.insertId);
  await recordExecutionEvent(userId, projectId, {
    actor: "مالك المشروع",
    type: "PROJECT_CREATED",
    label: "تم إنشاء المشروع",
    detail: `تم إنشاء مشروع ${input.name} بميزانية ${input.budgetLimit ?? 2.5}.`,
  });
  return getProjectForOwner(userId, projectId);
}

export async function listProjectTasks(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.updatedAt));
}

export async function createTaskForProject(userId: number, input: { projectId: number; title: string; description?: string; stage?: string; priority?: "low" | "medium" | "high" | "critical"; assignedAgentId?: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [result] = await db.insert(tasks).values({
    projectId: input.projectId,
    assignedAgentId: input.assignedAgentId ?? null,
    title: input.title,
    description: input.description ?? null,
    stage: input.stage ?? "requirements",
    priority: input.priority ?? "medium",
  });
  const taskId = Number(result.insertId);
  await recordExecutionEvent(userId, input.projectId, {
    taskId,
    actor: "مالك المشروع",
    type: "TASK_CREATED",
    label: "تم إنشاء المهمة",
    detail: input.title,
  });
  return (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
}

export async function updateTaskStatus(userId: number, input: { projectId: number; taskId: number; status: (typeof taskStatusValues)[number] }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId))).limit(1);
  if (!task) throw new Error("Task not found");
  const now = new Date();
  await db.update(tasks).set({
    status: input.status,
    startedAt: input.status === "running" ? (task.startedAt ?? now) : task.startedAt,
    completedAt: input.status === "completed" ? now : task.completedAt,
  }).where(eq(tasks.id, input.taskId));
  await recordExecutionEvent(userId, input.projectId, {
    taskId: input.taskId,
    actor: "مالك المشروع",
    type: "TASK_STATUS_CHANGED",
    label: "تغيرت حالة المهمة",
    detail: `${task.title} → ${input.status}`,
  });
  return (await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1))[0];
}

export async function listProjectAgents(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(agents).where(eq(agents.projectId, projectId)).orderBy(agents.name);
}

export async function createProjectAgent(userId: number, input: { projectId: number; key: string; name: string; role: string; capabilities?: string; permissions?: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [result] = await db.insert(agents).values({
    projectId: input.projectId,
    key: input.key,
    name: input.name,
    role: input.role,
    capabilities: input.capabilities ?? null,
    permissions: input.permissions ?? null,
  });
  return (await db.select().from(agents).where(eq(agents.id, Number(result.insertId))).limit(1))[0];
}

export async function listProjectEvents(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(executionEvents).where(eq(executionEvents.projectId, projectId)).orderBy(desc(executionEvents.createdAt)).limit(limit);
}

export async function listProjectCommands(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(executionCommands).where(eq(executionCommands.projectId, projectId)).orderBy(desc(executionCommands.createdAt)).limit(limit);
}

export async function enqueueExecutionCommand(userId: number, input: { projectId: number; taskId?: number; command: "run_project" | "run_task" | "resume_task"; payload?: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  if ((input.command === "run_task" || input.command === "resume_task") && !input.taskId) throw new Error("Task command requires a taskId");
  if (input.taskId) {
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId))).limit(1);
    if (!task) throw new Error("Task not found");
  }
  const [result] = await db.insert(executionCommands).values({
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    requestedByUserId: userId,
    command: input.command,
    payload: input.payload ?? null,
  });
  const commandId = Number(result.insertId);
  await db.update(projects).set({ status: "active", currentStage: "queued" }).where(eq(projects.id, input.projectId));
  await recordExecutionEvent(userId, input.projectId, {
    taskId: input.taskId,
    actor: "مالك المشروع",
    type: "EXECUTION_COMMAND_QUEUED",
    label: "تم إرسال أمر تشغيل",
    detail: `الأمر ${input.command} في انتظار العامل الدائم (معرّف ${commandId}).`,
  });
  return (await db.select().from(executionCommands).where(eq(executionCommands.id, commandId)).limit(1))[0];
}

export async function recordExecutionEvent(userId: number, projectId: number, input: { taskId?: number; actor: string; type: string; label: string; detail: string }) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [result] = await db.insert(executionEvents).values({
    projectId,
    taskId: input.taskId ?? null,
    actor: input.actor,
    type: input.type,
    label: input.label,
    detail: input.detail,
  });
  return Number(result.insertId);
}

export async function listProjectApprovals(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(approvals).where(eq(approvals.projectId, projectId)).orderBy(desc(approvals.createdAt));
}

export async function createApprovalRequest(userId: number, input: { projectId: number; taskId?: number; requestedBy: string; title: string; detail: string; impact: string; level: "auto" | "review" | "approval" }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const status = input.level === "auto" ? "auto_resolved" : "pending";
  const [result] = await db.insert(approvals).values({
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    requestedBy: input.requestedBy,
    title: input.title,
    detail: input.detail,
    impact: input.impact,
    level: input.level,
    status,
    resolvedByUserId: input.level === "auto" ? userId : null,
    resolvedAt: input.level === "auto" ? new Date() : null,
  });
  const approvalId = Number(result.insertId);
  await recordExecutionEvent(userId, input.projectId, {
    taskId: input.taskId,
    actor: input.requestedBy,
    type: "APPROVAL_REQUESTED",
    label: input.level === "auto" ? "تم تنفيذ إجراء تلقائي" : "طلب موافقة",
    detail: input.title,
  });
  return (await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1))[0];
}

export async function resolveApproval(userId: number, input: { projectId: number; approvalId: number; decision: "approved" | "rejected"; note?: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [approval] = await db.select().from(approvals).where(and(eq(approvals.id, input.approvalId), eq(approvals.projectId, input.projectId))).limit(1);
  if (!approval) throw new Error("Approval not found");
  if (approval.status !== "pending") throw new Error("Approval is already resolved");
  await db.update(approvals).set({ status: input.decision, resolvedByUserId: userId, resolutionNote: input.note ?? null, resolvedAt: new Date() }).where(eq(approvals.id, input.approvalId));
  await recordExecutionEvent(userId, input.projectId, {
    taskId: approval.taskId ?? undefined,
    actor: "مالك المشروع",
    type: input.decision === "approved" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
    label: input.decision === "approved" ? "تم اعتماد الطلب" : "تم رفض الطلب",
    detail: approval.title,
  });
  return (await db.select().from(approvals).where(eq(approvals.id, input.approvalId)).limit(1))[0];
}

export async function getProjectCostSummary(userId: number, projectId: number) {
  const { db, project } = await requireOwnedProject(userId, projectId);
  const [summary] = await db.select({ spent: sql<string>`coalesce(sum(${costEntries.amount}), 0)` }).from(costEntries).where(eq(costEntries.projectId, projectId));
  const spent = Number(summary?.spent ?? 0);
  const limit = Number(project.budgetLimit);
  return { limit, warningThreshold: project.budgetWarningThreshold, spent, remaining: Math.max(0, limit - spent), percent: limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0 };
}

export async function recordProjectCost(userId: number, input: { projectId: number; taskId?: number; agentId?: number; model: string; inputTokens?: number; outputTokens?: number; durationMs?: number; amount: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [result] = await db.insert(costEntries).values({
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    agentId: input.agentId ?? null,
    model: input.model,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    durationMs: input.durationMs ?? 0,
    amount: String(input.amount),
  });
  const costId = Number(result.insertId);
  await recordExecutionEvent(userId, input.projectId, {
    taskId: input.taskId,
    actor: "Cost Tracker",
    type: "COST_RECORDED",
    label: "تم تسجيل استهلاك النموذج",
    detail: `${input.model}: $${input.amount.toFixed(4)}`,
  });
  return (await db.select().from(costEntries).where(eq(costEntries.id, costId)).limit(1))[0];
}

export type AuthenticatedUser = Pick<User, "id" | "name">;
