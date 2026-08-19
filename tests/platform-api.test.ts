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
});
