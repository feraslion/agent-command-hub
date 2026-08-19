export const sandboxGateKinds = ["git_gate", "publish_gate", "delete_gate"] as const;

export function sandboxGateTitle(kind: (typeof sandboxGateKinds)[number]) {
  if (kind === "git_gate") return "طلب بوابة Git";
  if (kind === "publish_gate") return "طلب بوابة النشر";
  return "طلب بوابة حذف";
}

export function sandboxGateDetail(kind: (typeof sandboxGateKinds)[number]) {
  if (kind === "git_gate") return "لا يوجد أمر Git في البيئة الحالية؛ يبقى الإجراء محجوباً حتى الموافقة ووجود بيئة تنفيذ معتمدة.";
  if (kind === "publish_gate") return "لا يوجد نشر فعلي في هذه المرحلة؛ يسجل الطلب فقط حتى الموافقة ووجود بيئة تنفيذ معتمدة.";
  return "لا يوجد حذف فعلي في هذه المرحلة؛ يسجل الطلب فقط حتى الموافقة ووجود بيئة تنفيذ معتمدة.";
}
