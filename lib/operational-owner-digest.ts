export type OwnerOperationalSnapshot = {
  queued: number;
  activeLeases: number;
  failedLast24h: number;
  pendingApprovals: number;
  readyRunners: number;
  workerStatus: string;
  workerHeartbeatAt: Date | string | null;
  budgetPercent: number;
};

export function buildOwnerOperationalDigest(snapshot: OwnerOperationalSnapshot) {
  const failures = Math.max(0, snapshot.failedLast24h);
  const approvals = Math.max(0, snapshot.pendingApprovals);
  const attention = failures > 0 || snapshot.budgetPercent >= 100 || approvals > 0;
  const heartbeat = snapshot.workerHeartbeatAt ? new Date(snapshot.workerHeartbeatAt).toLocaleString("ar") : "لم تصل نبضة";
  return {
    title: attention ? "ملخص تشغيل يحتاج مراجعة" : "ملخص تشغيل Agent Command Hub",
    content: [
      `الطابور: ${Math.max(0, snapshot.queued)} · الحجوزات: ${Math.max(0, snapshot.activeLeases)} · فشل آخر 24 ساعة: ${failures}.`,
      `الموافقات المعلقة: ${approvals} · Runner الجاهز: ${Math.max(0, snapshot.readyRunners)}.`,
      `العامل: ${snapshot.workerStatus} · آخر نبضة: ${heartbeat} · الميزانية: ${Math.max(0, Math.min(100, snapshot.budgetPercent))}%.`,
      "هذا الملخص قرائي فقط؛ لا يشغّل Runner ولا يوافق أو ينشر أي تغيير.",
    ].join("\n"),
    needsAttention: attention,
  };
}
