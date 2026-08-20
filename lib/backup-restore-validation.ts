export type IsolatedBackupSnapshot = {
  version: 1;
  scope: "test_only";
  createdAt: string;
  projects: Array<{ id: number; name: string; taskCount: number; artifactCount: number }>;
};

export function createIsolatedBackupSnapshot(input: Array<{ id: number; name: string; taskCount: number; artifactCount: number }>): IsolatedBackupSnapshot {
  return { version: 1, scope: "test_only", createdAt: new Date().toISOString(), projects: input.map((project) => ({ ...project })) };
}

export function validateIsolatedRestore(snapshot: IsolatedBackupSnapshot, restored: IsolatedBackupSnapshot) {
  const errors: string[] = [];
  if (snapshot.version !== restored.version || restored.scope !== "test_only") errors.push("صيغة النسخة التجريبية غير متطابقة.");
  if (snapshot.projects.length !== restored.projects.length) errors.push("عدد المشاريع المستعادة لا يطابق النسخة التجريبية.");
  snapshot.projects.forEach((project) => {
    const candidate = restored.projects.find((item) => item.id === project.id);
    if (!candidate || candidate.name !== project.name || candidate.taskCount !== project.taskCount || candidate.artifactCount !== project.artifactCount) errors.push(`تعذر إثبات استعادة المشروع التجريبي #${project.id}.`);
  });
  return { valid: errors.length === 0, errors };
}
