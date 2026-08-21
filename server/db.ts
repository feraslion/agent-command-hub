import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agentPromptAssignments,
  agentExecutions,
  agentModelRuns,
  agents,
  approvals,
  artifacts,
  contextPackages,
  costEntries,
  councilOpinions,
  decisions,
  engineConnections,
  engineSessions,
  evidenceClaims,
  evidenceSources,
  executionCommands,
  executionEvents,
  executionPlans,
  isolatedRuntimeBundles,
  isolatedRuntimeRequests,
  localRunners,
  multiFileBundleTemplates,
  modelCostReservations,
  modelUsage,
  plannerTaskProposals,
  projectBuildRequests,
  projectBriefs,
  projectImports,
  projectReports,
  researchCampaigns,
  researchQuestions,
  researchSyntheses,
  projects,
  projectRepositoryLinks,
  repositoryScans,
  sandboxChecks,
  sensitiveWorkspaceChanges,
  taskAcceptanceCriteria,
  taskDependencies,
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
  workPlans,
  workspaceAuditLogs,
  workspaceFiles,
  workspaces,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sandboxGateDetail, sandboxGateKinds, sandboxGateTitle } from "./sandbox-policy";
import { assessSensitiveWorkspaceChange } from "../lib/sensitive-workspace-policy";
import { assertWorkspaceContent, normalizeWorkspacePath, WorkspacePathError } from "./workspace-policy";
import { assertLocalRunnerExecutable, truncateRunnerOutput } from "./local-runner-policy";
import { assertMultiFileBundle } from "./multi-file-runner-policy";
import { broadcastRuntimeUpdate } from "./runtime-realtime";
import { buildProjectReportDraft, estimateContextTokens, getCriticalPathTaskIds, normalizeContextSourceRefs, type ContextSourceRef, wouldCreateDependencyCycle } from "../lib/project-governance";
import { modelRolePolicies, type AgentModelRole } from "../lib/agent-model-policy";
import { validatePullRequestDraft, type PullRequestDraft } from "../lib/git-pr-policy";
import type { PlannerInterpretation } from "../lib/planner-output-interpreter";
import { buildPlannerTaskProposals, parsePlannerProposalCriteria } from "../lib/planner-task-proposals";
import { assertEnginePlanningOnly, defaultEngineCapabilities, evidenceInstructionRisk, trustTierForSourceType, type EngineConnectionKind, type ResearchSourceType } from "../lib/research-fabric-policy";
import { buildResearchSynthesis } from "../lib/research-synthesis";
import { validateBuildRequest, validateRepositoryReference, validateZipArchive } from "../lib/project-intake-policy";
import { storagePut } from "./storage";

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

const localRunnerHeartbeatWindowMs = 30_000;

function hashRunnerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isRunnerFresh(lastHeartbeatAt: Date | null) {
  return Boolean(lastHeartbeatAt && Date.now() - new Date(lastHeartbeatAt).getTime() <= localRunnerHeartbeatWindowMs);
}

function runnerProfiles(capabilities: string | null) {
  try {
    const parsed = JSON.parse(capabilities ?? "{}") as { profiles?: unknown };
    return Array.isArray(parsed.profiles) ? parsed.profiles.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function supportsRunnerProfile(runner: typeof localRunners.$inferSelect, profile: string) {
  return runnerProfiles(runner.capabilities).includes(profile);
}

function publicRunner(runner: typeof localRunners.$inferSelect) {
  return {
    id: runner.id,
    runnerKey: runner.runnerKey,
    label: runner.label,
    status: runner.status === "revoked" ? "revoked" : isRunnerFresh(runner.lastHeartbeatAt) ? runner.status : "offline",
    capabilities: runner.capabilities,
    lastHeartbeatAt: runner.lastHeartbeatAt,
    createdAt: runner.createdAt,
    updatedAt: runner.updatedAt,
  };
}

export async function listLocalRunnersForOwner(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const runners = await db.select().from(localRunners).where(eq(localRunners.ownerId, userId)).orderBy(desc(localRunners.updatedAt));
  return runners.map(publicRunner);
}

export async function createLocalRunnerPairingForOwner(userId: number, label: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const runnerKey = `runner-${randomBytes(6).toString("hex")}`;
  const token = randomBytes(32).toString("base64url");
  const [result] = await db.insert(localRunners).values({
    ownerId: userId,
    runnerKey,
    label,
    tokenHash: hashRunnerToken(token),
  });
  const [runner] = await db.select().from(localRunners).where(eq(localRunners.id, Number(result.insertId))).limit(1);
  return { runner: publicRunner(runner), token };
}

export async function revokeLocalRunnerForOwner(userId: number, runnerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [runner] = await db.select().from(localRunners).where(and(eq(localRunners.id, runnerId), eq(localRunners.ownerId, userId))).limit(1);
  if (!runner) throw new Error("Local runner not found");
  await db.update(localRunners).set({ status: "revoked", revokedAt: new Date(), tokenHash: hashRunnerToken(randomBytes(32).toString("base64url")) }).where(eq(localRunners.id, runner.id));
  return (await listLocalRunnersForOwner(userId)).find((candidate) => candidate.id === runnerId);
}

export async function getIsolatedRuntimeStatusForOwner(userId: number) {
  const runners = await listLocalRunnersForOwner(userId);
  const readyRunner = runners.find((runner) => runner.status === "ready");
  if (readyRunner) {
    return {
      status: "ready" as const,
      canExecuteUserCode: true,
      label: "Runner محلي متصل وجاهز",
      detail: `يتصل ${readyRunner.label} ببيئة Docker مقيدة. التنفيذ يقتصر على JavaScript المستقل بعد موافقة صريحة.`,
      runner: readyRunner,
    };
  }
  return {
    status: "environment_required" as const,
    canExecuteUserCode: false,
    label: "Runner محلي غير متصل",
    detail: "اربط Runner محلياً في الإعدادات وشغله على جهاز يملك Docker. لن ينفذ التطبيق شيفرة أو أدوات حتى يصل heartbeat صالح.",
    runner: null,
  };
}

export async function authenticateLocalRunner(input: { runnerKey: string; token: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [runner] = await db.select().from(localRunners).where(and(
    eq(localRunners.runnerKey, input.runnerKey),
    eq(localRunners.tokenHash, hashRunnerToken(input.token)),
  )).limit(1);
  if (!runner || runner.status === "revoked") throw new Error("Local runner credentials are invalid or revoked");
  return runner;
}

export async function heartbeatLocalRunner(input: { runnerKey: string; token: string; capabilities?: Record<string, unknown> }) {
  const runner = await authenticateLocalRunner(input);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(localRunners).set({
    status: "ready",
    capabilities: input.capabilities ? JSON.stringify(input.capabilities) : runner.capabilities,
    lastHeartbeatAt: new Date(),
  }).where(eq(localRunners.id, runner.id));
  broadcastRuntimeUpdate(runner.ownerId, "runner");
  return (await db.select().from(localRunners).where(eq(localRunners.id, runner.id)).limit(1))[0];
}

export type RepositoryScanSummary = {
  displayName: string;
  fileCount: number;
  directoryCount: number;
  languages: Record<string, number>;
  manifests: string[];
  testSignals: string[];
  sensitiveSignals: string[];
};

export async function reportRepositoryScanFromRunner(input: { runnerKey: string; token: string; projectId: number; summary: RepositoryScanSummary }) {
  const runner = await authenticateLocalRunner(input);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [project] = await db.select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, runner.ownerId))).limit(1);
  if (!project) throw new Error("Project not found or access denied");

  const now = new Date();
  await db.insert(projectRepositoryLinks).values({
    projectId: project.id,
    runnerId: runner.id,
    repositoryName: input.summary.displayName,
    status: "scanned",
    lastScannedAt: now,
  }).onDuplicateKeyUpdate({
    set: {
      runnerId: runner.id,
      repositoryName: input.summary.displayName,
      status: "scanned",
      lastScannedAt: now,
    },
  });

  const [result] = await db.insert(repositoryScans).values({
    projectId: project.id,
    runnerId: runner.id,
    displayName: input.summary.displayName,
    fileCount: input.summary.fileCount,
    directoryCount: input.summary.directoryCount,
    languageSummary: JSON.stringify(input.summary.languages),
    manifestSummary: JSON.stringify(input.summary.manifests),
    testSummary: JSON.stringify(input.summary.testSignals),
    sensitiveSummary: JSON.stringify(input.summary.sensitiveSignals),
  });
  broadcastRuntimeUpdate(runner.ownerId, "runner");
  return (await db.select().from(repositoryScans).where(eq(repositoryScans.id, Number(result.insertId))).limit(1))[0];
}

export async function listRepositoryScansForOwner(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    scan: repositoryScans,
    project: { id: projects.id, name: projects.name, code: projects.code },
    runner: { id: localRunners.id, label: localRunners.label, runnerKey: localRunners.runnerKey },
  }).from(repositoryScans)
    .innerJoin(projects, eq(repositoryScans.projectId, projects.id))
    .innerJoin(localRunners, eq(repositoryScans.runnerId, localRunners.id))
    .where(projectId ? and(eq(projects.ownerId, userId), eq(projects.id, projectId)) : eq(projects.ownerId, userId))
    .orderBy(desc(repositoryScans.createdAt))
    .limit(30);
  return rows;
}

export async function requestPullRequestForOwner(userId: number, draft: PullRequestDraft) {
  const normalized = validatePullRequestDraft(draft);
  const detail = `طلب مراجعة Pull Request فقط: ${normalized.headBranch} ← ${normalized.baseBranch}.${normalized.summary ? ` ${normalized.summary}` : ""} لن تنفذ المنصة دفعاً أو دمجاً أو حذفاً؛ بعد الاعتماد يلزم Runner محلي وخطوة منفصلة مصرح بها.`;
  return createApprovalRequest(userId, {
    projectId: normalized.projectId,
    requestedBy: "Git PR Gate",
    title: normalized.title,
    detail,
    impact: "مراجعة تغيير عبر Pull Request فقط؛ لا يوجد دمج أو دفع تلقائي.",
    level: "approval",
  });
}

export async function claimLocalRuntimeRequest(input: { runnerKey: string; token: string }) {
  const runner = await heartbeatLocalRunner(input);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [candidate] = await db.select().from(isolatedRuntimeRequests).where(and(
    eq(isolatedRuntimeRequests.runnerId, runner.id),
    eq(isolatedRuntimeRequests.status, "queued"),
  )).orderBy(isolatedRuntimeRequests.createdAt).limit(1);
  if (!candidate) return null;
  const [claim] = await db.update(isolatedRuntimeRequests).set({ status: "claimed", claimedAt: new Date() }).where(and(
    eq(isolatedRuntimeRequests.id, candidate.id),
    eq(isolatedRuntimeRequests.status, "queued"),
  ));
  if (Number(claim.affectedRows ?? 0) !== 1) return null;
  let outbound: { requestId: number; targetPath: string; profile: "node_script" | "typescript_lockfile" | "typescript_multi_file"; content?: string; files?: { path: string; content: string }[] };
  try {
    if (candidate.profile === "typescript_multi_file") {
      const [bundleRecord] = await db.select().from(isolatedRuntimeBundles).where(eq(isolatedRuntimeBundles.requestId, candidate.id)).limit(1);
      if (!bundleRecord) throw new Error("تعذر العثور على حزمة الملفات المتعددة عند الحجز.");
      const parsedFiles: unknown = JSON.parse(bundleRecord.filesJson);
      if (!Array.isArray(parsedFiles)) throw new Error("صيغة حزمة الملفات المتعددة غير صالحة.");
      const bundle = assertMultiFileBundle(bundleRecord.entryPath, parsedFiles as { path: string; content: string }[]);
      outbound = { requestId: candidate.id, targetPath: bundle.entryPath, profile: "typescript_multi_file", files: bundle.files };
    } else {
      const [file] = await db.select({ content: workspaceFiles.content }).from(workspaceFiles).where(and(
        eq(workspaceFiles.workspaceId, candidate.workspaceId),
        eq(workspaceFiles.path, candidate.targetPath),
      )).limit(1);
      if (!file) throw new Error("تعذر العثور على ملف Workspace عند الحجز.");
      const executable = assertLocalRunnerExecutable(candidate.targetPath, file.content);
      outbound = { requestId: candidate.id, targetPath: executable.normalizedPath, profile: executable.profile, content: file.content };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "رفضت سياسة Runner محتوى الملف بعد الحجز.";
    await db.update(isolatedRuntimeRequests).set({ status: "failed", reason: detail, completedAt: new Date() }).where(eq(isolatedRuntimeRequests.id, candidate.id));
    await recordWorkspaceAudit(candidate.workspaceId, { actor: runner.runnerKey, action: "tool_rejected", path: candidate.targetPath, detail });
    await recordExecutionEvent(runner.ownerId, candidate.projectId, { actor: runner.runnerKey, type: "ISOLATED_RUNTIME_POLICY_REJECTED", label: "رفض Runner طلب تنفيذ بعد الحجز", detail: candidate.targetPath });
    throw error;
  }
  await db.update(localRunners).set({ status: "busy", lastHeartbeatAt: new Date() }).where(eq(localRunners.id, runner.id));
  broadcastRuntimeUpdate(runner.ownerId, "request");
  await recordWorkspaceAudit(candidate.workspaceId, { actor: runner.runnerKey, action: "sandbox_checked", path: candidate.targetPath, detail: "حجز Runner محلي طلباً معتمداً للتنفيذ داخل حاوية مقيدة." });
  await recordExecutionEvent(runner.ownerId, candidate.projectId, { actor: runner.runnerKey, type: "ISOLATED_RUNTIME_CLAIMED", label: "حجز Runner محلي طلب تنفيذ", detail: candidate.targetPath });
  return outbound;
}

export async function reportLocalRuntimeRequest(input: { runnerKey: string; token: string; requestId: number; status: "completed" | "failed"; exitCode: number; stdout?: string; stderr?: string; durationMs: number }) {
  const runner = await authenticateLocalRunner(input);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(isolatedRuntimeRequests).where(and(
    eq(isolatedRuntimeRequests.id, input.requestId),
    eq(isolatedRuntimeRequests.runnerId, runner.id),
    eq(isolatedRuntimeRequests.status, "claimed"),
  )).limit(1);
  if (!request) throw new Error("Runtime request is not claimed by this runner");
  const status = input.status === "completed" && input.exitCode === 0 ? "completed" : "failed" as const;
  const stdout = truncateRunnerOutput(input.stdout ?? "", 8_000);
  const stderr = truncateRunnerOutput(input.stderr ?? "", 8_000);
  await db.update(isolatedRuntimeRequests).set({
    status,
    exitCode: input.exitCode,
    stdout,
    stderr,
    durationMs: Math.max(0, Math.min(input.durationMs, 60_000)),
    reason: status === "completed" ? "اكتمل التنفيذ المحدود داخل Runner المحلي." : "أعاد Runner المحلي نتيجة فشل أو رمز خروج غير صفري.",
    completedAt: new Date(),
  }).where(eq(isolatedRuntimeRequests.id, request.id));
  await db.update(localRunners).set({ status: "ready", lastHeartbeatAt: new Date() }).where(eq(localRunners.id, runner.id));
  broadcastRuntimeUpdate(runner.ownerId, "request");
  await recordWorkspaceAudit(request.workspaceId, { actor: runner.runnerKey, action: "sandbox_checked", path: request.targetPath, detail: status === "completed" ? "اكتمل التنفيذ المحدود داخل الحاوية بنجاح." : "انتهى التنفيذ المحدود داخل الحاوية بفشل؛ راجع المخرجات المقتطعة." });
  await recordExecutionEvent(runner.ownerId, request.projectId, { actor: runner.runnerKey, type: status === "completed" ? "ISOLATED_RUNTIME_COMPLETED" : "ISOLATED_RUNTIME_FAILED", label: status === "completed" ? "اكتمل تنفيذ معزول" : "فشل تنفيذ معزول", detail: `${request.targetPath} · exit ${input.exitCode}` });
  return (await db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.id, request.id)).limit(1))[0];
}

export async function listIsolatedRuntimeRequestsForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.projectId, projectId)).orderBy(desc(isolatedRuntimeRequests.createdAt)).limit(limit);
}

export async function listOwnerIsolatedRuntimeRequests(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    request: isolatedRuntimeRequests,
    project: { id: projects.id, name: projects.name, code: projects.code },
    runner: { id: localRunners.id, label: localRunners.label, runnerKey: localRunners.runnerKey },
  }).from(isolatedRuntimeRequests)
    .innerJoin(projects, eq(isolatedRuntimeRequests.projectId, projects.id))
    .leftJoin(localRunners, eq(isolatedRuntimeRequests.runnerId, localRunners.id))
    .where(eq(projects.ownerId, userId))
    .orderBy(desc(isolatedRuntimeRequests.createdAt))
    .limit(limit);
}

/** يلخص مؤشرات الصحة من بيانات المالك فقط، ولا يغير أي حالة تشغيلية. */
export async function getOwnerOperationalHealth(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [runtimeRecords, runners, worker, pendingApprovals, ownedProjects, ownerCosts] = await Promise.all([
    db.select({ status: isolatedRuntimeRequests.status, createdAt: isolatedRuntimeRequests.createdAt, completedAt: isolatedRuntimeRequests.completedAt }).from(isolatedRuntimeRequests).innerJoin(projects, eq(isolatedRuntimeRequests.projectId, projects.id)).where(eq(projects.ownerId, userId)),
    listLocalRunnersForOwner(userId),
    getWorkerSettingsForOwner(userId),
    db.select({ id: approvals.id }).from(approvals).innerJoin(projects, eq(approvals.projectId, projects.id)).where(and(eq(projects.ownerId, userId), eq(approvals.status, "pending"))),
    db.select({ id: projects.id, budgetLimit: projects.budgetLimit }).from(projects).where(eq(projects.ownerId, userId)),
    db.select({ amount: costEntries.amount }).from(costEntries).innerJoin(projects, eq(costEntries.projectId, projects.id)).where(eq(projects.ownerId, userId)),
  ]);
  const spent = ownerCosts.reduce((total, entry) => total + Number(entry.amount), 0);
  const budget = ownedProjects.reduce((total, project) => total + Number(project.budgetLimit), 0);
  return {
    queued: runtimeRecords.filter((record) => record.status === "queued").length,
    activeLeases: runtimeRecords.filter((record) => record.status === "claimed").length,
    failedLast24h: runtimeRecords.filter((record) => (record.status === "failed" || record.status === "blocked") && new Date(record.completedAt ?? record.createdAt).getTime() >= since.getTime()).length,
    pendingApprovals: pendingApprovals.length,
    readyRunners: runners.filter((runner) => runner.status === "ready").length,
    workerStatus: worker.runtimeStatus,
    workerHeartbeatAt: worker.lastHeartbeatAt,
    budgetPercent: budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0,
  };
}

export async function requestIsolatedRuntimeExecution(userId: number, input: { projectId: number; targetPath: string; engineRunId?: number }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  const path = normalizeWorkspacePath(input.targetPath);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [file] = await db.select({ id: workspaceFiles.id, content: workspaceFiles.content }).from(workspaceFiles).where(and(eq(workspaceFiles.workspaceId, workspace.id), eq(workspaceFiles.path, path))).limit(1);
  if (!file) throw new Error("Workspace file not found");
  const executable = assertLocalRunnerExecutable(path, file.content);
  const runners = await db.select().from(localRunners).where(eq(localRunners.ownerId, userId)).orderBy(desc(localRunners.updatedAt));
  const runner = runners.find((candidate) => candidate.status === "ready" && isRunnerFresh(candidate.lastHeartbeatAt) && supportsRunnerProfile(candidate, executable.profile));
  if (!runner) {
    const detail = executable.profile === "typescript_lockfile"
      ? "لا يوجد Runner محلي متصل يعلن دعم صورة TypeScript المثبتة من lockfile. شغّل العميل المحدث ثم أعد المحاولة."
      : "اربط Runner محلياً في الإعدادات وشغله على جهاز يملك Docker. لن ينفذ التطبيق شيفرة أو أدوات حتى يصل heartbeat صالح.";
    const [result] = await db.insert(isolatedRuntimeRequests).values({
      projectId: input.projectId,
      workspaceId: workspace.id,
      engineRunId: input.engineRunId ?? null,
      requestedByUserId: userId,
      targetPath: path,
      profile: executable.profile,
      status: "environment_required",
      reason: detail,
    });
    await recordWorkspaceAudit(workspace.id, { actor: "Isolated Runtime Gate", action: "tool_rejected", path, detail });
    await recordExecutionEvent(userId, input.projectId, { actor: "Isolated Runtime Gate", type: "ISOLATED_RUNTIME_RUNNER_REQUIRED", label: "حُجب التنفيذ بانتظار Runner متوافق", detail: path });
    broadcastRuntimeUpdate(userId, "request");
    return (await db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.id, Number(result.insertId))).limit(1))[0];
  }
  const approval = await createApprovalRequest(userId, {
    projectId: input.projectId,
    requestedBy: "Isolated Runtime Gate",
    title: `تنفيذ معزول للملف ${path}`,
    detail: `سيشغّل Runner المحلي ${runner.label} ملف ${executable.profile === "typescript_lockfile" ? "TypeScript مستقلاً من صورة مقيدة مثبتة بـ lockfile" : "JavaScript مستقلاً"} داخل حاوية بلا شبكة وبحدود 15 ثانية و256MB.`,
    impact: "تنفيذ شيفرة داخل بيئة Docker محلية مقيدة بعد اعتماد صريح.",
    level: "approval",
  });
  const [result] = await db.insert(isolatedRuntimeRequests).values({
    projectId: input.projectId,
    workspaceId: workspace.id,
    engineRunId: input.engineRunId ?? null,
    requestedByUserId: userId,
    approvalId: approval.id,
    runnerId: runner.id,
    targetPath: path,
    profile: executable.profile,
    status: "awaiting_approval",
    reason: "ينتظر موافقة صريحة قبل إتاحة الطلب إلى Runner المحلي.",
  });
  await recordWorkspaceAudit(workspace.id, { actor: "Isolated Runtime Gate", action: "gate_requested", path, detail: "أُنشئ طلب موافقة لتنفيذ محدود عبر Runner محلي؛ لم تُشغّل شيفرة بعد." });
  await recordExecutionEvent(userId, input.projectId, { actor: "Isolated Runtime Gate", type: "ISOLATED_RUNTIME_APPROVAL_REQUESTED", label: "طلب موافقة لتنفيذ معزول", detail: path });
  broadcastRuntimeUpdate(userId, "approval");
  return (await db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.id, Number(result.insertId))).limit(1))[0];
}

export async function requestMultiFileRuntimeExecution(userId: number, input: { projectId: number; entryPath: string; paths: string[]; engineRunId?: number }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  const requestedPaths = [...new Set(input.paths.map(normalizeWorkspacePath))];
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const workspaceBundle = await db.select({ path: workspaceFiles.path, content: workspaceFiles.content }).from(workspaceFiles).where(and(
    eq(workspaceFiles.workspaceId, workspace.id),
    inArray(workspaceFiles.path, requestedPaths),
  ));
  if (workspaceBundle.length !== requestedPaths.length) throw new Error("يجب أن تكون جميع ملفات الحزمة موجودة في Workspace.");
  const bundle = assertMultiFileBundle(normalizeWorkspacePath(input.entryPath), workspaceBundle);
  const runners = await db.select().from(localRunners).where(eq(localRunners.ownerId, userId)).orderBy(desc(localRunners.updatedAt));
  const runner = runners.find((candidate) => candidate.status === "ready" && isRunnerFresh(candidate.lastHeartbeatAt) && supportsRunnerProfile(candidate, "typescript_multi_file"));
  const requestValues = {
    projectId: input.projectId,
    workspaceId: workspace.id,
    engineRunId: input.engineRunId ?? null,
    requestedByUserId: userId,
    targetPath: bundle.entryPath,
    profile: "typescript_multi_file",
  } as const;
  if (!runner) {
    const detail = "لا يوجد Runner محلي متصل يعلن دعم حزمة TypeScript متعددة الملفات. شغّل العميل المحدث على جهاز يملك Docker؛ لن ينفذ التطبيق أي شيفرة قبل ذلك.";
    const [result] = await db.insert(isolatedRuntimeRequests).values({ ...requestValues, status: "environment_required", reason: detail });
    await db.insert(isolatedRuntimeBundles).values({ requestId: Number(result.insertId), entryPath: bundle.entryPath, filesJson: JSON.stringify(bundle.files), totalBytes: bundle.totalBytes });
    await recordWorkspaceAudit(workspace.id, { actor: "Multi-file Runtime Gate", action: "tool_rejected", path: bundle.entryPath, detail });
    await recordExecutionEvent(userId, input.projectId, { actor: "Multi-file Runtime Gate", type: "ISOLATED_RUNTIME_RUNNER_REQUIRED", label: "حُجب تنفيذ متعدد الملفات بانتظار Runner متوافق", detail: bundle.entryPath });
    broadcastRuntimeUpdate(userId, "request");
    return (await db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.id, Number(result.insertId))).limit(1))[0];
  }
  const approval = await createApprovalRequest(userId, {
    projectId: input.projectId,
    requestedBy: "Multi-file Runtime Gate",
    title: `تنفيذ TypeScript متعدد الملفات (${bundle.files.length})`,
    detail: `سيشغّل Runner المحلي ${runner.label} حزمة تضم ${bundle.files.length} ملفاً من Workspace داخل حاوية بلا شبكة وبحد أقصى 20 ثانية و384MB. لا يُسمح إلا بالاستيراد النسبي، ولا توجد حزم خارجية أو وصول إلى النظام.`,
    impact: "تنفيذ شيفرة متعددة الملفات داخل Docker محلي مقيد بعد اعتماد صريح.",
    level: "approval",
  });
  const [result] = await db.insert(isolatedRuntimeRequests).values({ ...requestValues, approvalId: approval.id, runnerId: runner.id, status: "awaiting_approval", reason: "ينتظر موافقة صريحة قبل إتاحة الحزمة متعددة الملفات إلى Runner المحلي." });
  await db.insert(isolatedRuntimeBundles).values({ requestId: Number(result.insertId), entryPath: bundle.entryPath, filesJson: JSON.stringify(bundle.files), totalBytes: bundle.totalBytes });
  await recordWorkspaceAudit(workspace.id, { actor: "Multi-file Runtime Gate", action: "gate_requested", path: bundle.entryPath, detail: "أُنشئ طلب موافقة لتنفيذ حزمة TypeScript متعددة الملفات؛ لم تُشغّل الشيفرة بعد." });
  await recordExecutionEvent(userId, input.projectId, { actor: "Multi-file Runtime Gate", type: "ISOLATED_RUNTIME_APPROVAL_REQUESTED", label: "طلب موافقة لتنفيذ متعدد الملفات", detail: bundle.entryPath });
  broadcastRuntimeUpdate(userId, "approval");
  return (await db.select().from(isolatedRuntimeRequests).where(eq(isolatedRuntimeRequests.id, Number(result.insertId))).limit(1))[0];
}

function parseMultiFileTemplatePaths(pathsJson: string) {
  try {
    const parsed: unknown = JSON.parse(pathsJson);
    return Array.isArray(parsed) ? parsed.filter((path): path is string => typeof path === "string") : [];
  } catch {
    return [];
  }
}

export async function listMultiFileBundleTemplatesForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const templates = await db.select().from(multiFileBundleTemplates).where(eq(multiFileBundleTemplates.projectId, projectId)).orderBy(desc(multiFileBundleTemplates.updatedAt));
  return templates.map((template) => ({ ...template, paths: parseMultiFileTemplatePaths(template.pathsJson) }));
}

export async function saveMultiFileBundleTemplateForProject(userId: number, input: { projectId: number; name: string; entryPath: string; paths: string[] }) {
  const ensured = await ensureWorkspaceForProject(userId, input.projectId);
  const workspace = ensured.workspace;
  const name = input.name.trim();
  if (!name) throw new Error("اسم قالب الحزمة مطلوب.");
  const entryPath = normalizeWorkspacePath(input.entryPath);
  const requestedPaths = [...new Set(input.paths.map(normalizeWorkspacePath))];
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const workspaceBundle = await db.select({ path: workspaceFiles.path, content: workspaceFiles.content }).from(workspaceFiles).where(and(
    eq(workspaceFiles.workspaceId, workspace.id),
    inArray(workspaceFiles.path, requestedPaths),
  ));
  if (workspaceBundle.length !== requestedPaths.length) throw new Error("لا يمكن حفظ قالب يحتوي ملفات غير موجودة في Workspace.");
  const bundle = assertMultiFileBundle(entryPath, workspaceBundle);
  const pathsJson = JSON.stringify(bundle.files.map((file) => file.path));
  await db.insert(multiFileBundleTemplates).values({
    projectId: input.projectId,
    name,
    entryPath: bundle.entryPath,
    pathsJson,
  }).onDuplicateKeyUpdate({
    set: { entryPath: bundle.entryPath, pathsJson, updatedAt: new Date() },
  });
  await recordWorkspaceAudit(workspace.id, {
    actor: "Multi-file Template",
    action: "gate_requested",
    path: bundle.entryPath,
    detail: `حُفظ قالب حزمة TypeScript باسم «${name}» يضم ${bundle.files.length} ملفات؛ لا ينشئ ذلك طلب تنفيذ.`,
  });
  await recordExecutionEvent(userId, input.projectId, {
    actor: "Multi-file Template",
    type: "MULTI_FILE_TEMPLATE_SAVED",
    label: "حُفظ قالب حزمة TypeScript",
    detail: `${name} · ${bundle.files.length} ملفات`,
  });
  const [template] = await db.select().from(multiFileBundleTemplates).where(and(
    eq(multiFileBundleTemplates.projectId, input.projectId),
    eq(multiFileBundleTemplates.name, name),
  )).limit(1);
  return { ...template, paths: parseMultiFileTemplatePaths(template.pathsJson) };
}

export async function renameMultiFileBundleTemplateForProject(userId: number, input: { projectId: number; templateId: number; name: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const name = input.name.trim();
  if (!name) throw new Error("اسم قالب الحزمة مطلوب.");
  const [template] = await db.select().from(multiFileBundleTemplates).where(and(
    eq(multiFileBundleTemplates.id, input.templateId),
    eq(multiFileBundleTemplates.projectId, input.projectId),
  )).limit(1);
  if (!template) throw new Error("قالب الحزمة غير موجود أو لا يمكن الوصول إليه.");
  const [sameName] = await db.select({ id: multiFileBundleTemplates.id }).from(multiFileBundleTemplates).where(and(
    eq(multiFileBundleTemplates.projectId, input.projectId),
    eq(multiFileBundleTemplates.name, name),
  )).limit(1);
  if (sameName && sameName.id !== template.id) throw new Error("يوجد قالب آخر بهذا الاسم داخل المشروع.");
  await db.update(multiFileBundleTemplates).set({ name, updatedAt: new Date() }).where(eq(multiFileBundleTemplates.id, template.id));
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.projectId, input.projectId)).limit(1);
  if (workspace) await recordWorkspaceAudit(workspace.id, {
    actor: "Multi-file Template",
    action: "gate_requested",
    path: template.entryPath,
    detail: `أُعيدت تسمية قالب حزمة TypeScript من «${template.name}» إلى «${name}»؛ لا ينشئ ذلك طلب تنفيذ.`,
  });
  await recordExecutionEvent(userId, input.projectId, {
    actor: "Multi-file Template",
    type: "MULTI_FILE_TEMPLATE_RENAMED",
    label: "أُعيدت تسمية قالب حزمة TypeScript",
    detail: `${template.name} → ${name}`,
  });
  const [updated] = await db.select().from(multiFileBundleTemplates).where(eq(multiFileBundleTemplates.id, template.id)).limit(1);
  return { ...updated, paths: parseMultiFileTemplatePaths(updated.pathsJson) };
}

export async function deleteMultiFileBundleTemplateForProject(userId: number, input: { projectId: number; templateId: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [template] = await db.select().from(multiFileBundleTemplates).where(and(
    eq(multiFileBundleTemplates.id, input.templateId),
    eq(multiFileBundleTemplates.projectId, input.projectId),
  )).limit(1);
  if (!template) throw new Error("قالب الحزمة غير موجود أو لا يمكن الوصول إليه.");
  await db.delete(multiFileBundleTemplates).where(eq(multiFileBundleTemplates.id, template.id));
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.projectId, input.projectId)).limit(1);
  if (workspace) await recordWorkspaceAudit(workspace.id, {
    actor: "Multi-file Template",
    action: "tool_rejected",
    path: template.entryPath,
    detail: `حُذف قالب حزمة TypeScript «${template.name}» بطلب صريح من المالك؛ لم تُحذف ملفات Workspace أو طلبات التنفيذ.`,
  });
  await recordExecutionEvent(userId, input.projectId, {
    actor: "Multi-file Template",
    type: "MULTI_FILE_TEMPLATE_DELETED",
    label: "حُذف قالب حزمة TypeScript",
    detail: `${template.name} · لم تتأثر ملفات Workspace`,
  });
  return { id: template.id, deleted: true as const };
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

export async function createTaskForProject(userId: number, input: { projectId: number; workPlanId?: number; title: string; description?: string; stage?: string; priority?: "low" | "medium" | "high" | "critical"; assignedAgentId?: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  if (input.workPlanId) {
    const [plan] = await db.select({ id: workPlans.id }).from(workPlans).where(and(eq(workPlans.id, input.workPlanId), eq(workPlans.projectId, input.projectId))).limit(1);
    if (!plan) throw new Error("Work plan not found for this project");
  }
  const [result] = await db.insert(tasks).values({
    projectId: input.projectId,
    workPlanId: input.workPlanId ?? null,
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

export async function getProjectBriefForOwner(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [brief] = await db.select().from(projectBriefs).where(eq(projectBriefs.projectId, projectId)).limit(1);
  return brief ?? null;
}

export async function saveProjectBriefForOwner(userId: number, input: { projectId: number; goal: string; scope: string; constraints: string; assumptions: string; openQuestions: string; risks: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  await db.insert(projectBriefs).values({
    projectId: input.projectId,
    goal: input.goal,
    scope: input.scope,
    constraints: input.constraints,
    assumptions: input.assumptions,
    openQuestions: input.openQuestions,
    risks: input.risks,
  }).onDuplicateKeyUpdate({ set: { goal: input.goal, scope: input.scope, constraints: input.constraints, assumptions: input.assumptions, openQuestions: input.openQuestions, risks: input.risks } });
  const brief = await getProjectBriefForOwner(userId, input.projectId);
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "PROJECT_BRIEF_SAVED", label: "تم حفظ موجز المشروع", detail: "تم تحديث الهدف والنطاق والقيود." });
  return brief;
}

export async function listWorkPlansForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(workPlans).where(eq(workPlans.projectId, projectId)).orderBy(desc(workPlans.updatedAt));
}

export async function createWorkPlanForProject(userId: number, input: { projectId: number; title: string; summary: string; status?: "draft" | "review" | "approved" }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [result] = await db.insert(workPlans).values({ projectId: input.projectId, title: input.title, summary: input.summary, status: input.status ?? "draft" });
  const [plan] = await db.select().from(workPlans).where(eq(workPlans.id, Number(result.insertId))).limit(1);
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "WORK_PLAN_CREATED", label: "تم إنشاء خطة عمل", detail: plan.title });
  return plan;
}

export async function setWorkPlanStatusForProject(userId: number, input: { projectId: number; workPlanId: number; status: "draft" | "review" | "approved" | "superseded" }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [plan] = await db.select().from(workPlans).where(and(eq(workPlans.id, input.workPlanId), eq(workPlans.projectId, input.projectId))).limit(1);
  if (!plan) throw new Error("Work plan not found");
  await db.update(workPlans).set({ status: input.status }).where(eq(workPlans.id, plan.id));
  const [updated] = await db.select().from(workPlans).where(eq(workPlans.id, plan.id)).limit(1);
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "WORK_PLAN_STATUS_CHANGED", label: "تغيرت حالة خطة العمل", detail: `${plan.title} → ${input.status}` });
  if (input.status === "approved") {
    await createPlannerTaskProposalsForApprovedPlan(userId, input.projectId, updated.id);
  }
  return updated;
}

async function createPlannerTaskProposalsForApprovedPlan(userId: number, projectId: number, workPlanId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [execution] = await db.select().from(agentExecutions).where(and(
    eq(agentExecutions.projectId, projectId),
    eq(agentExecutions.workPlanId, workPlanId),
    eq(agentExecutions.role, "planner"),
    inArray(agentExecutions.status, ["awaiting_review", "completed"]),
  )).orderBy(desc(agentExecutions.createdAt)).limit(1);
  if (!execution) return [];
  const existing = await db.select({ id: plannerTaskProposals.id }).from(plannerTaskProposals).where(eq(plannerTaskProposals.workPlanId, workPlanId)).limit(1);
  if (existing.length) return listPlannerTaskProposalsForProject(userId, projectId, workPlanId);
  const [plan] = await db.select().from(workPlans).where(and(eq(workPlans.id, workPlanId), eq(workPlans.projectId, projectId), eq(workPlans.status, "approved"))).limit(1);
  if (!plan) return [];
  const drafts = buildPlannerTaskProposals({ planTitle: plan.title, planSummary: plan.summary });
  await db.insert(plannerTaskProposals).values(drafts.map((draft, index) => ({
    projectId,
    workPlanId,
    executionId: execution.id,
    position: index + 1,
    title: draft.title,
    description: draft.description,
    stage: draft.stage,
    priority: draft.priority,
    acceptanceCriteriaJson: JSON.stringify(draft.acceptanceCriteria),
    status: "draft" as const,
  })));
  await db.update(agentExecutions).set({ status: "completed" }).where(eq(agentExecutions.id, execution.id));
  await recordExecutionEvent(userId, projectId, {
    taskId: execution.taskId ?? undefined,
    actor: "Planner Task Interpreter",
    type: "PLANNER_TASK_PROPOSALS_CREATED",
    label: "حُولت خطة Planner المعتمدة إلى مهام مقترحة",
    detail: `${drafts.length} مهام قابلة للتحرير؛ لا توجد مهام فعلية قبل تطبيق المالك الصريح.`,
  });
  broadcastRuntimeUpdate(userId, "request");
  return listPlannerTaskProposalsForProject(userId, projectId, workPlanId);
}

export async function listPlannerTaskProposalsForProject(userId: number, projectId: number, workPlanId?: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const rows = await db.select().from(plannerTaskProposals).where(workPlanId
    ? and(eq(plannerTaskProposals.projectId, projectId), eq(plannerTaskProposals.workPlanId, workPlanId))
    : eq(plannerTaskProposals.projectId, projectId),
  ).orderBy(plannerTaskProposals.workPlanId, plannerTaskProposals.position);
  return rows.map((row) => ({ ...row, acceptanceCriteria: parsePlannerProposalCriteria(row.acceptanceCriteriaJson) }));
}

export async function updatePlannerTaskProposalForProject(userId: number, input: { projectId: number; proposalId: number; title?: string; description?: string; stage?: string; priority?: "low" | "medium" | "high" | "critical"; acceptanceCriteria?: string[]; status?: "draft" | "discarded" }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [proposal] = await db.select().from(plannerTaskProposals).where(and(eq(plannerTaskProposals.id, input.proposalId), eq(plannerTaskProposals.projectId, input.projectId))).limit(1);
  if (!proposal) throw new Error("Planner task proposal not found");
  if (proposal.status === "applied") throw new Error("Applied planner task proposals cannot be edited");
  const values: Record<string, unknown> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.stage !== undefined) values.stage = input.stage;
  if (input.priority !== undefined) values.priority = input.priority;
  if (input.acceptanceCriteria !== undefined) values.acceptanceCriteriaJson = JSON.stringify(input.acceptanceCriteria);
  if (input.status !== undefined) values.status = input.status;
  if (!Object.keys(values).length) throw new Error("Planner task proposal update is empty");
  await db.update(plannerTaskProposals).set(values).where(eq(plannerTaskProposals.id, proposal.id));
  const [updated] = await db.select().from(plannerTaskProposals).where(eq(plannerTaskProposals.id, proposal.id)).limit(1);
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "PLANNER_TASK_PROPOSAL_UPDATED", label: "تم تحديث مهمة Planner مقترحة", detail: updated.title });
  return { ...updated, acceptanceCriteria: parsePlannerProposalCriteria(updated.acceptanceCriteriaJson) };
}

export async function applyPlannerTaskProposalsForProject(userId: number, input: { projectId: number; workPlanId: number; proposalIds: number[]; confirm: true }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [plan] = await db.select().from(workPlans).where(and(eq(workPlans.id, input.workPlanId), eq(workPlans.projectId, input.projectId), eq(workPlans.status, "approved"))).limit(1);
  if (!plan) throw new Error("Only an approved work plan can create project tasks");
  const distinctIds = [...new Set(input.proposalIds)];
  const proposals = await db.select().from(plannerTaskProposals).where(and(
    eq(plannerTaskProposals.projectId, input.projectId),
    eq(plannerTaskProposals.workPlanId, input.workPlanId),
    inArray(plannerTaskProposals.id, distinctIds),
  )).orderBy(plannerTaskProposals.position);
  if (proposals.length !== distinctIds.length || proposals.some((proposal) => proposal.status !== "draft")) throw new Error("Only selected draft proposals from this approved plan can be applied");

  const createdTasks = [];
  for (const proposal of proposals) {
    const task = await createTaskForProject(userId, {
      projectId: input.projectId,
      workPlanId: input.workPlanId,
      title: proposal.title,
      description: proposal.description,
      stage: proposal.stage,
      priority: proposal.priority,
    });
    for (const criterion of parsePlannerProposalCriteria(proposal.acceptanceCriteriaJson)) {
      await createTaskAcceptanceCriterionForProject(userId, { projectId: input.projectId, taskId: task.id, criterion });
    }
    await db.update(plannerTaskProposals).set({ status: "applied", taskId: task.id }).where(eq(plannerTaskProposals.id, proposal.id));
    createdTasks.push(task);
  }
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "PLANNER_TASK_PROPOSALS_APPLIED", label: "تم إنشاء مهام من مقترحات Planner", detail: `${createdTasks.length} مهام أُنشئت بعد تأكيد صريح من المالك.` });
  broadcastRuntimeUpdate(userId, "request");
  return createdTasks;
}

export async function listTaskAcceptanceCriteriaForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const projectTasks = await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(eq(tasks.projectId, projectId));
  if (!projectTasks.length) return [];
  const rows = await db.select().from(taskAcceptanceCriteria).where(inArray(taskAcceptanceCriteria.taskId, projectTasks.map((task) => task.id)));
  const titles = new Map(projectTasks.map((task) => [task.id, task.title]));
  return rows.map((row) => ({ ...row, taskTitle: titles.get(row.taskId) ?? "مهمة غير معروفة" }));
}

export async function createTaskAcceptanceCriterionForProject(userId: number, input: { projectId: number; taskId: number; criterion: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId))).limit(1);
  if (!task) throw new Error("Task not found");
  const [result] = await db.insert(taskAcceptanceCriteria).values({ taskId: task.id, criterion: input.criterion });
  const [criterion] = await db.select().from(taskAcceptanceCriteria).where(eq(taskAcceptanceCriteria.id, Number(result.insertId))).limit(1);
  await recordExecutionEvent(userId, input.projectId, { taskId: task.id, actor: "مالك المشروع", type: "DONE_CRITERION_CREATED", label: "تمت إضافة معيار إتمام", detail: `${task.title}: ${input.criterion}` });
  return criterion;
}

export async function verifyTaskAcceptanceCriterionForProject(userId: number, input: { projectId: number; criterionId: number; status: "verified" | "waived"; evidenceNote?: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [criterion] = await db.select().from(taskAcceptanceCriteria).where(eq(taskAcceptanceCriteria.id, input.criterionId)).limit(1);
  if (!criterion) throw new Error("Acceptance criterion not found");
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, criterion.taskId), eq(tasks.projectId, input.projectId))).limit(1);
  if (!task) throw new Error("Acceptance criterion is outside this project");
  await db.update(taskAcceptanceCriteria).set({ status: input.status, evidenceNote: input.evidenceNote ?? null, verifiedAt: new Date() }).where(eq(taskAcceptanceCriteria.id, criterion.id));
  const [updated] = await db.select().from(taskAcceptanceCriteria).where(eq(taskAcceptanceCriteria.id, criterion.id)).limit(1);
  await recordExecutionEvent(userId, input.projectId, { taskId: task.id, actor: "مالك المشروع", type: "DONE_CRITERION_RESOLVED", label: input.status === "verified" ? "تم التحقق من معيار إتمام" : "تم تجاوز معيار إتمام", detail: `${task.title}: ${criterion.criterion}` });
  return updated;
}

export async function listTaskDependenciesForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const projectTasks = await db.select({ id: tasks.id, title: tasks.title, status: tasks.status }).from(tasks).where(eq(tasks.projectId, projectId));
  if (!projectTasks.length) return { dependencies: [], criticalPathTaskIds: [] as number[] };
  const taskIds = projectTasks.map((task) => task.id);
  const rows = await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds));
  const labels = new Map(projectTasks.map((task) => [task.id, task.title]));
  return {
    dependencies: rows.map((row) => ({ ...row, taskTitle: labels.get(row.taskId) ?? "مهمة", dependsOnTaskTitle: labels.get(row.dependsOnTaskId) ?? "مهمة" })),
    criticalPathTaskIds: getCriticalPathTaskIds(projectTasks, rows),
  };
}

export async function addTaskDependencyForProject(userId: number, input: { projectId: number; taskId: number; dependsOnTaskId: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const projectTasks = await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(eq(tasks.projectId, input.projectId));
  const taskIds = new Set(projectTasks.map((task) => task.id));
  if (!taskIds.has(input.taskId) || !taskIds.has(input.dependsOnTaskId)) throw new Error("Dependency tasks must belong to this project");
  const existing = await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, [...taskIds]));
  if (wouldCreateDependencyCycle(input.taskId, input.dependsOnTaskId, existing)) throw new Error("Dependency would create a cycle");
  await db.insert(taskDependencies).values({ taskId: input.taskId, dependsOnTaskId: input.dependsOnTaskId }).onDuplicateKeyUpdate({ set: { taskId: input.taskId } });
  const labels = new Map(projectTasks.map((task) => [task.id, task.title]));
  await recordExecutionEvent(userId, input.projectId, { taskId: input.taskId, actor: "مالك المشروع", type: "TASK_DEPENDENCY_ADDED", label: "تمت إضافة اعتماد مهمة", detail: `${labels.get(input.taskId)} يعتمد على ${labels.get(input.dependsOnTaskId)}.` });
  return listTaskDependenciesForProject(userId, input.projectId);
}

export async function listArtifactsForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(artifacts).where(eq(artifacts.projectId, projectId)).orderBy(desc(artifacts.createdAt));
}

export async function registerArtifactForProject(userId: number, input: { projectId: number; taskId?: number; name: string; kind: string; reference: string; summary?: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  if (input.taskId) {
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId))).limit(1);
    if (!task) throw new Error("Task not found for artifact");
  }
  const [result] = await db.insert(artifacts).values({ projectId: input.projectId, taskId: input.taskId ?? null, name: input.name, kind: input.kind, storageKey: input.reference, summary: input.summary ?? null });
  const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, Number(result.insertId))).limit(1);
  await recordExecutionEvent(userId, input.projectId, { taskId: input.taskId, actor: "مالك المشروع", type: "ARTIFACT_REGISTERED", label: "تم تسجيل دليل", detail: `${input.kind}: ${input.name}` });
  return artifact;
}

export async function listContextPackagesForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(contextPackages).where(eq(contextPackages.projectId, projectId)).orderBy(desc(contextPackages.createdAt));
}

export async function createContextPackageForProject(userId: number, input: { projectId: number; taskId?: number; title: string; includeBrief: boolean; workPlanId?: number; taskIds: number[]; artifactIds: number[]; includeRecentEvents?: boolean }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  if (input.taskId) {
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId))).limit(1);
    if (!task) throw new Error("Context task not found");
  }
  const sourceRefs: ContextSourceRef[] = [];
  if (input.includeBrief) {
    const brief = await getProjectBriefForOwner(userId, input.projectId);
    if (brief) sourceRefs.push({ kind: "brief", id: brief.id, label: "موجز المشروع" });
  }
  if (input.workPlanId) {
    const [plan] = await db.select().from(workPlans).where(and(eq(workPlans.id, input.workPlanId), eq(workPlans.projectId, input.projectId))).limit(1);
    if (!plan) throw new Error("Work plan not found for context");
    sourceRefs.push({ kind: "plan", id: plan.id, label: plan.title });
  }
  if (input.taskIds.length) {
    const selectedTasks = await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(and(eq(tasks.projectId, input.projectId), inArray(tasks.id, input.taskIds)));
    sourceRefs.push(...selectedTasks.map((task) => ({ kind: "task" as const, id: task.id, label: task.title })));
  }
  if (input.artifactIds.length) {
    const selectedArtifacts = await db.select({ id: artifacts.id, name: artifacts.name }).from(artifacts).where(and(eq(artifacts.projectId, input.projectId), inArray(artifacts.id, input.artifactIds)));
    sourceRefs.push(...selectedArtifacts.map((artifact) => ({ kind: "artifact" as const, id: artifact.id, label: artifact.name })));
  }
  if (input.includeRecentEvents) {
    const events = await db.select({ id: executionEvents.id, label: executionEvents.label }).from(executionEvents).where(eq(executionEvents.projectId, input.projectId)).orderBy(desc(executionEvents.createdAt)).limit(5);
    sourceRefs.push(...events.map((event) => ({ kind: "event" as const, id: event.id, label: event.label })));
  }
  const normalizedSources = normalizeContextSourceRefs(sourceRefs);
  if (!normalizedSources.length) throw new Error("Context package requires at least one owned source");
  const [result] = await db.insert(contextPackages).values({ projectId: input.projectId, taskId: input.taskId ?? null, title: input.title, sourceRefs: JSON.stringify(normalizedSources), redactionSummary: "تحتوي الحزمة على مراجع وملخصات مقتطعة فقط؛ لا تتضمن محتوى Workspace الخام أو أسرار البيئة.", tokenEstimate: estimateContextTokens(normalizedSources) });
  const [contextPackage] = await db.select().from(contextPackages).where(eq(contextPackages.id, Number(result.insertId))).limit(1);
  await recordExecutionEvent(userId, input.projectId, { taskId: input.taskId, actor: "مالك المشروع", type: "CONTEXT_PACKAGE_CREATED", label: "تم إنشاء حزمة سياق", detail: `${normalizedSources.length} مراجع منقحة.` });
  return contextPackage;
}

export async function listProjectReportsForOwner(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(projectReports).where(eq(projectReports.projectId, projectId)).orderBy(desc(projectReports.createdAt));
}

export async function createProjectReportForOwner(userId: number, input: { projectId: number; kind: "delivery" | "blocked"; finalize?: boolean }) {
  const { db, project } = await requireOwnedProject(userId, input.projectId);
  const projectTasks = await db.select({ title: tasks.title, status: tasks.status }).from(tasks).where(eq(tasks.projectId, input.projectId));
  const projectArtifacts = await db.select({ name: artifacts.name }).from(artifacts).where(eq(artifacts.projectId, input.projectId));
  const pendingApprovals = await db.select({ id: approvals.id }).from(approvals).where(and(eq(approvals.projectId, input.projectId), eq(approvals.status, "pending")));
  const draft = buildProjectReportDraft({
    projectName: project.name,
    projectStatus: project.status,
    completedTaskTitles: projectTasks.filter((task) => task.status === "completed").map((task) => task.title),
    blockedTaskTitles: projectTasks.filter((task) => ["failed", "cancelled", "debugging"].includes(task.status)).map((task) => task.title),
    artifactNames: projectArtifacts.map((artifact) => artifact.name),
    pendingApprovals: pendingApprovals.length,
    kind: input.kind,
  });
  const [result] = await db.insert(projectReports).values({ projectId: input.projectId, kind: input.kind, status: input.finalize ? "final" : "draft", ...draft, finalizedAt: input.finalize ? new Date() : null });
  const [report] = await db.select().from(projectReports).where(eq(projectReports.id, Number(result.insertId))).limit(1);
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "PROJECT_REPORT_CREATED", label: input.kind === "delivery" ? "تم إنشاء تقرير تسليم" : "تم إنشاء تقرير إيقاف", detail: input.finalize ? "التقرير معلّم كنهائي." : "تم حفظ مسودة التقرير." });
  return report;
}

export async function getProjectGovernanceForOwner(userId: number, projectId: number) {
  const [brief, workPlans, criteria, dependencyGraph, artifacts, contextPackages, reports, timeline] = await Promise.all([
    getProjectBriefForOwner(userId, projectId),
    listWorkPlansForProject(userId, projectId),
    listTaskAcceptanceCriteriaForProject(userId, projectId),
    listTaskDependenciesForProject(userId, projectId),
    listArtifactsForProject(userId, projectId),
    listContextPackagesForProject(userId, projectId),
    listProjectReportsForOwner(userId, projectId),
    listProjectEvents(userId, projectId, 50),
  ]);
  return { brief, workPlans, criteria, dependencyGraph, artifacts, contextPackages, reports, timeline };
}

export async function listAgentModelRunsForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(agentModelRuns).where(eq(agentModelRuns.projectId, projectId)).orderBy(desc(agentModelRuns.createdAt)).limit(limit);
}

export async function listAgentExecutionsForProject(userId: number, projectId: number, limit = 50) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(agentExecutions).where(eq(agentExecutions.projectId, projectId)).orderBy(desc(agentExecutions.createdAt)).limit(limit);
}

export async function createPlannerAgentExecutionForProject(userId: number, input: { projectId: number; taskId?: number; contextPackageId: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  await getAgentModelRunContextForProject(userId, input);
  const requestKey = `planner:${input.contextPackageId}:${input.taskId ?? 0}`;
  const [existing] = await db.select().from(agentExecutions).where(and(
    eq(agentExecutions.projectId, input.projectId),
    eq(agentExecutions.requestKey, requestKey),
    inArray(agentExecutions.status, ["queued", "running", "awaiting_review"]),
  )).orderBy(desc(agentExecutions.createdAt)).limit(1);
  if (existing) return { execution: existing, reused: true as const };

  const [result] = await db.insert(agentExecutions).values({
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    contextPackageId: input.contextPackageId,
    role: "planner",
    status: "queued",
    requestKey,
  });
  const [execution] = await db.select().from(agentExecutions).where(eq(agentExecutions.id, Number(result.insertId))).limit(1);
  await recordExecutionEvent(userId, input.projectId, {
    taskId: input.taskId,
    actor: "Planner Execution",
    type: "PLANNER_EXECUTION_QUEUED",
    label: "وُضع تنفيذ Planner للمراجعة",
    detail: "سيحوّل المخرج المنظم إلى اقتراح خطة ودليل فقط؛ لن ينشئ مهاماً أو يطبق تغييرات.",
  });
  broadcastRuntimeUpdate(userId, "request");
  return { execution, reused: false as const };
}

export async function markPlannerAgentExecutionRunningForProject(userId: number, input: { projectId: number; executionId: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [execution] = await db.select().from(agentExecutions).where(and(eq(agentExecutions.id, input.executionId), eq(agentExecutions.projectId, input.projectId))).limit(1);
  if (!execution) throw new Error("Planner execution not found");
  if (execution.status !== "queued") throw new Error("Planner execution is not available to start");
  await db.update(agentExecutions).set({ status: "running", startedAt: new Date() }).where(eq(agentExecutions.id, execution.id));
  return (await db.select().from(agentExecutions).where(eq(agentExecutions.id, execution.id)).limit(1))[0];
}

export async function interpretPlannerAgentExecutionForProject(userId: number, input: { projectId: number; executionId: number; modelRunId: number; interpretation: PlannerInterpretation }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [execution] = await db.select().from(agentExecutions).where(and(eq(agentExecutions.id, input.executionId), eq(agentExecutions.projectId, input.projectId))).limit(1);
  if (!execution || execution.role !== "planner" || execution.status !== "running") throw new Error("Planner execution cannot be interpreted");
  const [modelRun] = await db.select().from(agentModelRuns).where(and(eq(agentModelRuns.id, input.modelRunId), eq(agentModelRuns.projectId, input.projectId), eq(agentModelRuns.role, "planner"), eq(agentModelRuns.contextPackageId, execution.contextPackageId))).limit(1);
  if (!modelRun || modelRun.status !== "completed") throw new Error("Planner model output is not available for interpretation");

  const [planResult] = await db.insert(workPlans).values({
    projectId: input.projectId,
    title: input.interpretation.workPlan.title,
    summary: input.interpretation.workPlan.summary,
    status: "review",
  });
  const planId = Number(planResult.insertId);
  const [artifactResult] = await db.insert(artifacts).values({
    projectId: input.projectId,
    taskId: execution.taskId,
    name: input.interpretation.artifact.name,
    kind: input.interpretation.artifact.kind,
    storageKey: `agent-execution:${execution.id}:planner-output`,
    summary: input.interpretation.artifact.summary,
  });
  const artifactId = Number(artifactResult.insertId);
  await db.update(agentExecutions).set({
    status: "awaiting_review",
    modelRunId: modelRun.id,
    workPlanId: planId,
    artifactId,
    outputSummary: input.interpretation.reviewNotice,
    completedAt: new Date(),
  }).where(eq(agentExecutions.id, execution.id));
  await recordExecutionEvent(userId, input.projectId, {
    taskId: execution.taskId ?? undefined,
    actor: "Planner Output Interpreter",
    type: "PLANNER_PROPOSAL_READY",
    label: "اقتراح Planner جاهز للمراجعة",
    detail: input.interpretation.reviewNotice,
  });
  broadcastRuntimeUpdate(userId, "request");
  return (await db.select().from(agentExecutions).where(eq(agentExecutions.id, execution.id)).limit(1))[0];
}

export async function failPlannerAgentExecutionForProject(userId: number, input: { projectId: number; executionId: number; errorSummary: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [execution] = await db.select().from(agentExecutions).where(and(eq(agentExecutions.id, input.executionId), eq(agentExecutions.projectId, input.projectId))).limit(1);
  if (!execution || !["queued", "running"].includes(execution.status)) throw new Error("Planner execution cannot be failed");
  const summary = input.errorSummary.slice(0, 1_000);
  await db.update(agentExecutions).set({ status: "failed", errorSummary: summary, completedAt: new Date() }).where(eq(agentExecutions.id, execution.id));
  await recordExecutionEvent(userId, input.projectId, { taskId: execution.taskId ?? undefined, actor: "Planner Execution", type: "PLANNER_EXECUTION_FAILED", label: "فشل تنفيذ Planner", detail: summary });
  broadcastRuntimeUpdate(userId, "request");
  return (await db.select().from(agentExecutions).where(eq(agentExecutions.id, execution.id)).limit(1))[0];
}

export async function getAgentModelRunContextForProject(userId: number, input: { projectId: number; contextPackageId: number; taskId?: number }) {
  const { db, project } = await requireOwnedProject(userId, input.projectId);
  const [contextPackage] = await db.select().from(contextPackages).where(and(eq(contextPackages.id, input.contextPackageId), eq(contextPackages.projectId, input.projectId))).limit(1);
  if (!contextPackage) throw new Error("Context package not found for project");
  if (input.taskId && contextPackage.taskId && contextPackage.taskId !== input.taskId) throw new Error("Context package belongs to a different task");
  const task = input.taskId ? (await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId))).limit(1))[0] : undefined;
  if (input.taskId && !task) throw new Error("Task not found for model run");
  const [brief] = await db.select().from(projectBriefs).where(eq(projectBriefs.projectId, input.projectId)).limit(1);
  return { project, task, contextPackage, brief };
}

export async function reserveAgentModelRunForProject(userId: number, input: { projectId: number; taskId?: number; contextPackageId: number; role: AgentModelRole; model: string; reservationAmount: number; inputSummary: string }) {
  const { db, project } = await requireOwnedProject(userId, input.projectId);
  const now = new Date();
  await db.update(modelCostReservations).set({ status: "expired" }).where(and(eq(modelCostReservations.projectId, input.projectId), eq(modelCostReservations.status, "reserved"), lt(modelCostReservations.expiresAt, now)));
  const context = await getAgentModelRunContextForProject(userId, { projectId: input.projectId, contextPackageId: input.contextPackageId, taskId: input.taskId });
  if (input.role === "debugger") {
    if (!input.taskId) throw new Error("Debugger requires a task");
    const [attempts] = await db.select({ count: sql<number>`count(*)` }).from(agentModelRuns).where(and(eq(agentModelRuns.projectId, input.projectId), eq(agentModelRuns.taskId, input.taskId), eq(agentModelRuns.role, "debugger"), inArray(agentModelRuns.status, ["reserved", "running", "completed", "failed"])));
    if (Number(attempts?.count ?? 0) >= modelRolePolicies.debugger.maxAttempts) throw new Error("Debugger attempt limit reached; owner intervention is required");
  }
  const [spentSummary, reservedSummary] = await Promise.all([
    db.select({ amount: sql<string>`coalesce(sum(${costEntries.amount}), 0)` }).from(costEntries).where(eq(costEntries.projectId, input.projectId)),
    db.select({ amount: sql<string>`coalesce(sum(${modelCostReservations.reservedAmount}), 0)` }).from(modelCostReservations).where(and(eq(modelCostReservations.projectId, input.projectId), eq(modelCostReservations.status, "reserved"))),
  ]);
  const committed = Number(spentSummary[0]?.amount ?? 0) + Number(reservedSummary[0]?.amount ?? 0);
  const budget = Number(project.budgetLimit);
  if (committed + input.reservationAmount > budget) throw new Error("Model reservation exceeds the project budget");
  const [reservationResult] = await db.insert(modelCostReservations).values({ projectId: input.projectId, taskId: input.taskId ?? null, role: input.role, model: input.model, reservedAmount: String(input.reservationAmount), expiresAt: new Date(now.getTime() + 10 * 60 * 1000) });
  const reservationId = Number(reservationResult.insertId);
  const [agent] = await db.select({ id: agents.id }).from(agents).where(and(eq(agents.projectId, input.projectId), eq(agents.key, input.role))).limit(1);
  const [runResult] = await db.insert(agentModelRuns).values({ projectId: input.projectId, taskId: input.taskId ?? null, contextPackageId: context.contextPackage.id, agentId: agent?.id ?? null, reservationId, role: input.role, model: input.model, inputSummary: input.inputSummary, status: "reserved" });
  const runId = Number(runResult.insertId);
  await recordExecutionEvent(userId, input.projectId, { taskId: input.taskId, actor: `Model Gateway · ${input.role}`, type: "MODEL_COST_RESERVED", label: "تم حجز تكلفة نموذج", detail: `${input.model}: $${input.reservationAmount.toFixed(4)} قبل الإرسال.` });
  return { reservation: (await db.select().from(modelCostReservations).where(eq(modelCostReservations.id, reservationId)).limit(1))[0], run: (await db.select().from(agentModelRuns).where(eq(agentModelRuns.id, runId)).limit(1))[0], context };
}

export async function markAgentModelRunRunning(userId: number, input: { projectId: number; runId: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [run] = await db.select().from(agentModelRuns).where(and(eq(agentModelRuns.id, input.runId), eq(agentModelRuns.projectId, input.projectId))).limit(1);
  if (!run || run.status !== "reserved") throw new Error("Model run is not available to start");
  await db.update(agentModelRuns).set({ status: "running", startedAt: new Date() }).where(eq(agentModelRuns.id, run.id));
  return (await db.select().from(agentModelRuns).where(eq(agentModelRuns.id, run.id)).limit(1))[0];
}

export async function settleAgentModelRunForProject(userId: number, input: { projectId: number; runId: number; outputJson: string; outputSummary: string; inputTokens: number; outputTokens: number; durationMs: number }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [run] = await db.select().from(agentModelRuns).where(and(eq(agentModelRuns.id, input.runId), eq(agentModelRuns.projectId, input.projectId))).limit(1);
  if (!run || !["reserved", "running"].includes(run.status)) throw new Error("Model run cannot be settled");
  const [reservation] = await db.select().from(modelCostReservations).where(eq(modelCostReservations.id, run.reservationId)).limit(1);
  if (!reservation || reservation.status !== "reserved") throw new Error("Model reservation is not active");
  const amount = Number(reservation.reservedAmount);
  await db.update(agentModelRuns).set({ status: "completed", outputJson: input.outputJson, outputSummary: input.outputSummary, completedAt: new Date() }).where(eq(agentModelRuns.id, run.id));
  await db.update(modelCostReservations).set({ status: "settled", settledAt: new Date() }).where(eq(modelCostReservations.id, reservation.id));
  await db.insert(costEntries).values({ projectId: input.projectId, taskId: run.taskId, agentId: run.agentId, model: run.model, inputTokens: input.inputTokens, outputTokens: input.outputTokens, durationMs: input.durationMs, amount: String(amount) });
  await db.insert(modelUsage).values({ projectId: input.projectId, taskId: run.taskId, model: run.model, inputTokens: input.inputTokens, outputTokens: input.outputTokens, durationMs: input.durationMs, amount: String(amount) });
  await recordExecutionEvent(userId, input.projectId, { taskId: run.taskId ?? undefined, actor: `Model Gateway · ${run.role}`, type: "MODEL_RUN_COMPLETED", label: "اكتمل تشغيل نموذج", detail: `${run.model}: سُوّي الحجز $${amount.toFixed(4)}.` });
  return (await db.select().from(agentModelRuns).where(eq(agentModelRuns.id, run.id)).limit(1))[0];
}

export async function failAgentModelRunForProject(userId: number, input: { projectId: number; runId: number; errorSummary: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [run] = await db.select().from(agentModelRuns).where(and(eq(agentModelRuns.id, input.runId), eq(agentModelRuns.projectId, input.projectId))).limit(1);
  if (!run || !["reserved", "running"].includes(run.status)) throw new Error("Model run cannot be released");
  await db.update(agentModelRuns).set({ status: "failed", errorSummary: input.errorSummary.slice(0, 2000), completedAt: new Date() }).where(eq(agentModelRuns.id, run.id));
  await db.update(modelCostReservations).set({ status: "released" }).where(and(eq(modelCostReservations.id, run.reservationId), eq(modelCostReservations.status, "reserved")));
  await recordExecutionEvent(userId, input.projectId, { taskId: run.taskId ?? undefined, actor: `Model Gateway · ${run.role}`, type: "MODEL_RUN_FAILED", label: "فشل تشغيل نموذج", detail: "حُرر الحجز قبل تسويته؛ راجع السجل المختصر." });
  return (await db.select().from(agentModelRuns).where(eq(agentModelRuns.id, run.id)).limit(1))[0];
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

export async function listProjectIntakeForOwner(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [imports, buildRequests, repositoryLink] = await Promise.all([
    db.select().from(projectImports).where(eq(projectImports.projectId, projectId)).orderBy(desc(projectImports.createdAt)).limit(30),
    db.select().from(projectBuildRequests).where(eq(projectBuildRequests.projectId, projectId)).orderBy(desc(projectBuildRequests.createdAt)).limit(30),
    db.select().from(projectRepositoryLinks).where(eq(projectRepositoryLinks.projectId, projectId)).limit(1),
  ]);
  return { imports, buildRequests, repositoryLink: repositoryLink[0] ?? null, policy: { execution: "blocked", clone: "blocked", push: "blocked", merge: "blocked" } };
}

export async function importProjectZipForOwner(userId: number, input: { projectId: number; fileName: string; byteSize: number; bytes: Uint8Array }) {
  const validated = validateZipArchive(input);
  const { db } = await requireOwnedProject(userId, input.projectId);
  const stored = await storagePut(`project-imports/${userId}/${input.projectId}/${validated.safeName}`, input.bytes, "application/zip");
  const summary = `أرشيف ZIP محفوظ للمراجعة فقط (${Math.ceil(validated.byteSize / 1024)}KB). لم يُفك ولم يُنفذ.`;
  const [result] = await db.insert(projectImports).values({ projectId: input.projectId, ownerId: userId, source: "zip", status: "received", displayName: validated.safeName, storageKey: stored.key, byteSize: validated.byteSize, summary });
  await db.insert(artifacts).values({ projectId: input.projectId, name: validated.safeName, kind: "project_archive", storageKey: stored.key, summary });
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "PROJECT_ARCHIVE_RECEIVED", label: "تم حفظ أرشيف مشروع", detail: summary });
  return (await db.select().from(projectImports).where(eq(projectImports.id, Number(result.insertId))).limit(1))[0];
}

export async function registerProjectRepositoryForOwner(userId: number, input: { projectId: number; remoteUrl: string; repositoryName?: string; defaultBranch: string }) {
  const repository = validateRepositoryReference(input);
  const { db } = await requireOwnedProject(userId, input.projectId);
  await db.insert(projectRepositoryLinks).values({ projectId: input.projectId, remoteUrl: repository.remoteUrl, repositoryName: repository.repositoryName, defaultBranch: repository.defaultBranch, status: "unlinked" }).onDuplicateKeyUpdate({ set: { remoteUrl: repository.remoteUrl, repositoryName: repository.repositoryName, defaultBranch: repository.defaultBranch, status: "unlinked" } });
  const summary = `مرجع ${repository.provider} مسجل للمراجعة فقط؛ لم يُستنسخ المستودع ولم تُستخدم بيانات اعتماد.`;
  const [result] = await db.insert(projectImports).values({ projectId: input.projectId, ownerId: userId, source: "repository", status: "registered", displayName: repository.repositoryName, remoteUrl: repository.remoteUrl, provider: repository.provider, summary });
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "REPOSITORY_REFERENCE_REGISTERED", label: "تم تسجيل مرجع مستودع", detail: summary });
  return (await db.select().from(projectImports).where(eq(projectImports.id, Number(result.insertId))).limit(1))[0];
}

export async function createProjectBuildRequestForOwner(userId: number, input: { projectId: number; importId?: number; target: string; title: string; summary: string }) {
  const build = validateBuildRequest(input);
  const { db } = await requireOwnedProject(userId, input.projectId);
  if (input.importId) {
    const [source] = await db.select({ id: projectImports.id }).from(projectImports).where(and(eq(projectImports.id, input.importId), eq(projectImports.projectId, input.projectId))).limit(1);
    if (!source) throw new Error("مصدر المشروع غير موجود ضمن هذا المشروع.");
  }
  const [approvalResult] = await db.insert(approvals).values({ projectId: input.projectId, requestedBy: "منصة استيراد المشروع", title: `اعتماد طلب بناء: ${build.title}`, detail: `طلب تخطيط لبناء هدف ${build.target}. لا ينفذ هذا الإصدار أي بناء أو رفع؛ الاعتماد يسجل قراراً فقط. ${build.summary}`, impact: "يتطلب بيئة بناء محلية مقيدة بعد إثبات Runner.", level: "approval" });
  const approvalId = Number(approvalResult.insertId);
  const [result] = await db.insert(projectBuildRequests).values({ projectId: input.projectId, importId: input.importId ?? null, requestedByUserId: userId, target: build.target, status: "awaiting_approval", title: build.title, summary: build.summary, approvalId });
  await recordExecutionEvent(userId, input.projectId, { actor: "مالك المشروع", type: "BUILD_REQUEST_PLANNED", label: "تم تخطيط طلب بناء", detail: `الهدف ${build.target} بانتظار اعتماد صريح؛ لا يوجد تنفيذ أو رفع.` });
  return (await db.select().from(projectBuildRequests).where(eq(projectBuildRequests.id, Number(result.insertId))).limit(1))[0];
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
  broadcastRuntimeUpdate(userId, "approval");
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
  const [runtimeRequest] = await db.select().from(isolatedRuntimeRequests).where(and(
    eq(isolatedRuntimeRequests.projectId, input.projectId),
    eq(isolatedRuntimeRequests.approvalId, input.approvalId),
  )).limit(1);
  let runtimeTransition: { status: "queued" | "blocked"; requestId: number } | null = null;
  if (runtimeRequest && runtimeRequest.status === "awaiting_approval") {
    const status = input.decision === "approved" ? "queued" : "blocked" as const;
    await db.update(isolatedRuntimeRequests).set({
      status,
      reason: input.decision === "approved" ? "اعتمد المالك التنفيذ؛ أصبح الطلب متاحاً إلى Runner المحلي المحدد." : "رفض المالك تنفيذ الشيفرة؛ بقي الطلب محجوباً.",
    }).where(eq(isolatedRuntimeRequests.id, runtimeRequest.id));
    await recordWorkspaceAudit(runtimeRequest.workspaceId, { actor: "Isolated Runtime Gate", action: input.decision === "approved" ? "gate_requested" : "tool_rejected", path: runtimeRequest.targetPath, detail: input.decision === "approved" ? "اعتمد المالك التنفيذ؛ ينتظر Runner المحلي." : "رفض المالك التنفيذ؛ لم تشغّل الشيفرة." });
    await recordExecutionEvent(userId, input.projectId, { actor: "Isolated Runtime Gate", type: input.decision === "approved" ? "ISOLATED_RUNTIME_QUEUED" : "ISOLATED_RUNTIME_REJECTED", label: input.decision === "approved" ? "وضع التنفيذ المعزول في الطابور" : "رُفض التنفيذ المعزول", detail: runtimeRequest.targetPath });
    runtimeTransition = { status, requestId: runtimeRequest.id };
  }
  const [engineStep] = await db.select().from(taskEngineSteps).where(eq(taskEngineSteps.approvalId, input.approvalId)).limit(1);
  const engineTransition = engineStep ? await advanceTaskEngineRunForProject(userId, { projectId: input.projectId, runId: engineStep.runId }) : null;
  broadcastRuntimeUpdate(userId, runtimeTransition ? "request" : "approval");
  return { approval: (await db.select().from(approvals).where(eq(approvals.id, input.approvalId)).limit(1))[0], engineTransition, sensitiveChangeTransition, runtimeTransition };
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

async function requireOwnedResearchCampaign(userId: number, projectId: number, campaignId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  const [campaign] = await db.select().from(researchCampaigns).where(and(eq(researchCampaigns.id, campaignId), eq(researchCampaigns.projectId, projectId))).limit(1);
  if (!campaign) throw new Error("Research campaign not found for this project");
  return { db, campaign };
}

export async function listResearchCampaignsForProject(userId: number, projectId: number) {
  const { db } = await requireOwnedProject(userId, projectId);
  return db.select().from(researchCampaigns).where(eq(researchCampaigns.projectId, projectId)).orderBy(desc(researchCampaigns.updatedAt));
}

export async function createResearchCampaignForProject(userId: number, input: { projectId: number; title: string; command: string; maxSources: number; maxQuestions: number; maxRounds: number; decisionLevel: "auto" | "review" | "approval"; questions: { question: string; category: string; priority: number }[] }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  if (!input.questions.length || input.questions.length > input.maxQuestions) throw new Error("Research questions must fit within the campaign budget");
  const [result] = await db.insert(researchCampaigns).values({
    projectId: input.projectId,
    title: input.title,
    command: input.command,
    status: "researching",
    maxSources: input.maxSources,
    maxQuestions: input.maxQuestions,
    maxRounds: input.maxRounds,
    decisionLevel: input.decisionLevel,
  });
  const campaignId = Number(result.insertId);
  await db.insert(researchQuestions).values(input.questions.map((question) => ({ campaignId, question: question.question, category: question.category, priority: question.priority, status: "pending" as const })));
  await recordExecutionEvent(userId, input.projectId, { actor: "Research Orchestrator", type: "RESEARCH_CAMPAIGN_CREATED", label: "أنشئت حملة بحث مقيدة", detail: `${input.questions.length} أسئلة؛ حد المصادر ${input.maxSources}، ولا توجد موصلات تنفيذ أو بحث خارجي تلقائي.` });
  return getResearchCampaignDetailForProject(userId, input.projectId, campaignId);
}

function assertSafeEvidenceUrl(url?: string) {
  if (!url) return;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Evidence URL must be a valid absolute HTTPS URL"); }
  if (parsed.protocol !== "https:") throw new Error("Evidence URL must use HTTPS");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) throw new Error("Evidence URL cannot target private or local network addresses");
}

export async function addEvidenceSourceForProject(userId: number, input: { projectId: number; campaignId: number; questionId?: number; sourceType: ResearchSourceType; url?: string; title: string; author?: string; publishedLabel?: string; contentHash?: string; redactedSummary: string }) {
  const { db, campaign } = await requireOwnedResearchCampaign(userId, input.projectId, input.campaignId);
  assertSafeEvidenceUrl(input.url);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(evidenceSources).where(eq(evidenceSources.campaignId, campaign.id));
  if (Number(count) >= campaign.maxSources) throw new Error("Research campaign source budget has been reached");
  if (input.questionId) {
    const [question] = await db.select({ id: researchQuestions.id }).from(researchQuestions).where(and(eq(researchQuestions.id, input.questionId), eq(researchQuestions.campaignId, campaign.id))).limit(1);
    if (!question) throw new Error("Research question not found for this campaign");
  }
  const [result] = await db.insert(evidenceSources).values({
    projectId: input.projectId,
    campaignId: campaign.id,
    questionId: input.questionId ?? null,
    sourceType: input.sourceType,
    url: input.url ?? null,
    title: input.title,
    author: input.author ?? null,
    publishedLabel: input.publishedLabel ?? null,
    contentHash: input.contentHash ?? null,
    trustTier: trustTierForSourceType(input.sourceType),
    redactedSummary: input.redactedSummary,
    instructionRiskDetected: evidenceInstructionRisk(`${input.title}\n${input.redactedSummary}`),
  });
  const sourceId = Number(result.insertId);
  await recordExecutionEvent(userId, input.projectId, { actor: "Evidence Gateway", type: "EVIDENCE_SOURCE_RECORDED", label: "سُجل مصدر بحث منقح", detail: `${input.sourceType} · ${input.title}` });
  return (await db.select().from(evidenceSources).where(eq(evidenceSources.id, sourceId)).limit(1))[0];
}

export async function addEvidenceClaimForProject(userId: number, input: { projectId: number; campaignId: number; sourceId: number; claim: string; evidenceExcerpt: string; relevance: number; conflictGroup?: string; status?: "active" | "conflicted" | "rejected" }) {
  const { db, campaign } = await requireOwnedResearchCampaign(userId, input.projectId, input.campaignId);
  const [source] = await db.select().from(evidenceSources).where(and(eq(evidenceSources.id, input.sourceId), eq(evidenceSources.campaignId, campaign.id))).limit(1);
  if (!source) throw new Error("Evidence source not found for this campaign");
  const [result] = await db.insert(evidenceClaims).values({ campaignId: campaign.id, sourceId: source.id, claim: input.claim, evidenceExcerpt: input.evidenceExcerpt, relevance: input.relevance, reliability: source.trustTier, conflictGroup: input.conflictGroup ?? null, status: input.status ?? "active" });
  const claimId = Number(result.insertId);
  return (await db.select().from(evidenceClaims).where(eq(evidenceClaims.id, claimId)).limit(1))[0];
}

export async function synthesizeResearchCampaignForProject(userId: number, input: { projectId: number; campaignId: number }) {
  const { db, campaign } = await requireOwnedResearchCampaign(userId, input.projectId, input.campaignId);
  const [claims, questions] = await Promise.all([
    db.select().from(evidenceClaims).where(eq(evidenceClaims.campaignId, campaign.id)),
    db.select().from(researchQuestions).where(and(eq(researchQuestions.campaignId, campaign.id), eq(researchQuestions.status, "pending"))),
  ]);
  const synthesis = buildResearchSynthesis({ claims, unansweredQuestions: questions.map((question) => question.question) });
  const existing = await db.select({ id: researchSyntheses.id }).from(researchSyntheses).where(eq(researchSyntheses.campaignId, campaign.id)).limit(1);
  if (existing[0]) {
    await db.update(researchSyntheses).set({ summary: synthesis.summary, consensus: synthesis.consensus, conflicts: synthesis.conflicts, unknowns: synthesis.unknowns, optionsJson: JSON.stringify(synthesis.options), status: "review" }).where(eq(researchSyntheses.id, existing[0].id));
  } else {
    await db.insert(researchSyntheses).values({ campaignId: campaign.id, summary: synthesis.summary, consensus: synthesis.consensus, conflicts: synthesis.conflicts, unknowns: synthesis.unknowns, optionsJson: JSON.stringify(synthesis.options), status: "review" });
  }
  await db.update(researchCampaigns).set({ status: "awaiting_decision" }).where(eq(researchCampaigns.id, campaign.id));
  await recordExecutionEvent(userId, input.projectId, { actor: "Knowledge Synthesizer", type: "RESEARCH_SYNTHESIS_CREATED", label: "تجميع الأدلة بانتظار القرار", detail: synthesis.summary });
  return getResearchCampaignDetailForProject(userId, input.projectId, campaign.id);
}

export async function createCouncilOpinionForProject(userId: number, input: { projectId: number; campaignId: number; role: "research" | "architecture" | "product" | "ux" | "security" | "database" | "mobile" | "devops" | "cost" | "qa"; proposal: string; evidenceClaimIds: number[]; risks: string; assumptions: string; confidence: "low" | "medium" | "high"; requestedDecision: "auto" | "review" | "approval" }) {
  const { db, campaign } = await requireOwnedResearchCampaign(userId, input.projectId, input.campaignId);
  if (input.evidenceClaimIds.length) {
    const claims = await db.select({ id: evidenceClaims.id }).from(evidenceClaims).where(and(eq(evidenceClaims.campaignId, campaign.id), inArray(evidenceClaims.id, input.evidenceClaimIds)));
    if (claims.length !== new Set(input.evidenceClaimIds).size) throw new Error("Council opinion includes a claim outside this campaign");
  }
  const existing = await db.select({ id: councilOpinions.id }).from(councilOpinions).where(and(eq(councilOpinions.campaignId, campaign.id), eq(councilOpinions.role, input.role))).limit(1);
  const values = { proposal: input.proposal, evidenceClaimIdsJson: JSON.stringify(input.evidenceClaimIds), risks: input.risks, assumptions: input.assumptions, confidence: input.confidence, requestedDecision: input.requestedDecision };
  if (existing[0]) await db.update(councilOpinions).set(values).where(eq(councilOpinions.id, existing[0].id));
  else await db.insert(councilOpinions).values({ campaignId: campaign.id, role: input.role, ...values });
  await recordExecutionEvent(userId, input.projectId, { actor: "Agent Council", type: "COUNCIL_OPINION_RECORDED", label: "سُجل رأي مجلس تشاور", detail: input.role });
  return (await db.select().from(councilOpinions).where(and(eq(councilOpinions.campaignId, campaign.id), eq(councilOpinions.role, input.role))).limit(1))[0];
}

export async function decideResearchCampaignForProject(userId: number, input: { projectId: number; campaignId: number; title: string; rationale: string }) {
  const { db, campaign } = await requireOwnedResearchCampaign(userId, input.projectId, input.campaignId);
  if (campaign.status !== "awaiting_decision") throw new Error("Research campaign must be synthesized before recording a decision");
  const code = `RESEARCH-${campaign.id}`;
  const [existing] = await db.select().from(decisions).where(and(eq(decisions.projectId, input.projectId), eq(decisions.code, code))).limit(1);
  const decision = existing ?? (await db.insert(decisions).values({ projectId: input.projectId, code, title: input.title, rationale: input.rationale, decidedBy: "مالك المشروع" }).then(async (result) => (await db.select().from(decisions).where(eq(decisions.id, Number(result[0].insertId))).limit(1))[0]));
  await db.update(researchCampaigns).set({ status: "completed" }).where(eq(researchCampaigns.id, campaign.id));
  await recordExecutionEvent(userId, input.projectId, { actor: "Decision Engine", type: "RESEARCH_DECISION_RECORDED", label: "سُجل قرار مالك لحملة البحث", detail: input.title });
  return decision;
}

export async function listEngineConnectionsForOwner(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(engineConnections).where(eq(engineConnections.ownerId, userId)).orderBy(desc(engineConnections.updatedAt));
}

export async function createEngineConnectionForOwner(userId: number, input: { key: string; name: string; kind: EngineConnectionKind; configReference?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(engineConnections).values({ ownerId: userId, key: input.key, name: input.name, kind: input.kind, status: "planning", trustTier: input.kind === "internal_planner" || input.kind === "local_runner" ? "project" : "untrusted", capabilitiesJson: JSON.stringify(defaultEngineCapabilities(input.kind)), configReference: input.configReference ?? null });
  return (await db.select().from(engineConnections).where(eq(engineConnections.id, Number(result.insertId))).limit(1))[0];
}

export async function createEnginePlanningSessionForProject(userId: number, input: { projectId: number; campaignId?: number; engineConnectionId: number; scopeSummary: string; correlationId: string }) {
  const { db } = await requireOwnedProject(userId, input.projectId);
  const [engine] = await db.select().from(engineConnections).where(and(eq(engineConnections.id, input.engineConnectionId), eq(engineConnections.ownerId, userId))).limit(1);
  if (!engine) throw new Error("Engine connection not found for this owner");
  assertEnginePlanningOnly({ kind: engine.kind, status: engine.status, executionRequested: false });
  if (input.campaignId) await requireOwnedResearchCampaign(userId, input.projectId, input.campaignId);
  const [result] = await db.insert(engineSessions).values({ projectId: input.projectId, campaignId: input.campaignId ?? null, engineConnectionId: engine.id, status: engine.kind === "internal_planner" ? "planned" : "awaiting_approval", scopeSummary: input.scopeSummary, correlationId: input.correlationId });
  await recordExecutionEvent(userId, input.projectId, { actor: "Engine Adapter Registry", type: "ENGINE_SESSION_PLANNED", label: "خُططت جلسة محرك بلا تشغيل", detail: `${engine.name} · ${engine.kind}` });
  return (await db.select().from(engineSessions).where(eq(engineSessions.id, Number(result.insertId))).limit(1))[0];
}

export async function getResearchCampaignDetailForProject(userId: number, projectId: number, campaignId: number) {
  const { db, campaign } = await requireOwnedResearchCampaign(userId, projectId, campaignId);
  const [questions, sources, claims, syntheses, opinions, sessions] = await Promise.all([
    db.select().from(researchQuestions).where(eq(researchQuestions.campaignId, campaign.id)).orderBy(researchQuestions.priority),
    db.select().from(evidenceSources).where(eq(evidenceSources.campaignId, campaign.id)).orderBy(desc(evidenceSources.fetchedAt)),
    db.select().from(evidenceClaims).where(eq(evidenceClaims.campaignId, campaign.id)).orderBy(desc(evidenceClaims.relevance)),
    db.select().from(researchSyntheses).where(eq(researchSyntheses.campaignId, campaign.id)).limit(1),
    db.select().from(councilOpinions).where(eq(councilOpinions.campaignId, campaign.id)).orderBy(councilOpinions.role),
    db.select().from(engineSessions).where(and(eq(engineSessions.projectId, projectId), eq(engineSessions.campaignId, campaign.id))).orderBy(desc(engineSessions.createdAt)),
  ]);
  const [decision] = await db.select().from(decisions).where(and(eq(decisions.projectId, projectId), eq(decisions.code, `RESEARCH-${campaign.id}`))).limit(1);
  return { campaign, questions, sources, claims, synthesis: syntheses[0] ?? null, opinions, sessions, decision: decision ?? null };
}

export type AuthenticatedUser = Pick<User, "id" | "name">;
