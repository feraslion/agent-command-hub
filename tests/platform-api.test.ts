import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function contextWithUser(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("platform API security", () => {
  it("يرفض قراءة المشاريع من دون جلسة مستخدم", async () => {
    const caller = appRouter.createCaller(contextWithUser(null));
    await expect(caller.projects.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("يتحقق من مدخلات إنشاء المشروع قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.projects.create({ name: "x", code: "bad code" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يرفض قراءة حوكمة المشروع من دون جلسة مستخدم", async () => {
    const caller = appRouter.createCaller(contextWithUser(null));
    await expect(caller.governance.get({ projectId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("يفرض حدود مصادر حزمة السياق قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));
    await expect(caller.governance.createContextPackage({
      projectId: 1,
      title: "حزمة",
      includeBrief: true,
      taskIds: Array.from({ length: 13 }, (_, index) => index + 1),
      artifactIds: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يتحقق من دور بوابة النموذج ومعرّف حزمة السياق قبل الإرسال إلى النموذج", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));
    await expect(caller.agentModel.run({ projectId: 1, contextPackageId: 0, role: "planner" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.agentModel.run({ projectId: 1, contextPackageId: 1, role: "release" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يرفض أمر تشغيل لا يحتوي معرّف مشروع صالح قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.commands.enqueue({ projectId: 0, command: "run_project" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يتحقق من مفتاح طلب تشغيل العامل قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.worker.setDesiredState({ enabled: "yes" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يرفض قراءة خطط Runtime عند معرّف مشروع غير صالح قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.runtime.listPlans({ projectId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يتحقق من قرار الموافقة المرتبط بمحرك المهام قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.approvals.resolve({ projectId: 1, approvalId: 1, decision: "continue" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يرفض طلب Runtime المعزولة بمعرّف مشروع غير صالح قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.isolatedRuntime.requestExecution({ projectId: 0, targetPath: "source/main.ts" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يتحقق من مدخلات إقران وإلغاء Runner المحلي قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.localRunners.createPairing({ label: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.localRunners.revoke({ runnerId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يرفض اقتراح المراجعة الثانوية بمعرّف مشروع غير صالح قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.sensitiveChanges.submit({ projectId: 0, path: "source/runner.ts", content: "process.env.API_TOKEN" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يرفض قراءة سجل الفروقات المعتمدة بمعرّف مشروع غير صالح قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.sensitiveChanges.listApplied({ projectId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يتحقق من تعيين قالب System Prompt للوكيل قبل الوصول لقاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.agentPrompts.save({ agentKey: "Planner Agent", templateKey: "planner", customInstructions: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يركب معاينة قالب Debugger الإنجليزي مع التعليمات المخصصة من دون كتابة في قاعدة البيانات", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    const preview = await caller.agentPrompts.preview({ templateKey: "debugger", templateLocale: "en", customInstructions: "Prioritize the smallest safe isolation step." });

    expect(preview.finalPrompt).toContain("You are the Agent Command Hub Master Agent");
    expect(preview.finalPrompt).toContain("You are the Debugger in Agent Command Hub.");
    expect(preview.finalPrompt).toContain("Prioritize the smallest safe isolation step.");
    expect(preview.finalPrompt).toContain("Saved custom instructions");
  });

  it("يرفض لغة قالب غير مدعومة قبل تركيب معاينة النص النهائي", async () => {
    const caller = appRouter.createCaller(contextWithUser({
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.agentPrompts.preview({ templateKey: "debugger", templateLocale: "fr" as never, customInstructions: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
