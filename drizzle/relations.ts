import { relations } from "drizzle-orm";
import { agents, agentRuns, approvals, artifacts, costEntries, decisions, executionEvents, memoryItems, modelUsage, projects, taskDependencies, tasks, users } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  resolvedApprovals: many(approvals),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  agents: many(agents),
  tasks: many(tasks),
  runs: many(agentRuns),
  events: many(executionEvents),
  artifacts: many(artifacts),
  decisions: many(decisions),
  memory: many(memoryItems),
  approvals: many(approvals),
  costs: many(costEntries),
  modelUsage: many(modelUsage),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignedAgent: one(agents, { fields: [tasks.assignedAgentId], references: [agents.id] }),
  runs: many(agentRuns),
  events: many(executionEvents),
  dependencies: many(taskDependencies, { relationName: "task_dependencies" }),
  requiredBy: many(taskDependencies, { relationName: "task_dependents" }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, { fields: [taskDependencies.taskId], references: [tasks.id], relationName: "task_dependencies" }),
  dependsOn: one(tasks, { fields: [taskDependencies.dependsOnTaskId], references: [tasks.id], relationName: "task_dependents" }),
}));
