export type OperationalHealthInput = {
  queued: number;
  activeLeases: number;
  failedLast24h: number;
  pendingApprovals: number;
  readyRunners: number;
  workerStatus: string;
  workerHeartbeatAt: Date | string | null;
  budgetPercent: number;
};

export type OperationalHealthTone = "success" | "warning" | "critical";

export function getOperationalHealth(input: OperationalHealthInput) {
  const workerHeartbeat = input.workerHeartbeatAt ? new Date(input.workerHeartbeatAt).getTime() : Number.NaN;
  const workerFresh = input.workerStatus === "ready" && !Number.isNaN(workerHeartbeat) && Date.now() - workerHeartbeat < 90_000;
  const critical = input.failedLast24h > 0 || input.budgetPercent >= 100 || (input.activeLeases > 0 && !workerFresh);
  const warning = !critical && (input.pendingApprovals > 0 || input.queued > 0 || input.budgetPercent >= 85 || input.readyRunners === 0);
  const tone: OperationalHealthTone = critical ? "critical" : warning ? "warning" : "success";
  const label = tone === "critical" ? "تدخل مطلوب" : tone === "warning" ? "تحتاج متابعة" : "التشغيل مستقر";
  return {
    tone,
    label,
    workerFresh,
    cards: [
      { id: "queue", label: "الطابور", value: input.queued, tone: input.queued > 0 ? "warning" : "success" as OperationalHealthTone },
      { id: "leases", label: "حجوزات حية", value: input.activeLeases, tone: input.activeLeases > 0 && !workerFresh ? "critical" : input.activeLeases > 0 ? "warning" : "success" as OperationalHealthTone },
      { id: "failures", label: "فشل 24س", value: input.failedLast24h, tone: input.failedLast24h > 0 ? "critical" : "success" as OperationalHealthTone },
      { id: "decisions", label: "موافقات", value: input.pendingApprovals, tone: input.pendingApprovals > 0 ? "warning" : "success" as OperationalHealthTone },
      { id: "budget", label: "الميزانية", value: `${Math.round(input.budgetPercent)}%`, tone: input.budgetPercent >= 100 ? "critical" : input.budgetPercent >= 85 ? "warning" : "success" as OperationalHealthTone },
    ],
  };
}
