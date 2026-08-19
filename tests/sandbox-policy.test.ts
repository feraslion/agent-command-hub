import { describe, expect, it } from "vitest";
import { sandboxGateDetail, sandboxGateTitle } from "../server/sandbox-policy";

describe("سياسة Sandbox المنطقية", () => {
  it("تضع Git والنشر والحذف خلف بوابة صريحة ولا تصفها كتـنفيذ", () => {
    expect(sandboxGateTitle("git_gate")).toContain("Git");
    expect(sandboxGateDetail("publish_gate")).toContain("لا يوجد نشر فعلي");
    expect(sandboxGateDetail("delete_gate")).toContain("لا يوجد حذف فعلي");
  });
});
