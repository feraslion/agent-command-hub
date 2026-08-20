export const gitPrOnlyActions = ["inspect", "request_pull_request"] as const;
export type GitPrOnlyAction = (typeof gitPrOnlyActions)[number];

export type PullRequestDraft = {
  projectId: number;
  headBranch: string;
  baseBranch: string;
  title: string;
  summary: string;
};

const branchPattern = /^(?!.*(?:\.\.|\/\/))[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u;

export function validatePullRequestDraft(draft: PullRequestDraft) {
  if (!Number.isInteger(draft.projectId) || draft.projectId <= 0) throw new Error("يتطلب طلب Pull Request مشروعاً صالحاً.");
  if (!branchPattern.test(draft.headBranch) || !branchPattern.test(draft.baseBranch)) throw new Error("اسم الفرع غير صالح أو يحتوي انتقال مسار محظوراً.");
  if (draft.headBranch === draft.baseBranch) throw new Error("يجب أن يختلف فرع التغييرات عن الفرع الأساسي.");
  if (!draft.title.trim() || draft.title.trim().length > 255) throw new Error("عنوان Pull Request مطلوب ولا يتجاوز 255 حرفاً.");
  if (draft.summary.trim().length > 4000) throw new Error("ملخص Pull Request يتجاوز الحد المسموح.");
  return {
    ...draft,
    headBranch: draft.headBranch.trim(),
    baseBranch: draft.baseBranch.trim(),
    title: draft.title.trim(),
    summary: draft.summary.trim(),
  };
}

export function getGitPrOnlyBoundary() {
  return {
    allowed: gitPrOnlyActions,
    blocked: ["push", "merge", "force_push", "delete_branch", "change_protection"] as const,
    detail: "لا تنفذ البوابة دفعاً أو دمجاً أو حذفاً. يقتصر الطلب على مراجعة Pull Request بعد موافقة صريحة.",
  };
}
