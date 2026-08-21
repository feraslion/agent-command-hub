import type { BuildTarget } from "./project-intake-policy";

export type BuildTemplate = {
  key: "expo-mobile" | "node-service" | "docker-image";
  name: string;
  description: string;
  targets: readonly BuildTarget[];
  detectors: readonly string[];
  capabilities: readonly string[];
  preflight: readonly string[];
  artifacts: readonly string[];
};

export const buildTemplates: readonly BuildTemplate[] = [
  {
    key: "expo-mobile", name: "Expo للجوال", description: "يفحص إعداد Expo وlockfile ويخطط جودة TypeScript قبل أي بناء Android أو iOS.",
    targets: ["web", "android", "ios"], detectors: ["app.json أو app.config.ts", "package.json", "lockfile"], capabilities: ["node", "docker", "android_sdk عند Android"],
    preflight: ["تثبيت حتمي من lockfile", "فحص الأنواع", "lint", "test"], artifacts: ["dist/", "APK/AAB أو IPA بعد موافقة منفصلة"],
  },
  {
    key: "node-service", name: "خدمة Node.js", description: "يخطط تثبيتاً حتمياً وفحوص النوع والجودة وبناء حزمة التشغيل لخدمة Node.",
    targets: ["web", "node", "custom"], detectors: ["package.json", "lockfile", "نقطة دخول"], capabilities: ["node"],
    preflight: ["تثبيت حتمي من lockfile", "فحص الأنواع", "lint", "test", "build"], artifacts: ["dist/ أو حزمة تشغيل"],
  },
  {
    key: "docker-image", name: "صورة Docker", description: "يفحص Dockerfile وسياق البناء ويخطط صورة محلية غير منشورة مع اختبار قصير مقيد.",
    targets: ["docker", "custom"], detectors: ["Dockerfile", "compose.yml أو compose.yaml", ".dockerignore"], capabilities: ["docker"],
    preflight: ["فحص Dockerfile", "مراجعة سياق البناء", "بناء tag محلي", "اختبار حاوية مقيد"], artifacts: ["image digest محلي", "سجل بناء منقح"],
  },
] as const;

export function getBuildTemplate(key: string) {
  const template = buildTemplates.find((item) => item.key === key);
  if (!template) throw new Error("قالب البناء غير مدعوم.");
  return template;
}
