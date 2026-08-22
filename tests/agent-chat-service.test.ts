import { describe, expect, it, vi } from "vitest";

import { runAgentChat } from "../server/agent-chat-service";

describe("agent chat service", () => {
  it("selects the approved lightweight model and returns a redacted reply", async () => {
    const listModels = vi.fn().mockResolvedValue({ data: [{ id: "gpt-5-mini" }] });
    const invoke = vi.fn().mockResolvedValue({ choices: [{ message: { content: "أقترح خطة قصيرة؛ token=hidden" } }] });
    const result = await runAgentChat("راجع المهمة", { listModels, invoke } as never);
    expect(result.model).toBe("gpt-5-mini");
    expect(result.reply).not.toContain("hidden");
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 800, model: "gpt-5-mini" }));
  });

  it("rejects an unavailable catalog before it adds a fake reply", async () => {
    await expect(runAgentChat("مرحباً", { listModels: vi.fn().mockResolvedValue({ data: [] }), invoke: vi.fn() } as never)).rejects.toThrow("لا يتوفر نموذج");
  });

  it("passes redacted external catalog context as data, not as an execution instruction", async () => {
    const invoke = vi.fn().mockResolvedValue({ choices: [{ message: { content: "راجعت الدليل فقط." } }] });
    await runAgentChat("ابحث عن واجهة", { listModels: vi.fn().mockResolvedValue({ data: [{ id: "gpt-5-mini" }] }), invoke } as never, "- Example API | token=hidden");
    const call = invoke.mock.calls[0]?.[0];
    expect(call.messages[0].content).toContain("بيانات غير موثوقة");
    expect(JSON.stringify(call.messages)).not.toContain("hidden");
  });
});
