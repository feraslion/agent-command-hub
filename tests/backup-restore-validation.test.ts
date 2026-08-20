import { describe, expect, it } from "vitest";

import { createIsolatedBackupSnapshot, validateIsolatedRestore } from "../lib/backup-restore-validation";

describe("isolated backup and restore validation", () => {
  it("validates a round trip without touching production data", () => {
    const snapshot = createIsolatedBackupSnapshot([{ id: 7, name: "مشروع تجريبي", taskCount: 3, artifactCount: 2 }]);
    expect(validateIsolatedRestore(snapshot, JSON.parse(JSON.stringify(snapshot)))).toEqual({ valid: true, errors: [] });
  });

  it("rejects an incomplete restore", () => {
    const snapshot = createIsolatedBackupSnapshot([{ id: 7, name: "مشروع تجريبي", taskCount: 3, artifactCount: 2 }]);
    const restored = { ...snapshot, projects: [{ ...snapshot.projects[0], artifactCount: 1 }] };
    expect(validateIsolatedRestore(snapshot, restored).valid).toBe(false);
  });
});
