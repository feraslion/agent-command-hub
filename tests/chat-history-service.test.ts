import { describe, expect, it, vi } from "vitest";

import { persistChatAssistantReply } from "../server/chat-history-service";

describe("chat history service", () => {
  it("persists an assistant reply under the authenticated owner's record", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await persistChatAssistantReply({ ownerId: 42, reply: "خطة منقحة", model: "gpt-5-mini" }, save);
    expect(save).toHaveBeenCalledWith({ ownerId: 42, role: "assistant", content: "خطة منقحة", model: "gpt-5-mini" });
  });
});
