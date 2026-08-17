import { describe, expect, it } from "vitest";
import { statusTone, type AgentStatus, type ProjectStatus, type TaskStatus } from "../lib/agent-hub";

describe("statusTone", () => {
  it("يعطي لون النجاح للحالات المكتملة والنشطة", () => {
    expect(statusTone("مكتمل" as TaskStatus)).toBe("success");
    expect(statusTone("نشط" as AgentStatus)).toBe("success");
  });

  it("يعطي لون التنفيذ للحالات قيد البناء", () => {
    expect(statusTone("قيد التنفيذ" as TaskStatus)).toBe("primary");
    expect(statusTone("قيد البناء" as ProjectStatus)).toBe("primary");
  });

  it("يبقي الحالات غير المنجزة بنبرة مناسبة", () => {
    expect(statusTone("مراجعة" as TaskStatus)).toBe("warning");
    expect(statusTone("محجوب" as TaskStatus)).toBe("error");
    expect(statusTone("قادم" as TaskStatus)).toBe("muted");
  });
});
