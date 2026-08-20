import { describe, expect, it } from "vitest";

import { getProjectPipeline, getProjectStatusPresentation, getProjectTaskSnapshot, getTaskStatusPresentation, isActiveTaskStatus } from "../lib/live-project-presentation";

describe("live project presentation", () => {
  it("translates durable task and project states into Arabic UI states", () => {
    expect(getTaskStatusPresentation("running")).toEqual({ label: "قيد التنفيذ", tone: "primary" });
    expect(getTaskStatusPresentation("failed")).toEqual({ label: "فشل", tone: "error" });
    expect(getProjectStatusPresentation("active")).toEqual({ label: "قيد التنفيذ", tone: "primary" });
    expect(getProjectStatusPresentation("planning")).toEqual({ label: "قيد التخطيط", tone: "muted" });
  });

  it("derives project progress from the live task collection", () => {
    expect(getProjectTaskSnapshot([
      { status: "completed", stage: "requirements" },
      { status: "running", stage: "build" },
      { status: "pending", stage: "review" },
    ])).toEqual({ total: 3, completed: 1, progress: 33, activeStage: "build" });
    expect(isActiveTaskStatus("retrying")).toBe(true);
    expect(isActiveTaskStatus("completed")).toBe(false);
  });

  it("groups the visible pipeline by actual task stages", () => {
    expect(getProjectPipeline([
      { stage: "build", status: "running" },
      { stage: "requirements", status: "completed" },
      { stage: "build", status: "queued" },
      { stage: "review", status: "pending" },
    ])).toEqual([
      { stage: "requirements", label: "المتطلبات", status: "مكتمل", active: false, completed: true },
      { stage: "build", label: "البناء", status: "نشط", active: true, completed: false },
      { stage: "review", label: "المراجعة", status: "قادم", active: false, completed: false },
    ]);
  });
});
