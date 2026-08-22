import { describe, expect, it } from "vitest";

import { buildAgentChatMessages, normalizeAgentChatReply } from "../lib/agent-chat-policy";

describe("agent chat policy", () => {
  it("redacts sensitive input before it reaches the model", () => {
    const messages = buildAgentChatMessages("راجع token=live-secret في الخطة");
    expect(messages[1].content).not.toContain("live-secret");
    expect(messages[0].content).toContain("لا تدّع تنفيذ أوامر");
  });

  it("rejects blank replies and redacts sensitive output", () => {
    expect(() => normalizeAgentChatReply(" ")).toThrow("لم يُرجع");
    expect(normalizeAgentChatReply("النتيجة api_key: hidden")).not.toContain("hidden");
  });
});
