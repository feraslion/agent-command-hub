import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { getDryWorkerLoopStatus } from "./dry-worker";
import { composeAgentSystemPrompt, promptTemplateKeyValues, promptTemplateLibrary, promptTemplateLocaleValues } from "./prompt-library";
import { runGovernedAgentRole } from "./agent-model-service";
import { runPlannerAgentExecution } from "./agent-execution-service";
import { agentModelRoles } from "../lib/agent-model-policy";

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
      workPlanId: z.number().int().positive().optional(),
    })).mutation(({ ctx, input }) => db.createTaskForProject(ctx.user.id, input)),
    setStatus: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), taskId: z.number().int().positive(), status: taskStatus })).mutation(({ ctx, input }) => db.updateTaskStatus(ctx.user.id, input)),
  }),
  governance: router({
    get: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.getProjectGovernanceForOwner(ctx.user.id, input.projectId)),
    brief: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.getProjectBriefForOwner(ctx.user.id, input.projectId)),
    saveBrief: protectedProcedure.input(projectIdInput.extend({
      goal: z.string().trim().min(2).max(4000),
      scope: z.string().trim().max(4000),
      constraints: z.string().trim().max(4000),
      assumptions: z.string().trim().max(4000),
      openQuestions: z.string().trim().max(4000),
      risks: z.string().trim().max(4000),
    })).mutation(({ ctx, input }) => db.saveProjectBriefForOwner(ctx.user.id, input)),
    plans: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listWorkPlansForProject(ctx.user.id, input.projectId)),
    createPlan: protectedProcedure.input(projectIdInput.extend({
      title: z.string().trim().min(2).max(255),
      summary: z.string().trim().min(2).max(8000),
      status: z.enum(["draft", "review", "approved"]).optional(),
    })).mutation(({ ctx, input }) => db.createWorkPlanForProject(ctx.user.id, input)),
    setPlanStatus: protectedProcedure.input(projectIdInput.extend({ workPlanId: z.number().int().positive(), status: z.enum(["draft", "review", "approved", "superseded"]) })).mutation(({ ctx, input }) => db.setWorkPlanStatusForProject(ctx.user.id, input)),
    criteria: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listTaskAcceptanceCriteriaForProject(ctx.user.id, input.projectId)),
    createCriterion: protectedProcedure.input(projectIdInput.extend({ taskId: z.number().int().positive(), criterion: z.string().trim().min(2).max(4000) })).mutation(({ ctx, input }) => db.createTaskAcceptanceCriterionForProject(ctx.user.id, input)),
    resolveCriterion: protectedProcedure.input(projectIdInput.extend({ criterionId: z.number().int().positive(), status: z.enum(["verified", "waived"]), evidenceNote: z.string().trim().max(4000).optional() })).mutation(({ ctx, input }) => db.verifyTaskAcceptanceCriterionForProject(ctx.user.id, input)),
    dependencies: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listTaskDependenciesForProject(ctx.user.id, input.projectId)),
    addDependency: protectedProcedure.input(projectIdInput.extend({ taskId: z.number().int().positive(), dependsOnTaskId: z.number().int().positive() })).mutation(({ ctx, input }) => db.addTaskDependencyForProject(ctx.user.id, input)),
    artifacts: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listArtifactsForProject(ctx.user.id, input.projectId)),
    registerArtifact: protectedProcedure.input(projectIdInput.extend({
      taskId: z.number().int().positive().optional(),
      name: z.string().trim().min(2).max(255),
      kind: z.string().trim().min(2).max(64),
      reference: z.string().trim().min(1).max(512),
      summary: z.string().trim().max(4000).optional(),
    })).mutation(({ ctx, input }) => db.registerArtifactForProject(ctx.user.id, input)),
    contextPackages: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listContextPackagesForProject(ctx.user.id, input.projectId)),
    createContextPackage: protectedProcedure.input(projectIdInput.extend({
      taskId: z.number().int().positive().optional(),
      title: z.string().trim().min(2).max(255),
      includeBrief: z.boolean(),
      workPlanId: z.number().int().positive().optional(),
      taskIds: z.array(z.number().int().positive()).max(12),
      artifactIds: z.array(z.number().int().positive()).max(12),
      includeRecentEvents: z.boolean().optional(),
    })).mutation(({ ctx, input }) => db.createContextPackageForProject(ctx.user.id, input)),
    reports: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listProjectReportsForOwner(ctx.user.id, input.projectId)),
    createReport: protectedProcedure.input(projectIdInput.extend({ kind: z.enum(["delivery", "blocked"]), finalize: z.boolean().optional() })).mutation(({ ctx, input }) => db.createProjectReportForOwner(ctx.user.id, input)),
  }),
  agentModel: router({
    listRuns: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listAgentModelRunsForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    run: protectedProcedure.input(projectIdInput.extend({
      taskId: z.number().int().positive().optional(),
      contextPackageId: z.number().int().positive(),
      role: z.enum(agentModelRoles),
    })).mutation(({ ctx, input }) => runGovernedAgentRole(ctx.user.id, input)),
  }),
  agentExecution: router({
    list: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listAgentExecutionsForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    runPlanner: protectedProcedure.input(projectIdInput.extend({
      taskId: z.number().int().positive().optional(),
      contextPackageId: z.number().int().positive(),
    })).mutation(({ ctx, input }) => runPlannerAgentExecution(ctx.user.id, input)),
  }),
  plannerTasks: router({
    list: protectedProcedure.input(projectIdInput.extend({ workPlanId: z.number().int().positive().optional() })).query(({ ctx, input }) => db.listPlannerTaskProposalsForProject(ctx.user.id, input.projectId, input.workPlanId)),
    update: protectedProcedure.input(projectIdInput.extend({
      proposalId: z.number().int().positive(),
      title: z.string().trim().min(2).max(255).optional(),
      description: z.string().trim().min(2).max(4_000).optional(),
      stage: z.string().trim().min(2).max(128).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      acceptanceCriteria: z.array(z.string().trim().min(2).max(1_000)).min(1).max(12).optional(),
      status: z.enum(["draft", "discarded"]).optional(),
    })).mutation(({ ctx, input }) => db.updatePlannerTaskProposalForProject(ctx.user.id, input)),
    createTasks: protectedProcedure.input(projectIdInput.extend({
      workPlanId: z.number().int().positive(),
      proposalIds: z.array(z.number().int().positive()).min(1).max(12),
      confirm: z.literal(true),
    })).mutation(({ ctx, input }) => db.applyPlannerTaskProposalsForProject(ctx.user.id, input)),
  }),
  researchFabric: router({
    listCampaigns: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listResearchCampaignsForProject(ctx.user.id, input.projectId)),
    getCampaign: protectedProcedure.input(projectIdInput.extend({ campaignId: z.number().int().positive() })).query(({ ctx, input }) => db.getResearchCampaignDetailForProject(ctx.user.id, input.projectId, input.campaignId)),
    createCampaign: protectedProcedure.input(projectIdInput.extend({
      title: z.string().trim().min(2).max(255),
      command: z.string().trim().min(8).max(4_000),
      maxSources: z.number().int().min(1).max(12).default(6),
      maxQuestions: z.number().int().min(1).max(8).default(6),
      maxRounds: z.number().int().min(1).max(3).default(2),
      decisionLevel: z.enum(["auto", "review", "approval"]).default("review"),
      questions: z.array(z.object({ question: z.string().trim().min(4).max(1_000), category: z.string().trim().min(2).max(64), priority: z.number().int().min(1).max(3).default(2) })).min(1).max(8),
    })).mutation(({ ctx, input }) => db.createResearchCampaignForProject(ctx.user.id, input)),
    addSource: protectedProcedure.input(projectIdInput.extend({
      campaignId: z.number().int().positive(),
      questionId: z.number().int().positive().optional(),
      sourceType: z.enum(["official_docs", "github_metadata", "web", "repository_scan", "project_memory"]),
      url: z.string().trim().url().max(2_048).optional(),
      title: z.string().trim().min(2).max(512),
      author: z.string().trim().max(255).optional(),
      publishedLabel: z.string().trim().max(128).optional(),
      contentHash: z.string().trim().max(128).optional(),
      redactedSummary: z.string().trim().min(4).max(8_000),
    })).mutation(({ ctx, input }) => db.addEvidenceSourceForProject(ctx.user.id, input)),
    addClaim: protectedProcedure.input(projectIdInput.extend({
      campaignId: z.number().int().positive(), sourceId: z.number().int().positive(), claim: z.string().trim().min(4).max(2_000), evidenceExcerpt: z.string().trim().min(4).max(4_000), relevance: z.number().int().min(0).max(100).default(50), conflictGroup: z.string().trim().min(2).max(128).optional(), status: z.enum(["active", "conflicted", "rejected"]).optional(),
    })).mutation(({ ctx, input }) => db.addEvidenceClaimForProject(ctx.user.id, input)),
    synthesize: protectedProcedure.input(projectIdInput.extend({ campaignId: z.number().int().positive() })).mutation(({ ctx, input }) => db.synthesizeResearchCampaignForProject(ctx.user.id, input)),
    addOpinion: protectedProcedure.input(projectIdInput.extend({
      campaignId: z.number().int().positive(), role: z.enum(["research", "architecture", "product", "ux", "security", "database", "mobile", "devops", "cost", "qa"]), proposal: z.string().trim().min(4).max(4_000), evidenceClaimIds: z.array(z.number().int().positive()).max(12), risks: z.string().trim().min(2).max(2_000), assumptions: z.string().trim().min(2).max(2_000), confidence: z.enum(["low", "medium", "high"]), requestedDecision: z.enum(["auto", "review", "approval"]),
    })).mutation(({ ctx, input }) => db.createCouncilOpinionForProject(ctx.user.id, input)),
    decide: protectedProcedure.input(projectIdInput.extend({ campaignId: z.number().int().positive(), title: z.string().trim().min(2).max(255), rationale: z.string().trim().min(4).max(4_000) })).mutation(({ ctx, input }) => db.decideResearchCampaignForProject(ctx.user.id, input)),
    listEngines: protectedProcedure.query(({ ctx }) => db.listEngineConnectionsForOwner(ctx.user.id)),
    createEngine: protectedProcedure.input(z.object({ key: z.string().trim().min(2).max(64).regex(/^[a-z0-9_-]+$/), name: z.string().trim().min(2).max(128), kind: z.enum(["internal_planner", "local_runner", "github_pr", "openhands", "mcp"]), configReference: z.string().trim().max(255).optional() })).mutation(({ ctx, input }) => db.createEngineConnectionForOwner(ctx.user.id, input)),
    planEngineSession: protectedProcedure.input(projectIdInput.extend({ campaignId: z.number().int().positive().optional(), engineConnectionId: z.number().int().positive(), scopeSummary: z.string().trim().min(4).max(4_000), correlationId: z.string().trim().min(6).max(128).regex(/^[a-zA-Z0-9_-]+$/) })).mutation(({ ctx, input }) => db.createEnginePlanningSessionForProject(ctx.user.id, input)),
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
  agentPrompts: router({
    library: protectedProcedure.query(() => promptTemplateLibrary),
    list: protectedProcedure.query(({ ctx }) => db.listAgentPromptAssignmentsForOwner(ctx.user.id)),
    preview: protectedProcedure.input(z.object({
      templateKey: z.enum(promptTemplateKeyValues),
      templateLocale: z.enum(promptTemplateLocaleValues),
      customInstructions: z.string().trim().max(4000),
    })).query(({ input }) => ({ finalPrompt: composeAgentSystemPrompt(input) })),
    save: protectedProcedure.input(z.object({
      agentKey: z.string().trim().min(2).max(64).regex(/^[a-z0-9_-]+$/),
      templateKey: z.enum(promptTemplateKeyValues),
      templateLocale: z.enum(promptTemplateLocaleValues).default("ar"),
      customInstructions: z.string().trim().max(4000),
    })).mutation(({ ctx, input }) => db.upsertAgentPromptAssignmentForOwner(ctx.user.id, input)),
  }),
  worker: router({
    getStatus: protectedProcedure.query(async ({ ctx }) => ({ worker: await db.getWorkerSettingsForOwner(ctx.user.id), loop: getDryWorkerLoopStatus() })),
    setDesiredState: protectedProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ ctx, input }) => db.setWorkerDesiredState(ctx.user.id, input.enabled)),
  }),
  localRunners: router({
    list: protectedProcedure.query(({ ctx }) => db.listLocalRunnersForOwner(ctx.user.id)),
    createPairing: protectedProcedure.input(z.object({ label: z.string().trim().min(2).max(128) })).mutation(({ ctx, input }) => db.createLocalRunnerPairingForOwner(ctx.user.id, input.label)),
    revoke: protectedProcedure.input(z.object({ runnerId: z.number().int().positive() })).mutation(({ ctx, input }) => db.revokeLocalRunnerForOwner(ctx.user.id, input.runnerId)),
  }),
  repositoryScans: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => db.listRepositoryScansForOwner(ctx.user.id, input?.projectId)),
  }),
  projectIntake: router({
    overview: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listProjectIntakeForOwner(ctx.user.id, input.projectId)),
    importZip: protectedProcedure.input(projectIdInput.extend({
      fileName: z.string().trim().min(5).max(255),
      byteSize: z.number().int().positive().max(8 * 1024 * 1024),
      base64: z.string().min(4).max(12_000_000),
    })).mutation(({ ctx, input }) => db.importProjectZipForOwner(ctx.user.id, { ...input, bytes: Buffer.from(input.base64, "base64") })),
    registerRepository: protectedProcedure.input(projectIdInput.extend({
      remoteUrl: z.string().trim().url().max(512),
      repositoryName: z.string().trim().max(255).optional(),
      defaultBranch: z.string().trim().min(1).max(128).default("main"),
    })).mutation(({ ctx, input }) => db.registerProjectRepositoryForOwner(ctx.user.id, input)),
    verifyRepository: protectedProcedure.input(projectIdInput.extend({
      remoteUrl: z.string().trim().url().max(512),
      defaultBranch: z.string().trim().min(1).max(128).default("main"),
      confirm: z.literal(true),
    })).mutation(({ ctx, input }) => db.verifyProjectRepositoryForOwner(ctx.user.id, input)),
    requestBuild: protectedProcedure.input(projectIdInput.extend({
      importId: z.number().int().positive().optional(),
      target: z.enum(["web", "android", "ios", "node", "docker", "custom"]),
      title: z.string().trim().min(3).max(255),
      summary: z.string().trim().min(8).max(4_000),
    })).mutation(({ ctx, input }) => db.createProjectBuildRequestForOwner(ctx.user.id, input)),
  }),
  gitGate: router({
    boundary: protectedProcedure.query(() => ({ allowed: ["inspect", "request_pull_request"], blocked: ["push", "merge", "force_push", "delete_branch", "change_protection"] })),
    requestPullRequest: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      headBranch: z.string().trim().min(1).max(128),
      baseBranch: z.string().trim().min(1).max(128),
      title: z.string().trim().min(2).max(255),
      summary: z.string().trim().max(4000),
    })).mutation(({ ctx, input }) => db.requestPullRequestForOwner(ctx.user.id, input)),
  }),
  operationalHealth: router({
    get: protectedProcedure.query(({ ctx }) => db.getOwnerOperationalHealth(ctx.user.id)),
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
    status: protectedProcedure.query(({ ctx }) => db.getIsolatedRuntimeStatusForOwner(ctx.user.id)),
    listForOwner: protectedProcedure.query(({ ctx }) => db.listOwnerIsolatedRuntimeRequests(ctx.user.id)),
    listRequests: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => db.listIsolatedRuntimeRequestsForProject(ctx.user.id, input.projectId, input.limit ?? 50)),
    listMultiFileTemplates: protectedProcedure.input(projectIdInput).query(({ ctx, input }) => db.listMultiFileBundleTemplatesForProject(ctx.user.id, input.projectId)),
    saveMultiFileTemplate: protectedProcedure.input(projectIdInput.extend({
      name: z.string().trim().min(2).max(80),
      entryPath: z.string().trim().min(1).max(512),
      paths: z.array(z.string().trim().min(1).max(512)).min(2).max(24),
    })).mutation(({ ctx, input }) => db.saveMultiFileBundleTemplateForProject(ctx.user.id, input)),
    renameMultiFileTemplate: protectedProcedure.input(projectIdInput.extend({
      templateId: z.number().int().positive(),
      name: z.string().trim().min(2).max(80),
    })).mutation(({ ctx, input }) => db.renameMultiFileBundleTemplateForProject(ctx.user.id, input)),
    deleteMultiFileTemplate: protectedProcedure.input(projectIdInput.extend({
      templateId: z.number().int().positive(),
    })).mutation(({ ctx, input }) => db.deleteMultiFileBundleTemplateForProject(ctx.user.id, input)),
    requestExecution: protectedProcedure.input(projectIdInput.extend({ targetPath: z.string().trim().min(1).max(512), engineRunId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => db.requestIsolatedRuntimeExecution(ctx.user.id, input)),
    requestMultiFileExecution: protectedProcedure.input(projectIdInput.extend({ entryPath: z.string().trim().min(1).max(512), paths: z.array(z.string().trim().min(1).max(512)).min(2).max(24), engineRunId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => db.requestMultiFileRuntimeExecution(ctx.user.id, input)),
  }),
  events: router({
    list: protectedProcedure.input(projectIdInput.extend({ limit: z.number().int().min(1).max(200).optional() })).query(({ ctx, input }) => db.listProjectEvents(ctx.user.id, input.projectId, input.limit ?? 50)),
  }),
});

export type AppRouter = typeof appRouter;
