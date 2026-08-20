export function approvalDecisionPath(approvalId: string | number) {
  const normalized = String(approvalId).trim();
  if (!/^[A-Za-z0-9_-]+$/u.test(normalized)) throw new Error("معرف قرار الموافقة غير صالح.");
  return `/approval/${normalized}` as const;
}
