# مصادر فحص وجود المستودعات العامة

يستخدم فحص الوجود الاختياري مسار REST ثابتاً يخص المنصة فقط، بعد تأكيد المستخدم من الواجهة. لا يرسل رمزاً، ولا يقرأ محتوى المستودع، ولا يتبع إعادة توجيه، ولا يسمح بتمرير عنوان خارجي من المستخدم إلى `fetch`.

| المنصة | مسار التحقق العام | المعلومة المعتمدة |
| --- | --- | --- |
| GitHub | `GET https://api.github.com/repos/{owner}/{repo}` | توثق GitHub مورد المستودع، وتوضح إمكان استعمال واجهة REST بلا مصادقة للموارد العامة. [1] |
| GitLab | `GET https://gitlab.com/api/v4/projects/{url-encoded-path}` | توثق GitLab استرجاع مشروع واحد عبر `GET /projects/:id`، مع دعم مسار المشروع المشفر للمشروع العام. [2] |
| Bitbucket | `GET https://api.bitbucket.org/2.0/repositories/{workspace}/{repo_slug}` | توثق Bitbucket مورد المستودع بهذه الصيغة. [3] |

> حالة `200` تعني أن المورد العام استجاب فقط. لا تعني إمكانية البناء أو الاستنساخ أو الوصول إلى مستودع خاص. حالات `401` و`403` تسجل كمورد مقيد، و`404` كمورد غير موجود في نطاق الوصول العام.

## المراجع

[1]: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository "GitHub REST API — Get a repository"
[2]: https://docs.gitlab.com/api/projects/#get-single-project "GitLab Projects API — Retrieve a project"
[3]: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/#api-repositories-workspace-repo_slug-get "Bitbucket Cloud REST API — Get a repository"
