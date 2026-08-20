import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agentPromptAssignments,
  agents,
  approvals,
  costEntries,
  executionCommands,
  executionEvents,
  executionPlans,
  isolatedRuntimeRequests,
  projects,
  sandboxChecks,
  sensitiveWorkspaceChanges,
  type promptTemplateKeyValues,
  type promptTemplateLocaleValues,
  taskStatusValues,
  taskEngineRuns,
  taskEngineSteps,
  tasks,
  type InsertUser,
  type User,
  users,
  workerSettings,
  workspaceAuditLogs,
  workspaceFiles,
  workspaces,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sandboxGateDetail, sandboxGateKinds, sandboxGateTitle } from "./sandbox-policy";
import { assessSensitiveWorkspaceChange } from "../lib/sensitive-workspace-policy";
import { assertWorkspaceContent, normalizeWorkspacePath, WorkspacePathError } from "./workspace-policy";

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

export const restrictedWorkspaceDirectories = ["source", "docs", "tests", "artifacts", "memory", "logs"] as const;

export async function recordWorkspaceAudit(workspaceId: number, input: { actor: string; action: "workspace_created" | "file_read" | "file_written" | "path_rejected" | "tool_rejected" | "sandbox_checked" | "gate_requested"; path?: string; detail: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(workspaceAuditLogs).values({
    workspaceId,
    actor: input.actor,
    action: input.action,
    path: input.path ?? null,
    detail: input.detail,
  });
  return Number(result.insertId);
}

export async function getWorkspaceForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.projectId, projectId)).limit(1);
  return workspace;
}

export async function ensureWorkspaceForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [existing] = await db.select().from(workspaces).where(eq(workspaces.projectId, projectId)).limit(1);
  if (existing) return { workspace: existing, created: false, directories: restrictedWorkspaceDirectories };
  const [result] = await db.insert(workspaces).values({ projectId });
  const workspaceId = Number(result.insertId);
  await recordWorkspaceAudit(workspaceId, {
    actor: "Workspace Manager",
    action: "workspace_created",
    detail: "تم إنشاء Workspace افتراضية مقيدة. لا تمثل مساراً لنظام التشغيل.",
  });
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return { workspace, created: true, directories: restrictedWorkspaceDirectories };
}

export async function listWorkspaceAuditForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.projectId, projectId)).limit(1);
  if (!workspace) return [];
  return db.select().from(workspaceAuditLogs).where(eq(workspaceAuditLogs.workspaceId, workspace.id)).orderBy(desc(workspaceAuditLogs.createdAt)).limit(limit);
}

export async function listWorkspaceFilesForProject(userId: number, projectId: number, limit = 100) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.projectId, projectId)).limit(1);
  if (!workspace) return [];
  return db.select({ id: workspaceFiles.id, path: workspaceFiles.path, version: workspaceFiles.version, createdAt: workspaceFiles.createdAt, updatedAt: workspaceFiles.updatedAt }).from(workspaceFiles).where(eq(workspaceFiles.workspaceId, workspace.id)).orderBy(workspaceFiles.path).limit(limit);
}

export async function readWorkspaceFileForProject(userId: number, input: { projectId: number; path: string; actor?: string }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  try {
    const path = normalizeWorkspacePath(input.path);
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [file] = await db.select().from(workspaceFiles).where(and(eq(workspaceFiles.workspaceId, workspace.id), eq(workspaceFiles.path, path))).limit(1);
    await recordWorkspaceAudit(workspace.id, {
      actor: input.actor ?? "File Reader",
      action: "file_read",
      path,
      detail: file ? `تمت قراءة ملف افتراضي بإصدار ${file.version}.` : "لم يوجد الملف المطلوب داخل Workspace.",
    });
    return file;
  } catch (error) {
    if (error instanceof WorkspacePathError) {
      await recordWorkspaceAudit(workspace.id, { actor: input.actor ?? "File Reader", action: "path_rejected", path: input.path.slice(0, 512), detail: error.message });
    }
    throw error;
  }
}

export async function writeWorkspaceFileForProject(userId: number, input: { projectId: number; path: string; content: string; actor?: string }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  try {
    const path = normalizeWorkspacePath(input.path);
    const content = assertWorkspaceContent(input.content);
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(workspaceFiles).values({ workspaceId: workspace.id, path, content }).onDuplicateKeyUpdate({
      set: { content, version: sql`${workspaceFiles.version} + 1` },
    });
    const [file] = await db.select().from(workspaceFiles).where(and(eq(workspaceFiles.workspaceId, workspace.id), eq(workspaceFiles.path, path))).limit(1);
    await recordWorkspaceAudit(workspace.id, {
      actor: input.actor ?? "File Writer",
      action: "file_written",
      path,
      detail: `تم حفظ ملف افتراضي بالإصدار ${file.version} داخل حدود Workspace.`,
    });
    return file;
  } catch (error) {
    if (error instanceof WorkspacePathError) {
      await recordWorkspaceAudit(workspace.id, { actor: input.actor ?? "File Writer", action: "path_rejected", path: input.path.slice(0, 512), detail: error.message });
    }
    throw error;
  }
}

export async function listSensitiveWorkspaceChangesForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(sensitiveWorkspaceChanges).where(eq(sensitiveWorkspaceChanges.projectId, projectId)).orderBy(desc(sensitiveWorkspaceChanges.createdAt)).limit(limit);
}

export async function listAppliedSensitiveWorkspaceChangesForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(sensitiveWorkspaceChanges).where(and(eq(sensitiveWorkspaceChanges.projectId, projectId), eq(sensitiveWorkspaceChanges.status, "applied"))).orderBy(desc(sensitiveWorkspaceChanges.appliedAt)).limit(limit);
}

export async function submitSensitiveWorkspaceChange(userId: number, input: { projectId: number; path: string; content: string }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  const path = normalizeWorkspacePath(input.path);
  const proposedContent = assertWorkspaceContent(input.content);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [currentFile] = await db.select().from(workspaceFiles).where(and(eq(workspaceFiles.workspaceId, workspace.id), eq(workspaceFiles.path, path))).limit(1);
  if (!currentFile) throw new Error("Workspace file not found");
  const assessment = assessSensitiveWorkspaceChange(path, currentFile.content, proposedContent);
  if (!assessment.sensitive) throw new Error("Change does not require secondary review");
  const riskSummary = assessment.reasons.join("؛ ");
  const approval = await createApprovalRequest(userId, {
    projectId: input.projectId,
    requestedBy: "Workspace Editor",
    title: `مراجعة ثانوية لتعديل ${path}`,
    detail: `اقتراح تعديل حساس محفوظ للمراجعة قبل الكتابة. الإشارات: ${riskSummary}.`,
    impact: "سيكتب التعديل إلى ملف Workspace فقط بعد اعتماد المراجعة الثانوية والتحقق من الإصدار.",
    level: "approval",
  });
  const [result] = await db.insert(sensitiveWorkspaceChanges).values({
    projectId: input.projectId,
    workspaceId: workspace.id,
    approvalId: approval.id,
    requestedByUserId: userId,
    path,
    baseVersion: currentFile.version,
    previousContent: currentFile.content,
    proposedContent,
    riskSummary,
  });
  await recordWorkspaceAudit(workspace.id, { actor: "Workspace Editor", action: "gate_requested", path, detail: "حُفظ اقتراح تعديل حساس للمراجعة الثانوية؛ لم يتغير الملف الحالي." });
  await recordExecutionEvent(userId, input.projectId, { actor: "Workspace Editor", type: "SENSITIVE_WORKSPACE_CHANGE_SUBMITTED", label: "طلب مراجعة ثانوية لتعديل حساس", detail: path });
  return (await db.select().from(sensitiveWorkspaceChanges).where(eq(sensitiveWorkspaceChanges.id, Number(result.insertId))).limit(1))[0];
}

async function applyResolvedSensitiveWorkspaceChange(userId: number, projectId: number, approvalId: number, decision: "approved" | "rejected") {
  const { db } = await requireOwnedProject(userId, projectId);
  const [change] = await db.select().from(sensitiveWorkspaceChanges).where(and(eq(sensitiveWorkspaceChanges.projectId, projectId), eq(sensitiveWorkspaceChanges.approvalId, approvalId))).limit(1);
  if (!change || change.status !== "pending_secondary") return null;
  if (decision === "rejected") {
    await db.update(sensitiveWorkspaceChanges).set({ status: "rejected" }).where(eq(sensitiveWorkspaceChanges.id, change.id));
    await recordWorkspaceAudit(change.workspaceId, { actor: "Secondary Reviewer", action: "tool_rejected", path: change.path, detail: "رُفض اقتراح التعديل الحساس؛ بقي الملف الحالي دون تغيير." });
    await recordExecutionEvent(userId, projectId, { actor: "Secondary Reviewer", type: "SENSITIVE_WORKSPACE_CHANGE_REJECTED", label: "رُفض تعديل حساس", detail: change.path });
    return { status: "rejected" as const, changeId: change.id };
  }
  const [currentFile] = await db.select().from(workspaceFiles).where(and(eq(workspaceFiles.workspaceId, change.workspaceId), eq(workspaceFiles.path, change.path))).limit(1);
  if (!currentFile || currentFile.version !== change.baseVersion) {
    await db.update(sensitiveWorkspaceChanges).set({ status: "conflicted" }).where(eq(sensitiveWorkspaceChanges.id, change.id));
    await recordWorkspaceAudit(change.workspaceId, { actor: "Secondary Reviewer", action: "tool_rejected", path: change.path, detail: "لم يطبق التعديل المعتمد لأن إصدار الملف تغير منذ تقديم الاقتراح." });
    await recordExecutionEvent(userId, projectId, { actor: "Secondary Reviewer", type: "SENSITIVE_WORKSPACE_CHANGE_CONFLICT", label: "تعارض في تعديل حساس", detail: change.path });
    return { status: "conflicted" as const, changeId: change.id };
  }
  await db.update(workspaceFiles).set({ content: change.proposedContent, version: sql`${workspaceFiles.version} + 1` }).where(and(eq(workspaceFiles.id, currentFile.id), eq(workspaceFiles.version, change.baseVersion)));
  const [appliedFile] = await db.select().from(workspaceFiles).where(eq(workspaceFiles.id, currentFile.id)).limit(1);
  if (!appliedFile || appliedFile.version === change.baseVersion) {
    await db.update(sensitiveWorkspaceChanges).set({ status: "conflicted" }).where(eq(sensitiveWorkspaceChanges.id, change.id));
    return { status: "conflicted" as const, changeId: change.id };
  }
  await db.update(sensitiveWorkspaceChanges).set({ status: "applied", appliedAt: new Date() }).where(eq(sensitiveWorkspaceChanges.id, change.id));
  await recordWorkspaceAudit(change.workspaceId, { actor: "Secondary Reviewer", action: "file_written", path: change.path, detail: `اعتمدت المراجعة الثانوية وكتب الاقتراح إلى الإصدار ${appliedFile.version}.` });
  await recordExecutionEvent(userId, projectId, { actor: "Secondary Reviewer", type: "SENSITIVE_WORKSPACE_CHANGE_APPLIED", label: "طُبق تعديل حساس بعد المراجعة", detail: change.path });
  return { status: "applied" as const, changeId: change.id, version: appliedFile.version };
}

export async function listSandboxChecksForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(sandboxChecks).where(eq(sandboxChecks.projectId, projectId)).orderBy(desc(sandboxChecks.createdAt)).limit(limit);
}

export async function runLogicalSandboxCheckForProject(userId: number, input: { projectId: number; kind: "workspace_policy" | "logical_test"; engineRunId?: number }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(sandboxChecks).values({
    projectId: input.projectId,
    workspaceId: workspace.id,
    engineRunId: input.engineRunId ?? null,
    kind: input.kind,
    status: "passed",
    detail: input.kind === "workspace_policy"
      ? "تحقق Sandbox المنطقية من أن Workspace افتراضية ومقيدة بسجل التدقيق؛ لم يُستخدم نظام ملفات أو shell."
      : "نجح الاختبار المنطقي لبنية Workspace والخطة؛ لم تُشغّل شيفرة مستخدم أو اختبارات نظام.",
  });
  await recordWorkspaceAudit(workspace.id, { actor: "Logical Sandbox", action: "sandbox_checked", detail: "تم تسجيل فحص منطقي؛ لا توجد حاوية أو عملية نظام تشغيل." });
  await recordExecutionEvent(userId, input.projectId, { actor: "Logical Sandbox", type: "SANDBOX_CHECK_PASSED", label: "نجح فحص Sandbox المنطقي", detail: input.kind });
  return (await db.select().from(sandboxChecks).where(eq(sandboxChecks.id, Number(result.insertId))).limit(1))[0];
}

export async function requestSandboxGateForProject(userId: number, input: { projectId: number; kind: (typeof sandboxGateKinds)[number] }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const title = sandboxGateTitle(input.kind);
  const detail = sandboxGateDetail(input.kind);
  const approval = await createApprovalRequest(userId, {
    projectId: input.projectId,
    requestedBy: "Logical Sandbox",
    title,
    detail,
    impact: "إجراء حساس محجوب ولا ينفذ تلقائياً.",
    level: "approval",
  });
  const [result] = await db.insert(sandboxChecks).values({
    projectId: input.projectId,
    workspaceId: workspace.id,
    approvalId: approval.id,
    kind: input.kind,
    status: "awaiting_approval",
    detail,
  });
  await recordWorkspaceAudit(workspace.id, { actor: "Logical Sandbox", action: "gate_requested", detail });
  return (await db.select().from(sandboxChecks).where(eq(sandboxChecks.id, Number(result.insertId))).limit(1))[0];
}

export const isolatedRuntimeEnvironment = {
  status: "environment_required" as const,
  canExecuteUserCode: false,
  label: "بيئة نظام تشغيل معزولة غير مهيأة",
  detail: "لا تسمح الاستضافة الحالية بتشغيل شيفرة المستخدم أو Docker من التطبيق. يبقى الطلب مسجلاً ومحجوباً حتى ربط عامل ببيئة معزولة معتمدة.",
};

export async function listIsolatedRuntimeRequestsForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.projectId, projectId)).orderBy(desc(isolatedRuntimeRequests.createdAt)).limit(limit);
}

export async function requestIsolatedRuntimeExecution(userId: number, input: { projectId: number; targetPath: string; engineRunId?: number }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  const path = normalizeWorkspacePath(input.targetPath);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [file] = await db.select({ id: workspaceFiles.id }).from(workspaceFiles).where(and(eq(workspaceFiles.workspaceId, workspace.id), eq(workspaceFiles.path, path))).limit(1);
  if (!file) throw new Error("Workspace file not found");
  const [result] = await db.insert(isolatedRuntimeRequests).values({
    projectId: input.projectId,
    workspaceId: workspace.id,
    engineRunId: input.engineRunId ?? null,
    requestedByUserId: userId,
    targetPath: path,
    status: "environment_required",
    reason: isolatedRuntimeEnvironment.detail,
  });
  await recordWorkspaceAudit(workspace.id, { actor: "Isolated Runtime Gate", action: "tool_rejected", path, detail: "تم تسجيل طلب تنفيذ شيفرة، لكنه محجوب إلى أن تتوفر بيئة نظام تشغيل معزولة معتمدة." });
  await recordExecutionEvent(userId, input.projectId, { actor: "Isolated Runtime Gate", type: "ISOLATED_RUNTIME_BLOCKED", label: "حُجب تنفيذ الشيفرة بانتظار البيئة المعزولة", detail: path });
  return (await db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.id, Number(result.insertId))).limit(1))[0];
}

export async function getWorkerSettingsForOwner(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db.select().from(workerSettings).where(eq(workerSettings.ownerId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(workerSettings).values({ ownerId: userId });
  return (await db.select().from(workerSettings).where(eq(workerSettings.ownerId, userId)).limit(1))[0];
}

export async function setWorkerDesiredState(userId: number, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const runtimeStatus = enabled ? "awaiting_service" : "disabled";
  await db.insert(workerSettings).values({ ownerId: userId, desiredEnabled: enabled ? 1 : 0, runtimeStatus }).onDuplicateKeyUpdate({
    set: { desiredEnabled: enabled ? 1 : 0, runtimeStatus },
  });
  return getWorkerSettingsForOwner(userId);
}

export async function touchWorkerHeartbeat(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workerSettings).set({ runtimeStatus: "ready", lastHeartbeatAt: new Date() }).where(and(
    eq(workerSettings.ownerId, userId),
    eq(workerSettings.desiredEnabled, 1),
  ));
}

export async function listEnabledWorkerOwners() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ ownerId: workerSettings.ownerId }).from(workerSettings).where(eq(workerSettings.desiredEnabled, 1));
}

export async function reclaimExpiredCommandLeases(leaseTimeoutMs: number) {
  const db = await getDb();
  if (!db) return { requeued: 0, failed: 0 };
  const expiredBefore = new Date(Date.now() - leaseTimeoutMs);
  const retryable = await db.update(executionCommands).set({
    status: "queued",
    leaseOwner: null,
    leasedAt: null,
    lastError: "انتهت مهلة حجز العامل الجاف؛ أُعيد الأمر إلى الطابور.",
  }).where(and(
    eq(executionCommands.status, "claimed"),
    lt(executionCommands.leasedAt, expiredBefore),
    sql`${executionCommands.attemptCount} < ${executionCommands.maxAttempts}`,
  ));
  const exhausted = await db.update(executionCommands).set({
    status: "failed",
    leaseOwner: null,
    leasedAt: null,
    lastError: "انتهت مهلة الحجز بعد بلوغ الحد الأقصى لإعادة المحاولة.",
  }).where(and(
    eq(executionCommands.status, "claimed"),
    lt(executionCommands.leasedAt, expiredBefore),
    sql`${executionCommands.attemptCount} >= ${executionCommands.maxAttempts}`,
  ));
  return { requeued: Number(retryable[0].affectedRows ?? 0), failed: Number(exhausted[0].affectedRows ?? 0) };
}

export async function claimNextDryCommand(ownerId: number, workerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [candidate] = await db.select().from(executionCommands)
    .innerJoin(projects, eq(executionCommands.projectId, projects.id))
    .where(and(
      eq(projects.ownerId, ownerId),
      eq(executionCommands.status, "queued"),
      sql`${executionCommands.attemptCount} < ${executionCommands.maxAttempts}`,
    ))
    .orderBy(executionCommands.createdAt)
    .limit(1);
  if (!candidate) return undefined;

  const command = candidate.execution_commands;
  const now = new Date();
  const [result] = await db.update(executionCommands).set({
    status: "claimed",
    leaseOwner: workerId,
    leasedAt: now,
    attemptCount: sql`${executionCommands.attemptCount} + 1`,
    lastError: null,
  }).where(and(eq(executionCommands.id, command.id), eq(executionCommands.status, "queued")));
  if (Number(result.affectedRows ?? 0) !== 1) return undefined;

  await recordExecutionEvent(ownerId, command.projectId, {
    taskId: command.taskId ?? undefined,
    actor: workerId,
    type: "DRY_COMMAND_CLAIMED",
    label: "حجز العامل الجاف أمر التشغيل",
    detail: `تم حجز الأمر ${command.command} بلا تنفيذ أدوات أو أوامر نظام.`,
  });
  return { ...command, status: "claimed" as const, leaseOwner: workerId, leasedAt: now, attemptCount: command.attemptCount + 1 };
}

export async function renewDryCommandLease(commandId: number, workerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.update(executionCommands).set({ leasedAt: new Date() }).where(and(
    eq(executionCommands.id, commandId),
    eq(executionCommands.status, "claimed"),
    eq(executionCommands.leaseOwner, workerId),
  ));
  return Number(result.affectedRows ?? 0) === 1;
}

export type DryRuntimePlanInput = {
  summary: string;
  steps: Array<{ order: number; agent: string; title: string; detail: string; approval: "auto" | "review" | "approval" }>;
  constraints: string[];
};

export type TaskEnginePlanStep = DryRuntimePlanInput["steps"][number];

export async function createTaskEngineRunForPlan(userId: number, input: { planId: number; projectId: number; commandId: number; steps: TaskEnginePlanStep[] }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [existing] = await db.select().from(taskEngineRuns).where(eq(taskEngineRuns.planId, input.planId)).limit(1);
  if (existing) return { run: existing, created: false };
  const [result] = await db.insert(taskEngineRuns).values({ planId: input.planId, projectId: input.projectId, commandId: input.commandId });
  const runId = Number(result.insertId);
  await db.insert(taskEngineSteps).values(input.steps.map((step) => ({
    runId,
    stepOrder: step.order,
    agentKey: step.agent.toLowerCase(),
    title: step.title,
    detail: step.detail,
    approvalLevel: step.approval,
  })));
  await recordExecutionEvent(userId, input.projectId, {
    actor: "Task Engine",
    type: "TASK_ENGINE_RUN_CREATED",
    label: "تم إنشاء دورة محرك المهام",
    detail: `تم إنشاء ${input.steps.length} خطوات منطقية للخطة ${input.planId}.`,
  });
  return { run: (await db.select().from(taskEngineRuns).where(eq(taskEngineRuns.id, runId)).limit(1))[0], created: true };
}

export async function listTaskEngineRunsForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(taskEngineRuns).where(eq(taskEngineRuns.projectId, projectId)).orderBy(desc(taskEngineRuns.updatedAt)).limit(limit);
}

export async function getTaskEngineRunForProject(userId: number, input: { projectId: number; runId: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [run] = await db.select().from(taskEngineRuns).where(and(eq(taskEngineRuns.id, input.runId), eq(taskEngineRuns.projectId, input.projectId))).limit(1);
  if (!run) throw new Error("Task engine run not found");
  const steps = await db.select().from(taskEngineSteps).where(eq(taskEngineSteps.runId, run.id)).orderBy(taskEngineSteps.stepOrder);
  return { run, steps };
}

export async function listActiveTaskEngineRunsForOwners(ownerIds: number[], limit = 50) {
  const db = await getDb();
  if (!db || ownerIds.length === 0) return [];
  return db.select({ run: taskEngineRuns, ownerId: projects.ownerId }).from(taskEngineRuns)
    .innerJoin(projects, eq(taskEngineRuns.projectId, projects.id))
    .where(and(inArray(projects.ownerId, ownerIds), inArray(taskEngineRuns.status, ["queued", "running", "awaiting_review", "awaiting_approval", "verifying"])))
    .orderBy(taskEngineRuns.updatedAt)
    .limit(limit);
}

export async function advanceTaskEngineRunForProject(userId: number, input: { projectId: number; runId: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [run] = await db.select().from(taskEngineRuns).where(and(eq(taskEngineRuns.id, input.runId), eq(taskEngineRuns.projectId, input.projectId))).limit(1);
  if (!run) throw new Error("Task engine run not found");
  if (["completed", "failed", "blocked"].includes(run.status)) return { run, outcome: "terminal" as const };
  const steps = await db.select().from(taskEngineSteps).where(eq(taskEngineSteps.runId, run.id)).orderBy(taskEngineSteps.stepOrder);
  const gatedStep = steps.find((step) => step.status === "awaiting_review" || step.status === "awaiting_approval");
  if (gatedStep) {
    if (!gatedStep.approvalId) throw new Error("Task engine gate missing approval");
    const [approval] = await db.select().from(approvals).where(eq(approvals.id, gatedStep.approvalId)).limit(1);
    if (!approval || approval.status === "pending") return { run, outcome: "waiting" as const };
    if (approval.status === "rejected") {
      await db.update(taskEngineSteps).set({ status: "failed", output: "رُفضت بوابة الموافقة." }).where(eq(taskEngineSteps.id, gatedStep.id));
      await db.update(taskEngineRuns).set({ status: "blocked", currentStepOrder: gatedStep.stepOrder, lastError: "رُفضت بوابة الموافقة." }).where(eq(taskEngineRuns.id, run.id));
      await recordExecutionEvent(userId, input.projectId, { actor: "Task Engine", type: "TASK_ENGINE_BLOCKED", label: "توقفت دورة المحرك بسبب رفض الموافقة", detail: gatedStep.title });
      return { run, outcome: "blocked" as const };
    }
    await db.update(taskEngineSteps).set({ status: "completed", output: "تم اعتماد البوابة؛ أُنجزت الخطوة منطقياً من دون أدوات." }).where(eq(taskEngineSteps.id, gatedStep.id));
    await db.update(taskEngineRuns).set({ status: "queued", currentStepOrder: gatedStep.stepOrder }).where(eq(taskEngineRuns.id, run.id));
    await recordExecutionEvent(userId, input.projectId, { actor: "Task Engine", type: "TASK_ENGINE_GATE_APPROVED", label: "تم اعتماد بوابة المحرك", detail: gatedStep.title });
    return { run, outcome: "gate_approved" as const };
  }
  const next = steps.find((step) => step.status === "pending");
  if (!next) {
    await db.update(taskEngineRuns).set({ status: "completed", currentStepOrder: steps.at(-1)?.stepOrder ?? 0 }).where(eq(taskEngineRuns.id, run.id));
    await recordExecutionEvent(userId, input.projectId, { actor: "Task Engine", type: "TASK_ENGINE_COMPLETED", label: "اكتملت دورة المحرك المنطقية", detail: "اكتملت خطوات الخطة من دون تنفيذ أدوات أو ملفات." });
    return { run, outcome: "completed" as const };
  }
  if (next.approvalLevel !== "auto") {
    const approval = await createApprovalRequest(userId, {
      projectId: input.projectId,
      requestedBy: next.agentKey,
      title: next.title,
      detail: next.detail,
      impact: next.approvalLevel === "approval" ? "إجراء حساس محجوب عن التنفيذ" : "قرار يحتاج مراجعة قبل إكمال المسار",
      level: next.approvalLevel,
    });
    const waitingStatus = next.approvalLevel === "approval" ? "awaiting_approval" : "awaiting_review";
    await db.update(taskEngineSteps).set({ status: waitingStatus, approvalId: approval.id }).where(eq(taskEngineSteps.id, next.id));
    await db.update(taskEngineRuns).set({ status: waitingStatus, currentStepOrder: next.stepOrder }).where(eq(taskEngineRuns.id, run.id));
    await recordExecutionEvent(userId, input.projectId, { actor: "Task Engine", type: "TASK_ENGINE_GATE_REQUESTED", label: "يتطلب المحرك قراراً", detail: next.title });
    return { run, outcome: "gate_requested" as const };
  }
  await db.update(taskEngineSteps).set({ status: "completed", attemptCount: sql`${taskEngineSteps.attemptCount} + 1`, output: "أُنجزت خطوة منطقية بلا تشغيل أدوات أو ملفات." }).where(eq(taskEngineSteps.id, next.id));
  await db.update(taskEngineRuns).set({ status: "queued", currentStepOrder: next.stepOrder }).where(eq(taskEngineRuns.id, run.id));
  await recordExecutionEvent(userId, input.projectId, { actor: "Task Engine", type: "TASK_ENGINE_AUTO_STEP_COMPLETED", label: "أكمل المحرك خطوة تلقائية", detail: next.title });
  return { run, outcome: "auto_completed" as const };
}

export async function listClaimedCommandsForDryRuntime(workerId: string, ownerIds: number[], limit = 25) {
  const db = await getDb();
  if (!db || ownerIds.length === 0) return [];
  return db.select({ command: executionCommands, ownerId: projects.ownerId }).from(executionCommands)
    .innerJoin(projects, eq(executionCommands.projectId, projects.id))
    .where(and(eq(executionCommands.status, "claimed"), eq(executionCommands.leaseOwner, workerId), inArray(projects.ownerId, ownerIds)))
    .orderBy(executionCommands.leasedAt)
    .limit(limit);
}

export async function createDryExecutionPlanForClaim(input: { ownerId: number; commandId: number; workerId: string; plan: DryRuntimePlanInput }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [claim] = await db.select({ command: executionCommands }).from(executionCommands)
    .innerJoin(projects, eq(executionCommands.projectId, projects.id))
    .where(and(
      eq(executionCommands.id, input.commandId),
      eq(executionCommands.status, "claimed"),
      eq(executionCommands.leaseOwner, input.workerId),
      eq(projects.ownerId, input.ownerId),
    ))
    .limit(1);
  if (!claim) throw new Error("Claimed command not found for dry runtime");

  const [existing] = await db.select().from(executionPlans).where(eq(executionPlans.commandId, input.commandId)).limit(1);
  if (existing) return { plan: existing, created: false };

  const command = claim.command;
  const [result] = await db.insert(executionPlans).values({
    commandId: command.id,
    projectId: command.projectId,
    taskId: command.taskId,
    summary: input.plan.summary,
    steps: JSON.stringify(input.plan.steps),
    constraints: JSON.stringify(input.plan.constraints),
  });
  const planId = Number(result.insertId);
  await db.update(projects).set({ currentStage: "runtime_planned" }).where(eq(projects.id, command.projectId));
  await recordExecutionEvent(input.ownerId, command.projectId, {
    taskId: command.taskId ?? undefined,
    actor: input.workerId,
    type: "DRY_RUNTIME_PLAN_CREATED",
    label: "أنشأ Runtime الجاف خطة تنفيذ",
    detail: `الخطة ${planId} للأمر ${command.command}: ${input.plan.summary}`,
  });
  const plan = (await db.select().from(executionPlans).where(eq(executionPlans.id, planId)).limit(1))[0];
  await createTaskEngineRunForPlan(input.ownerId, { planId, projectId: command.projectId, commandId: command.id, steps: input.plan.steps });
  return { plan, created: true };
}

export async function listProjectExecutionPlans(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(executionPlans).where(eq(executionPlans.projectId, projectId)).orderBy(desc(executionPlans.createdAt)).limit(limit);
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

export async function listAgentPromptAssignmentsForOwner(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(agentPromptAssignments).where(eq(agentPromptAssignments.ownerId, userId)).orderBy(desc(agentPromptAssignments.updatedAt));
}

export async function upsertAgentPromptAssignmentForOwner(userId: number, input: { agentKey: string; templateKey: (typeof promptTemplateKeyValues)[number]; templateLocale: (typeof promptTemplateLocaleValues)[number]; customInstructions: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(agentPromptAssignments).values({
    ownerId: userId,
    agentKey: input.agentKey,
    templateKey: input.templateKey,
    templateLocale: input.templateLocale,
    customInstructions: input.customInstructions,
  }).onDuplicateKeyUpdate({
    set: { templateKey: input.templateKey, templateLocale: input.templateLocale, customInstructions: input.customInstructions },
  });
  return (await db.select().from(agentPromptAssignments).where(and(eq(agentPromptAssignments.ownerId, userId), eq(agentPromptAssignments.agentKey, input.agentKey))).limit(1))[0];
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

export async function listOwnerApprovalsWithEngineContext(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    approval: approvals,
    project: { id: projects.id, name: projects.name, code: projects.code },
    engineStep: taskEngineSteps,
    engineRun: taskEngineRuns,
    sensitiveChange: sensitiveWorkspaceChanges,
  }).from(approvals)
    .innerJoin(projects, eq(approvals.projectId, projects.id))
    .leftJoin(taskEngineSteps, eq(approvals.id, taskEngineSteps.approvalId))
    .leftJoin(taskEngineRuns, eq(taskEngineSteps.runId, taskEngineRuns.id))
    .leftJoin(sensitiveWorkspaceChanges, eq(approvals.id, sensitiveWorkspaceChanges.approvalId))
    .where(eq(projects.ownerId, userId))
    .orderBy(desc(approvals.createdAt))
    .limit(limit);
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
  const sensitiveChangeTransition = await applyResolvedSensitiveWorkspaceChange(userId, input.projectId, input.approvalId, input.decision);
  const [engineStep] = await db.select().from(taskEngineSteps).where(eq(taskEngineSteps.approvalId, input.approvalId)).limit(1);
  const engineTransition = engineStep ? await advanceTaskEngineRunForProject(userId, { projectId: input.projectId, runId: engineStep.runId }) : null;
  return { approval: (await db.select().from(approvals).where(eq(approvals.id, input.approvalId)).limit(1))[0], engineTransition, sensitiveChangeTransition };
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
