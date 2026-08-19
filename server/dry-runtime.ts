import * as runtimeDb from "./db";
import type { DryRuntimePlanInput } from "./db";

type ClaimedCommand = {
  id: number;
  projectId: number;
  taskId: number | null;
  command: "run_project" | "run_task" | "resume_task";
  payload: string | null;
};

type RuntimeOperations = Pick<typeof runtimeDb, "createDryExecutionPlanForClaim" | "listClaimedCommandsForDryRuntime" | "renewDryCommandLease">;

export type DryRuntimeTickResult = {
  createdPlanCount: number;
  observedClaimCount: number;
};

const baseConstraints = [
  "لا يُشغّل Runtime الجاف shell أو Git أو الشبكة أو أدوات النظام.",
  "لا يُنشئ Workspace ولا يقرأ أو يكتب ملفات المشروع في هذه المرحلة.",
  "أي نشر أو حذف يبقى مشروطاً بموافقة صريحة قبل تفعيل أدوات التنفيذ.",
];

export function buildDryRuntimePlan(command: ClaimedCommand): DryRuntimePlanInput {
  const payloadHint = command.payload?.trim() ? ` مع مراعاة توجيه الأمر: ${command.payload.trim().slice(0, 180)}` : "";
  if (command.command === "run_task") {
    return {
      summary: `خطة جافة لمهمة محددة${payloadHint}`,
      steps: [
        { order: 1, agent: "Orchestrator", title: "تثبيت نطاق المهمة", detail: "ربط المهمة بالأمر المحجوز وتحديد حدود التنفيذ.", approval: "auto" },
        { order: 2, agent: "Planner", title: "تفكيك العمل", detail: "إعداد خطوات تطوير واختبار قابلة للمراجعة قبل التنفيذ الفعلي.", approval: "review" },
        { order: 3, agent: "Coder", title: "تجهيز تعديل مقترح", detail: "تحديد تغييرات المصدر المتوقعة من دون لمس الملفات.", approval: "review" },
        { order: 4, agent: "QA", title: "تحديد تحقق القبول", detail: "اقتراح اختبارات قبول وقيود الجودة من دون تشغيلها.", approval: "auto" },
      ],
      constraints: baseConstraints,
    };
  }
  if (command.command === "resume_task") {
    return {
      summary: `خطة جافة لاستئناف مهمة متوقفة${payloadHint}`,
      steps: [
        { order: 1, agent: "Debugger", title: "فهرسة حالة الاستئناف", detail: "تسجيل نقطة التوقف المفترضة ومخاطر الاستمرار.", approval: "auto" },
        { order: 2, agent: "Planner", title: "إعادة ترتيب الخطوات", detail: "صياغة مسار استئناف قابل للمراجعة مع نقاط تحقق.", approval: "review" },
        { order: 3, agent: "QA", title: "تحديد تحقق الاستئناف", detail: "وضع اختبارات يجب تنفيذها عند توفر أدوات Runtime الفعلية.", approval: "auto" },
      ],
      constraints: baseConstraints,
    };
  }
  return {
    summary: `خطة جافة لتشغيل المشروع${payloadHint}`,
    steps: [
      { order: 1, agent: "Orchestrator", title: "تهيئة سياق التنفيذ", detail: "تأكيد المشروع والأمر المحجوز وسياسة الموافقات.", approval: "auto" },
      { order: 2, agent: "Planner", title: "صياغة خطة العمل", detail: "تقسيم التنفيذ إلى وحدات متتابعة ونقاط مراجعة.", approval: "review" },
      { order: 3, agent: "Coder", title: "تحديد مخرجات البناء", detail: "إدراج تغييرات ومخرجات متوقعة بلا كتابة ملفات.", approval: "review" },
      { order: 4, agent: "QA", title: "تحديد بوابات الجودة", detail: "إعداد معايير الاختبارات والتحقق قبل السماح بالمراجعة.", approval: "auto" },
      { order: 5, agent: "Reviewer", title: "مراجعة الخطة", detail: "تجميع نقاط المخاطر والتغييرات واسعة الأثر للمراجعة.", approval: "review" },
      { order: 6, agent: "Release", title: "حجز بوابة الإصدار", detail: "الإصدار أو الحذف لا يُنفذان إلا بعد موافقة صريحة عند تفعيل الأدوات.", approval: "approval" },
    ],
    constraints: baseConstraints,
  };
}

export async function runDryRuntimeTick(workerId: string, ownerIds: number[], operations: RuntimeOperations = runtimeDb): Promise<DryRuntimeTickResult> {
  const claims = await operations.listClaimedCommandsForDryRuntime(workerId, ownerIds);
  let createdPlanCount = 0;
  for (const claim of claims) {
    const result = await operations.createDryExecutionPlanForClaim({
      ownerId: claim.ownerId,
      commandId: claim.command.id,
      workerId,
      plan: buildDryRuntimePlan(claim.command),
    });
    await operations.renewDryCommandLease(claim.command.id, workerId);
    if (result.created) createdPlanCount += 1;
  }
  return { createdPlanCount, observedClaimCount: claims.length };
}
