import { scanProjectArchiveSensitiveData } from "./project-sensitive-data-scanner";

export const chatAttachmentKindValues = ["image", "pdf", "text", "zip"] as const;
export type ChatAttachmentKind = (typeof chatAttachmentKindValues)[number];

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const kindFor = (name: string, mimeType: string): ChatAttachmentKind | null => {
  const lower = name.toLowerCase();
  if (mimeType.startsWith("image/") && /\.(png|jpe?g|webp)$/i.test(lower)) return "image";
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if ((mimeType.startsWith("text/") || /\.(txt|md|json|ya?ml|ts|tsx|js|jsx|py|java|kt|go|rs|sql|xml)$/i.test(lower))) return "text";
  if (mimeType === "application/zip" || mimeType === "application/x-zip-compressed" || lower.endsWith(".zip")) return "zip";
  return null;
};

export function validateChatAttachment(input: { fileName: string; mimeType: string; byteSize: number; bytes: Uint8Array }) {
  const fileName = input.fileName.trim().replace(/[\\/\0]/g, "_");
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!fileName || fileName.length > 180) throw new Error("اسم المرفق غير صالح.");
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > MAX_ATTACHMENT_BYTES || input.bytes.length !== input.byteSize) throw new Error("حجم المرفق يجب ألا يتجاوز 5MB.");
  const kind = kindFor(fileName, mimeType);
  if (!kind) throw new Error("الأنواع المدعومة هي ZIP وPDF والصور وملفات النص أو الشيفرة فقط.");
  if (kind === "zip") {
    const scan = scanProjectArchiveSensitiveData(input.bytes);
    if (scan.status === "blocked") throw new Error("حُجب أرشيف ZIP لأن فحص الأسرار اكتشف بيانات حساسة. لم تُحفظ القيم المطابقة.");
    return { fileName, mimeType, kind, summary: scan.status === "review_required" ? "أرشيف ZIP مرفق؛ يتطلب مراجعة نتائج فحص الأسرار قبل استخدامه." : "أرشيف ZIP مرفق وفحص الأسرار لم يحجبه." };
  }
  if (kind === "text") return { fileName, mimeType, kind, summary: "ملف نصي مرفق؛ يضاف سياقه بعد تنقيح المحتوى." };
  if (kind === "pdf") return { fileName, mimeType, kind, summary: "ملف PDF مرفق؛ لا يُنفذ ولا يُفكك تلقائياً." };
  return { fileName, mimeType, kind, summary: "صورة مرفقة للقراءة فقط." };
}

export function redactAttachmentText(value: string) {
  return value.replace(/(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-(?:live|test)-[A-Za-z0-9_-]{16,}|-----BEGIN [\s\S]*?PRIVATE KEY-----)/g, "[قيمة حساسة محذوفة]").slice(0, 24_000);
}
