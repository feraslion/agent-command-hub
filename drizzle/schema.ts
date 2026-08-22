import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
export const workPlanStatusValues = ["draft", "review", "approved", "superseded"] as const;
export const criterionStatusValues = ["pending", "verified", "waived"] as const;
export const contextPackageStatusValues = ["draft", "sealed"] as const;
export const projectReportKindValues = ["delivery", "blocked"] as const;
export const projectReportStatusValues = ["draft", "final"] as const;
export const agentModelRoleValues = ["planner", "coder", "qa", "reviewer", "debugger"] as const;
export const agentModelRunStatusValues = ["reserved", "running", "completed", "failed", "blocked", "cancelled"] as const;
export const agentExecutionStatusValues = ["queued", "running", "awaiting_review", "completed", "failed", "blocked", "cancelled"] as const;
export const plannerTaskProposalStatusValues = ["draft", "applied", "discarded"] as const;
export const modelCostReservationStatusValues = ["reserved", "settled", "released", "expired"] as const;
export const repositoryLinkStatusValues = ["unlinked", "scanned", "stale"] as const;
export const repositoryScanStatusValues = ["reported", "rejected"] as const;
export const researchCampaignStatusValues = ["draft", "researching", "synthesized", "awaiting_decision", "completed", "blocked", "cancelled"] as const;
export const researchQuestionStatusValues = ["pending", "researched", "blocked", "skipped"] as const;
export const researchSourceTypeValues = ["official_docs", "github_metadata", "web", "repository_scan", "project_memory"] as const;
export const researchTrustTierValues = ["primary", "project", "secondary", "untrusted"] as const;
export const evidenceClaimStatusValues = ["active", "conflicted", "rejected"] as const;
export const researchSynthesisStatusValues = ["draft", "review", "approved", "superseded"] as const;
export const councilOpinionRoleValues = ["research", "architecture", "product", "ux", "security", "database", "mobile", "devops", "cost", "qa"] as const;
export const engineConnectionKindValues = ["internal_planner", "local_runner", "github_pr", "openhands", "mcp"] as const;
export const engineConnectionStatusValues = ["disabled", "planning", "approved"] as const;
export const engineSessionStatusValues = ["planned", "awaiting_approval", "blocked", "cancelled", "completed"] as const;
export const projectImportSourceValues = ["zip", "repository"] as const;
export const projectImportStatusValues = ["received", "registered", "rejected"] as const;
export const projectBuildRequestStatusValues = ["draft", "awaiting_approval", "approved", "rejected", "cancelled"] as const;
export const projectBuildTargetValues = ["web", "android", "ios", "node", "docker", "custom"] as const;

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

export const projectBriefs = mysqlTable("project_briefs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  scope: text("scope").notNull(),
  constraints: text("constraints").notNull(),
  assumptions: text("assumptions").notNull(),
  openQuestions: text("open_questions").notNull(),
  risks: text("risks").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("project_briefs_project_unique").on(table.projectId),
]);

export const researchCampaigns = mysqlTable("research_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  command: text("command").notNull(),
  status: mysqlEnum("status", researchCampaignStatusValues).default("draft").notNull(),
  maxSources: int("max_sources").default(6).notNull(),
  maxQuestions: int("max_questions").default(6).notNull(),
  maxRounds: int("max_rounds").default(2).notNull(),
  decisionLevel: mysqlEnum("decision_level", approvalLevelValues).default("review").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("research_campaigns_project_status_idx").on(table.projectId, table.status),
]);

export const researchQuestions = mysqlTable("research_questions", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull().references(() => researchCampaigns.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  priority: int("priority").default(2).notNull(),
  status: mysqlEnum("status", researchQuestionStatusValues).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("research_questions_campaign_status_idx").on(table.campaignId, table.status),
]);

export const evidenceSources = mysqlTable("evidence_sources", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  campaignId: int("campaign_id").notNull().references(() => researchCampaigns.id, { onDelete: "cascade" }),
  questionId: int("question_id").references(() => researchQuestions.id, { onDelete: "set null" }),
  sourceType: mysqlEnum("source_type", researchSourceTypeValues).notNull(),
  url: varchar("url", { length: 2048 }),
  title: varchar("title", { length: 512 }).notNull(),
  author: varchar("author", { length: 255 }),
  publishedLabel: varchar("published_label", { length: 128 }),
  contentHash: varchar("content_hash", { length: 128 }),
  trustTier: mysqlEnum("trust_tier", researchTrustTierValues).default("untrusted").notNull(),
  redactedSummary: text("redacted_summary").notNull(),
  instructionRiskDetected: int("instruction_risk_detected").default(0).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (table) => [
  index("evidence_sources_campaign_trust_idx").on(table.campaignId, table.trustTier),
  index("evidence_sources_project_type_idx").on(table.projectId, table.sourceType),
]);

export const evidenceClaims = mysqlTable("evidence_claims", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull().references(() => researchCampaigns.id, { onDelete: "cascade" }),
  sourceId: int("source_id").notNull().references(() => evidenceSources.id, { onDelete: "cascade" }),
  claim: text("claim").notNull(),
  evidenceExcerpt: text("evidence_excerpt").notNull(),
  relevance: int("relevance").default(50).notNull(),
  reliability: mysqlEnum("reliability", researchTrustTierValues).default("untrusted").notNull(),
  conflictGroup: varchar("conflict_group", { length: 128 }),
  status: mysqlEnum("status", evidenceClaimStatusValues).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("evidence_claims_campaign_status_idx").on(table.campaignId, table.status),
  index("evidence_claims_source_idx").on(table.sourceId),
]);

export const researchSyntheses = mysqlTable("research_syntheses", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull().references(() => researchCampaigns.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  consensus: text("consensus").notNull(),
  conflicts: text("conflicts").notNull(),
  unknowns: text("unknowns").notNull(),
  optionsJson: text("options_json").notNull(),
  status: mysqlEnum("status", researchSynthesisStatusValues).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("research_syntheses_campaign_unique").on(table.campaignId),
]);

export const councilOpinions = mysqlTable("council_opinions", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull().references(() => researchCampaigns.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", councilOpinionRoleValues).notNull(),
  proposal: text("proposal").notNull(),
  evidenceClaimIdsJson: text("evidence_claim_ids_json").notNull(),
  risks: text("risks").notNull(),
  assumptions: text("assumptions").notNull(),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]).default("medium").notNull(),
  requestedDecision: mysqlEnum("requested_decision", approvalLevelValues).default("review").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("council_opinions_campaign_role_unique").on(table.campaignId, table.role),
]);

export const engineConnections = mysqlTable("engine_connections", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  kind: mysqlEnum("kind", engineConnectionKindValues).notNull(),
  status: mysqlEnum("status", engineConnectionStatusValues).default("disabled").notNull(),
  trustTier: mysqlEnum("trust_tier", researchTrustTierValues).default("untrusted").notNull(),
  capabilitiesJson: text("capabilities_json").notNull(),
  configReference: varchar("config_reference", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("engine_connections_owner_key_unique").on(table.ownerId, table.key),
]);

export const researchAutonomySettings = mysqlTable("research_autonomy_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  publicApisEnabled: boolean("public_apis_enabled").default(false).notNull(),
  enabledAt: timestamp("enabled_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("research_autonomy_settings_owner_unique").on(table.ownerId),
]);

export const engineSessions = mysqlTable("engine_sessions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  campaignId: int("campaign_id").references(() => researchCampaigns.id, { onDelete: "set null" }),
  engineConnectionId: int("engine_connection_id").notNull().references(() => engineConnections.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", engineSessionStatusValues).default("planned").notNull(),
  scopeSummary: text("scope_summary").notNull(),
  correlationId: varchar("correlation_id", { length: 128 }).notNull(),
  artifactReference: varchar("artifact_reference", { length: 1024 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("engine_sessions_correlation_unique").on(table.correlationId),
  index("engine_sessions_project_status_idx").on(table.projectId, table.status),
]);

export const workPlans = mysqlTable("work_plans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  status: mysqlEnum("status", workPlanStatusValues).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("work_plans_project_updated_idx").on(table.projectId, table.updatedAt),
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
  workPlanId: int("work_plan_id").references(() => workPlans.id, { onDelete: "set null" }),
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

export const taskAcceptanceCriteria = mysqlTable("task_acceptance_criteria", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  criterion: text("criterion").notNull(),
  status: mysqlEnum("status", criterionStatusValues).default("pending").notNull(),
  evidenceNote: text("evidence_note"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("task_acceptance_criteria_task_status_idx").on(table.taskId, table.status),
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

export const isolatedRuntimeBundles = mysqlTable("isolated_runtime_bundles", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("request_id").notNull().references(() => isolatedRuntimeRequests.id, { onDelete: "cascade" }),
  entryPath: varchar("entry_path", { length: 512 }).notNull(),
  filesJson: text("files_json").notNull(),
  totalBytes: int("total_bytes").notNull(),
  policyVersion: varchar("policy_version", { length: 32 }).default("v1").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("isolated_runtime_bundles_request_unique").on(table.requestId),
]);

export const multiFileBundleTemplates = mysqlTable("multi_file_bundle_templates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  entryPath: varchar("entry_path", { length: 512 }).notNull(),
  pathsJson: text("paths_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("multi_file_bundle_templates_project_name_unique").on(table.projectId, table.name),
  index("multi_file_bundle_templates_project_updated_idx").on(table.projectId, table.updatedAt),
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

export const contextPackages = mysqlTable("context_packages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  sourceRefs: text("source_refs").notNull(),
  redactionSummary: text("redaction_summary").notNull(),
  tokenEstimate: int("token_estimate").default(0).notNull(),
  status: mysqlEnum("status", contextPackageStatusValues).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("context_packages_project_created_idx").on(table.projectId, table.createdAt),
]);

export const projectReports = mysqlTable("project_reports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", projectReportKindValues).notNull(),
  status: mysqlEnum("status", projectReportStatusValues).default("draft").notNull(),
  summary: text("summary").notNull(),
  completedWork: text("completed_work").notNull(),
  evidenceSummary: text("evidence_summary").notNull(),
  riskSummary: text("risk_summary").notNull(),
  nextStep: text("next_step").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finalizedAt: timestamp("finalized_at"),
}, (table) => [
  index("project_reports_project_created_idx").on(table.projectId, table.createdAt),
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

export const modelCostReservations = mysqlTable("model_cost_reservations", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  role: mysqlEnum("role", agentModelRoleValues).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  reservedAmount: decimal("reserved_amount", { precision: 12, scale: 4 }).notNull(),
  status: mysqlEnum("status", modelCostReservationStatusValues).default("reserved").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("model_cost_reservations_project_status_idx").on(table.projectId, table.status),
  index("model_cost_reservations_expires_idx").on(table.expiresAt),
]);

export const agentModelRuns = mysqlTable("agent_model_runs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  contextPackageId: int("context_package_id").notNull().references(() => contextPackages.id, { onDelete: "restrict" }),
  agentId: int("agent_id").references(() => agents.id, { onDelete: "set null" }),
  reservationId: int("reservation_id").notNull().references(() => modelCostReservations.id, { onDelete: "restrict" }),
  role: mysqlEnum("role", agentModelRoleValues).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  status: mysqlEnum("status", agentModelRunStatusValues).default("reserved").notNull(),
  inputSummary: text("input_summary").notNull(),
  outputJson: text("output_json"),
  outputSummary: text("output_summary"),
  errorSummary: text("error_summary"),
  attemptNumber: int("attempt_number").default(1).notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("agent_model_runs_project_created_idx").on(table.projectId, table.createdAt),
  index("agent_model_runs_task_role_created_idx").on(table.taskId, table.role, table.createdAt),
  index("agent_model_runs_context_idx").on(table.contextPackageId),
]);

export const agentExecutions = mysqlTable("agent_executions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  contextPackageId: int("context_package_id").notNull().references(() => contextPackages.id, { onDelete: "restrict" }),
  modelRunId: int("model_run_id").references(() => agentModelRuns.id, { onDelete: "set null" }),
  workPlanId: int("work_plan_id").references(() => workPlans.id, { onDelete: "set null" }),
  artifactId: int("artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  role: mysqlEnum("role", agentModelRoleValues).notNull(),
  status: mysqlEnum("status", agentExecutionStatusValues).default("queued").notNull(),
  requestKey: varchar("request_key", { length: 180 }).notNull(),
  outputSummary: text("output_summary"),
  errorSummary: text("error_summary"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("agent_executions_project_created_idx").on(table.projectId, table.createdAt),
  index("agent_executions_project_request_idx").on(table.projectId, table.requestKey),
  index("agent_executions_context_status_idx").on(table.contextPackageId, table.status),
]);

export const plannerTaskProposals = mysqlTable("planner_task_proposals", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workPlanId: int("work_plan_id").notNull().references(() => workPlans.id, { onDelete: "cascade" }),
  executionId: int("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  taskId: int("task_id").references(() => tasks.id, { onDelete: "set null" }),
  position: int("position").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  stage: varchar("stage", { length: 128 }).default("planning").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  acceptanceCriteriaJson: text("acceptance_criteria_json").notNull(),
  status: mysqlEnum("status", plannerTaskProposalStatusValues).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("planner_task_proposals_plan_position_unique").on(table.workPlanId, table.position),
  index("planner_task_proposals_project_status_idx").on(table.projectId, table.status),
  index("planner_task_proposals_execution_idx").on(table.executionId),
]);

export const projectRepositoryLinks = mysqlTable("project_repository_links", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  runnerId: int("runner_id").references(() => localRunners.id, { onDelete: "set null" }),
  remoteUrl: varchar("remote_url", { length: 512 }),
  repositoryName: varchar("repository_name", { length: 255 }),
  defaultBranch: varchar("default_branch", { length: 128 }).default("main").notNull(),
  status: mysqlEnum("status", repositoryLinkStatusValues).default("unlinked").notNull(),
  lastScannedAt: timestamp("last_scanned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("project_repository_links_runner_idx").on(table.runnerId),
]);

export const repositoryScans = mysqlTable("repository_scans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runnerId: int("runner_id").notNull().references(() => localRunners.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  fileCount: int("file_count").default(0).notNull(),
  directoryCount: int("directory_count").default(0).notNull(),
  languageSummary: text("language_summary").notNull(),
  manifestSummary: text("manifest_summary").notNull(),
  testSummary: text("test_summary").notNull(),
  sensitiveSummary: text("sensitive_summary").notNull(),
  status: mysqlEnum("status", repositoryScanStatusValues).default("reported").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("repository_scans_project_created_idx").on(table.projectId, table.createdAt),
  index("repository_scans_runner_created_idx").on(table.runnerId, table.createdAt),
]);

export const projectImports = mysqlTable("project_imports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: mysqlEnum("source", projectImportSourceValues).notNull(),
  status: mysqlEnum("status", projectImportStatusValues).default("received").notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  storageKey: varchar("storage_key", { length: 512 }),
  remoteUrl: varchar("remote_url", { length: 512 }),
  provider: varchar("provider", { length: 64 }),
  byteSize: int("byte_size"),
  summary: text("summary").notNull(),
  inspectionSummary: text("inspection_summary"),
  securityScanStatus: mysqlEnum("security_scan_status", ["pending", "clean", "review_required", "blocked"]).default("pending").notNull(),
  securityScanSummary: text("security_scan_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("project_imports_project_created_idx").on(table.projectId, table.createdAt),
  index("project_imports_owner_created_idx").on(table.ownerId, table.createdAt),
]);

export const projectBuildRequests = mysqlTable("project_build_requests", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  importId: int("import_id").references(() => projectImports.id, { onDelete: "set null" }),
  requestedByUserId: int("requested_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  target: mysqlEnum("target", projectBuildTargetValues).notNull(),
  templateKey: varchar("template_key", { length: 64 }),
  status: mysqlEnum("status", projectBuildRequestStatusValues).default("awaiting_approval").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  approvalId: int("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("project_build_requests_project_created_idx").on(table.projectId, table.createdAt),
  index("project_build_requests_status_idx").on(table.status),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type ExecutionEvent = typeof executionEvents.$inferSelect;
