export type PersistChatMessage = (input: { ownerId: number; role: "user" | "assistant"; content: string; model?: string | null }) => Promise<void>;

export async function persistChatAssistantReply(input: { ownerId: number; reply: string; model: string }, save: PersistChatMessage) {
  await save({ ownerId: input.ownerId, role: "assistant", content: input.reply, model: input.model });
}
