import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projectStatusValues = ["planning", "active", "paused", "completed", "archived"] as const;
export const taskStatusValues = ["pending", "queued", "running", "verifying", "completed", "failed", "debugging", "retrying", "cancelled"] as const;
export const agentStatusValues = ["idle", "running", "disabled", "error"] as const;
export const approvalLevelValues = ["auto", "review", "approval"] as const;
export const approvalStatusValues = ["pending", "approved", "rejected", "auto_resolved"] as const;
export const executionCommandTypeValues = ["run_project", "run_task", "resume_task"] as const;
export const executionCommandStatusValues = ["queued", "claimed", "completed", "failed", "cancelled"] as const;
export const executionPlanStatusValues = ["ready", "blocked", "superseded"] as const;
export const workerRuntimeStatusValues = ["disabled", "awaiting_service", "ready", "offline"] as const;
export const workspaceStatusValues = ["active", "archived"] as const;
export const workspaceAuditActionValues = ["workspace_created", "file_read", "file_written", "path_rejected", "tool_rejected", "sandbox_checked", "gate_requested"] as const;
export const taskEngineRunStatusValues = ["queued", "running", "awaiting_review", "awaiting_approval", "verifying", "completed", "failed", "blocked"] as const;
export const taskEngineStepStatusValues = ["pending", "running", "awaiting_review", "awaiting_approval", "completed", "failed", "skipped"] as const;
export const sandboxCheckKindValues = ["workspace_policy", "logical_test", "git_gate", "publish_gate", "delete_gate"] as const;
export const sandboxCheckStatusValues = ["passed", "blocked", "awaiting_approval", "rejected"] as const;
export const isolatedRuntimeRequestStatusValues = ["environment_required", "awaiting_approval", "queued", "claimed", "blocked", "approved", "submitted", "completed", "failed", "cancelled"] as const;
export const localRunnerStatusValues = ["pairing", "ready", "busy", "offline", "revoked"] as const;
export const sensitiveWorkspaceChangeStatusValues = ["pending_secondary", "applied", "rejected", "conflicted"] as const;
export const promptTemplateKeyValues = ["planner", "coder", "qa", "debugger"] as const;
export const promptTemplateLocaleValues = ["ar", "en"] as const;

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 32 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", projectStatusValues).default("planning").notNull(),
  progress: int("progress").default(0).notNull(),
  currentStage: varchar("current_stage", { length: 128 }).default("requirements").notNull(),
  budgetLimit: decimal("budget_limit", { precision: 12, scale: 2 }).default("2.50").notNull(),
  budgetWarningThreshold: int("budget_warning_threshold").default(75).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("projects_owner_code_unique").on(table.ownerId, table.code),
  index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt),
]);

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 128 }).notNull(),
  capabilities: text("capabilities"),
  permissions: text("permissions"),
  status: mysqlEnum("status", agentStatusValues).default("idle").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("agents_project_key_unique").on(table.projectId, table.key),
  index("agents_project_status_idx").on(table.projectId, table.status),
]);

export const agentPromptAssignments = mysqlTable("agent_prompt_assignments", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentKey: varchar("agent_key", { length: 64 }).notNull(),
  templateKey: mysqlEnum("template_key", promptTemplateKeyValues).notNull(),
  templateLocale: mysqlEnum("template_locale", promptTemplateLocaleValues).default("ar").notNull(),
  customInstructions: text("custom_instructions").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("agent_prompt_assignments_owner_agent_unique").on(table.ownerId, table.agentKey),
  index("agent_prompt_assignments_owner_updated_idx").on(table.ownerId, table.updatedAt),
]);

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: int("parent_id"),
  assignedAgentId: int("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  stage: varchar("stage", { length: 128 }).default("requirements").notNull(),
  status: mysqlEnum("status", taskStatusValues).default("pending").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  input: text("input"),
  output: text("output"),
  maxRetries: int("max_retries").default(3).notNull(),
  retryCount: int("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("tasks_project_status_idx").on(table.projectId, table.status),
  index("tasks_assigned_agent_idx").on(table.assignedAgentId),
]);

export const taskDependencies = mysqlTable("task_dependencies", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnTaskId: int("depends_on_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("task_dependencies_unique").on(table.taskId, table.dependsOnTaskId),
]);

export const agentRuns = mysqlTable("agent_runs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agentId: int("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  status: mysqlEnum("status", taskStatusValues).default("queued").notNull(),
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  errorSummary: text("error_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("agent_runs_project_created_idx").on(table.projectId, table.createdAt),
]);

export const executionEvents = mysqlTable("execution_events", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  agentRunId: int("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  actor: varchar("actor", { length: 128 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("execution_events_project_created_idx").on(table.projectId, table.createdAt),
]);

export const executionCommands = mysqlTable("execution_commands", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  requestedByUserId: int("requested_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  command: mysqlEnum("command", executionCommandTypeValues).notNull(),
  payload: text("payload"),
  status: mysqlEnum("status", executionCommandStatusValues).default("queued").notNull(),
  attemptCount: int("attempt_count").default(0).notNull(),
  maxAttempts: int("max_attempts").default(3).notNull(),
  leaseOwner: varchar("lease_owner", { length: 128 }),
  leasedAt: timestamp("leased_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("execution_commands_project_created_idx").on(table.projectId, table.createdAt),
  index("execution_commands_status_created_idx").on(table.status, table.createdAt),
]);

export const executionPlans = mysqlTable("execution_plans", {
  id: int("id").autoincrement().primaryKey(),
  commandId: int("command_id").notNull().references(() => executionCommands.id, { onDelete: "cascade" }),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  status: mysqlEnum("status", executionPlanStatusValues).default("ready").notNull(),
  summary: varchar("summary", { length: 512 }).notNull(),
  steps: text("steps").notNull(),
  constraints: text("constraints").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("execution_plans_command_unique").on(table.commandId),
  index("execution_plans_project_created_idx").on(table.projectId, table.createdAt),
]);

export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", workspaceStatusValues).default("active").notNull(),
  mode: varchar("mode", { length: 32 }).default("virtual_restricted").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("workspaces_project_unique").on(table.projectId),
]);

export const workspaceFiles = mysqlTable("workspace_files", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  path: varchar("path", { length: 512 }).notNull(),
  content: text("content").notNull(),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("workspace_files_workspace_path_unique").on(table.workspaceId, table.path),
  index("workspace_files_workspace_updated_idx").on(table.workspaceId, table.updatedAt),
]);

export const workspaceAuditLogs = mysqlTable("workspace_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actor: varchar("actor", { length: 128 }).notNull(),
  action: mysqlEnum("action", workspaceAuditActionValues).notNull(),
  path: varchar("path", { length: 512 }),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("workspace_audit_workspace_created_idx").on(table.workspaceId, table.createdAt),
]);

export const taskEngineRuns = mysqlTable("task_engine_runs", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("plan_id").notNull().references(() => executionPlans.id, { onDelete: "cascade" }),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  commandId: int("command_id").notNull().references(() => executionCommands.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", taskEngineRunStatusValues).default("queued").notNull(),
  currentStepOrder: int("current_step_order").default(0).notNull(),
  retryCount: int("retry_count").default(0).notNull(),
  maxRetries: int("max_retries").default(2).notNull(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("task_engine_runs_plan_unique").on(table.planId),
  index("task_engine_runs_project_updated_idx").on(table.projectId, table.updatedAt),
]);

export const taskEngineSteps = mysqlTable("task_engine_steps", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull().references(() => taskEngineRuns.id, { onDelete: "cascade" }),
  stepOrder: int("step_order").notNull(),
  agentKey: varchar("agent_key", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  detail: text("detail").notNull(),
  approvalLevel: mysqlEnum("approval_level", approvalLevelValues).notNull(),
  approvalId: int("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  status: mysqlEnum("status", taskEngineStepStatusValues).default("pending").notNull(),
  attemptCount: int("attempt_count").default(0).notNull(),
  maxAttempts: int("max_attempts").default(2).notNull(),
  output: text("output"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("task_engine_steps_run_order_unique").on(table.runId, table.stepOrder),
  index("task_engine_steps_run_status_idx").on(table.runId, table.status),
]);

export const sandboxChecks = mysqlTable("sandbox_checks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: int("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  engineRunId: int("engine_run_id").references(() => taskEngineRuns.id, { onDelete: "set null" }),
  approvalId: int("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  kind: mysqlEnum("kind", sandboxCheckKindValues).notNull(),
  status: mysqlEnum("status", sandboxCheckStatusValues).notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sandbox_checks_project_created_idx").on(table.projectId, table.createdAt),
]);

export const localRunners = mysqlTable("local_runners", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  runnerKey: varchar("runner_key", { length: 128 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  status: mysqlEnum("status", localRunnerStatusValues).default("pairing").notNull(),
  capabilities: text("capabilities"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("local_runners_owner_key_unique").on(table.ownerId, table.runnerKey),
  uniqueIndex("local_runners_token_hash_unique").on(table.tokenHash),
  index("local_runners_owner_updated_idx").on(table.ownerId, table.updatedAt),
]);

export const isolatedRuntimeRequests = mysqlTable("isolated_runtime_requests", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: int("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  engineRunId: int("engine_run_id").references(() => taskEngineRuns.id, { onDelete: "set null" }),
  requestedByUserId: int("requested_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  approvalId: int("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  runnerId: int("runner_id").references(() => localRunners.id, { onDelete: "set null" }),
  targetPath: varchar("target_path", { length: 512 }).notNull(),
  profile: varchar("profile", { length: 64 }).default("node_script").notNull(),
  status: mysqlEnum("status", isolatedRuntimeRequestStatusValues).default("environment_required").notNull(),
  reason: text("reason").notNull(),
  exitCode: int("exit_code"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  durationMs: int("duration_ms"),
  claimedAt: timestamp("claimed_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("isolated_runtime_requests_project_created_idx").on(table.projectId, table.createdAt),
  index("isolated_runtime_requests_workspace_created_idx").on(table.workspaceId, table.createdAt),
  index("isolated_runtime_requests_runner_status_idx").on(table.runnerId, table.status),
  index("isolated_runtime_requests_approval_idx").on(table.approvalId),
]);

export const sensitiveWorkspaceChanges = mysqlTable("sensitive_workspace_changes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: int("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  approvalId: int("approval_id").notNull().references(() => approvals.id, { onDelete: "cascade" }),
  requestedByUserId: int("requested_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  path: varchar("path", { length: 512 }).notNull(),
  baseVersion: int("base_version").notNull(),
  previousContent: text("previous_content"),
  proposedContent: text("proposed_content").notNull(),
  riskSummary: text("risk_summary").notNull(),
  status: mysqlEnum("status", sensitiveWorkspaceChangeStatusValues).default("pending_secondary").notNull(),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("sensitive_workspace_changes_approval_unique").on(table.approvalId),
  index("sensitive_workspace_changes_project_created_idx").on(table.projectId, table.createdAt),
  index("sensitive_workspace_changes_workspace_path_idx").on(table.workspaceId, table.path),
]);

export const workerSettings = mysqlTable("worker_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  desiredEnabled: int("desired_enabled").default(0).notNull(),
  runtimeStatus: mysqlEnum("runtime_status", workerRuntimeStatusValues).default("disabled").notNull(),
  serviceLabel: varchar("service_label", { length: 128 }).default("Managed worker").notNull(),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("worker_settings_owner_unique").on(table.ownerId),
]);

export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  kind: varchar("kind", { length: 64 }).notNull(),
  storageKey: varchar("storage_key", { length: 512 }).notNull(),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("artifacts_project_created_idx").on(table.projectId, table.createdAt),
]);

export const decisions = mysqlTable("decisions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  rationale: text("rationale").notNull(),
  decidedBy: varchar("decided_by", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("decisions_project_code_unique").on(table.projectId, table.code),
]);

export const memoryItems = mysqlTable("memory_items", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  scope: mysqlEnum("scope", ["project", "decision", "task", "agent"]).notNull(),
  memoryKey: varchar("memory_key", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("memory_items_project_key_unique").on(table.projectId, table.memoryKey),
]);

export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  requestedBy: varchar("requested_by", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  detail: text("detail").notNull(),
  impact: varchar("impact", { length: 255 }).notNull(),
  level: mysqlEnum("level", approvalLevelValues).default("review").notNull(),
  status: mysqlEnum("status", approvalStatusValues).default("pending").notNull(),
  resolvedByUserId: int("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("approvals_project_status_idx").on(table.projectId, table.status),
]);

export const costEntries = mysqlTable("cost_entries", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  agentId: int("agent_id").references(() => agents.id, { onDelete: "set null" }),
  model: varchar("model", { length: 128 }).notNull(),
  inputTokens: int("input_tokens").default(0).notNull(),
  outputTokens: int("output_tokens").default(0).notNull(),
  durationMs: int("duration_ms").default(0).notNull(),
  amount: decimal("amount", { precision: 12, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("cost_entries_project_created_idx").on(table.projectId, table.createdAt),
]);

export const modelUsage = mysqlTable("model_usage", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  agentRunId: int("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  model: varchar("model", { length: 128 }).notNull(),
  inputTokens: int("input_tokens").default(0).notNull(),
  outputTokens: int("output_tokens").default(0).notNull(),
  durationMs: int("duration_ms").default(0).notNull(),
  amount: decimal("amount", { precision: 12, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("model_usage_project_created_idx").on(table.projectId, table.createdAt),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type ExecutionEvent = typeof executionEvents.$inferSelect;
