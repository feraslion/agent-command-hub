import { buildAgentChatMessages, normalizeAgentChatReply } from "../lib/agent-chat-policy";
import { invokeLLM, listLLMModels } from "./_core/llm";

type ChatOperations = {
  listModels: typeof listLLMModels;
  invoke: typeof invokeLLM;
};

function textContent(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && "type" in part && (part as { type?: string }).type === "text" && "text" in part)).map((part) => part.text).join("\n");
}

export async function runAgentChat(message: string, operations: ChatOperations = { listModels: listLLMModels, invoke: invokeLLM }) {
  const catalog = await operations.listModels();
  const preferred = ["gpt-5-mini", "claude-haiku-4-5", "gpt-5-nano"];
  const model = preferred.find((candidate) => catalog.data.some((item) => item.id === candidate)) ?? catalog.data[0]?.id;
  if (!model) throw new Error("لا يتوفر نموذج محادثة حالياً.");
  const response = await operations.invoke({ model, maxTokens: 800, messages: buildAgentChatMessages(message) });
  return { reply: normalizeAgentChatReply(textContent(response.choices[0]?.message.content)), model };
}
