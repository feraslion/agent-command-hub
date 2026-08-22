import { describe, expect, it } from "vitest";
import { validateChatAttachment } from "../lib/chat-attachment-policy";

describe("chat attachment policy", () => {
  it("accepts bounded text files and rejects unsupported formats", () => {
    expect(validateChatAttachment({ fileName: "notes.md", mimeType: "text/markdown", byteSize: 4, bytes: new TextEncoder().encode("test") }).kind).toBe("text");
    expect(() => validateChatAttachment({ fileName: "run.exe", mimeType: "application/octet-stream", byteSize: 2, bytes: new Uint8Array([1, 2]) })).toThrow("الأنواع المدعومة");
  });
});
