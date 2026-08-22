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
});
