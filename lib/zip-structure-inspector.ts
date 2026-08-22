const MAX_ZIP_ENTRIES = 1_000;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;

export type ZipStructureInspection = {
  entryCount: number;
  fileCount: number;
  directoryCount: number;
  topLevel: string[];
  manifests: string[];
  packageManagers: string[];
  languages: string[];
  testSignals: string[];
  suggestedTemplateKeys: string[];
  warnings: string[];
};

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const start = Math.max(0, bytes.length - 65_557);
  for (let index = bytes.length - 22; index >= start; index -= 1) {
    if (new DataView(bytes.buffer, bytes.byteOffset + index, 4).getUint32(0, true) === EOCD_SIGNATURE) return index;
  }
  throw new Error("تعذر قراءة فهرس ZIP المركزي؛ لم يُفك الأرشيف.");
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function inspectZipStructure(bytes: Uint8Array): ZipStructureInspection {
  const endOffset = findEndOfCentralDirectory(bytes);
  const eocd = new DataView(bytes.buffer, bytes.byteOffset + endOffset, bytes.length - endOffset);
  const entryCount = eocd.getUint16(10, true);
  const directoryOffset = eocd.getUint32(16, true);
  if (entryCount > MAX_ZIP_ENTRIES) throw new Error(`يتجاوز فهرس الأرشيف الحد البنيوي (${MAX_ZIP_ENTRIES} مدخلاً).`);
  if (directoryOffset >= bytes.length || entryCount === 0xffff) throw new Error("تنسيق ZIP64 غير مدعوم في الفحص البنيوي.");

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const names: string[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length) throw new Error("فهرس ZIP غير مكتمل.");
    const header = new DataView(bytes.buffer, bytes.byteOffset + cursor, bytes.length - cursor);
    if (header.getUint32(0, true) !== CENTRAL_DIRECTORY_SIGNATURE) throw new Error("فهرس ZIP لا يطابق بنية الملفات المتوقعة.");
    const nameLength = header.getUint16(28, true);
    const extraLength = header.getUint16(30, true);
    const commentLength = header.getUint16(32, true);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) throw new Error("اسم ملف ZIP يتجاوز حدود الأرشيف.");
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)).replace(/^\/+/, "");
    if (name && !name.includes("\0")) names.push(name);
    cursor = end;
  }

  const files = names.filter((name) => !name.endsWith("/"));
  const folders = names.filter((name) => name.endsWith("/"));
  const lower = files.map((name) => name.toLowerCase());
  const manifests = files.filter((name) => /(^|\/)(package\.json|app\.json|app\.config\.(js|ts)|dockerfile|compose\.ya?ml|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|tsconfig\.json)$/i.test(name));
  const packageManagers = [
    lower.some((name) => name.endsWith("pnpm-lock.yaml")) ? "pnpm" : "",
    lower.some((name) => name.endsWith("package-lock.json")) ? "npm" : "",
    lower.some((name) => name.endsWith("yarn.lock")) ? "yarn" : "",
  ].filter(Boolean);
  const extensions = files.map((name) => name.split(".").pop()?.toLowerCase() ?? "");
  const languages = unique([
    extensions.includes("ts") || extensions.includes("tsx") ? "TypeScript" : "",
    extensions.includes("js") || extensions.includes("jsx") ? "JavaScript" : "",
    extensions.includes("py") ? "Python" : "",
    extensions.includes("java") ? "Java" : "",
    extensions.includes("kt") ? "Kotlin" : "",
    extensions.includes("swift") ? "Swift" : "",
  ].filter(Boolean));
  const testSignals = unique(files.filter((name) => /(^|\/)(__tests__\/|test\/|tests\/|.*\.(test|spec)\.[cm]?[jt]sx?$)/i.test(name)).slice(0, 12));
  const suggestedTemplateKeys = [
    lower.some((name) => /(^|\/)(app\.json|app\.config\.(js|ts))$/.test(name)) ? "expo-mobile" : "",
    lower.some((name) => /(^|\/)package\.json$/.test(name)) ? "node-service" : "",
    lower.some((name) => /(^|\/)dockerfile$/.test(name)) || lower.some((name) => /(^|\/)compose\.ya?ml$/.test(name)) ? "docker-image" : "",
  ].filter(Boolean);
  const topLevel = unique(names.map((name) => name.split("/")[0] ?? "").filter(Boolean)).slice(0, 16);
  const warnings = [
    names.some((name) => name.includes("../") || name.startsWith("..")) ? "تتضمن الأسماء مساراً نسبياً؛ لم يُفك الأرشيف." : "",
    entryCount === MAX_ZIP_ENTRIES ? "وصل الفهرس إلى حد التحليل البنيوي." : "",
  ].filter(Boolean);

  return { entryCount, fileCount: files.length, directoryCount: folders.length, topLevel, manifests, packageManagers, languages, testSignals, suggestedTemplateKeys, warnings };
}

export function summarizeZipInspection(inspection: ZipStructureInspection) {
  const templates = inspection.suggestedTemplateKeys.length ? inspection.suggestedTemplateKeys.join("، ") : "لا يوجد قالب مقترح";
  const languages = inspection.languages.length ? inspection.languages.join("، ") : "غير محددة";
  return `فحص بنيوي ثابت: ${inspection.fileCount} ملفاً و${inspection.directoryCount} مجلداً؛ اللغات: ${languages}؛ مدير الحزم: ${inspection.packageManagers.join("، ") || "غير محدد"}؛ القوالب المقترحة: ${templates}. لم يُفك الأرشيف ولم تُقرأ محتويات ملفاته ولم يُنفذ شيء.`;
}
