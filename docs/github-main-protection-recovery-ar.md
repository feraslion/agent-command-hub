# استعادة حماية `main` وحل حظر طلبات السحب

## الحالة المرصودة

في 20 أغسطس 2026، وجدت قاعدة Ruleset نشطة باسم `Require pull request review on main` ومعرّفها `21075212`. تفرض هذه القاعدة موافقة واحدة، وحل جميع خيوط المراجعة، وتمنع الحذف والدفع غير السريع. لا تحتوي القاعدة على bypass actors، ولا تفرض فحص الجودة الحالي كقاعدة status check مستقلة.

طلبات السحب #1 و#2 و#3 قابلة للدمج من ناحية التعارضات، وفحوصها ناجحة، لكنها بحالة `BLOCKED` و`REVIEW_REQUIRED` من دون مراجعات. منشئ كل طلب هو حساب مالك المستودع نفسه، ولذلك يحتاج المسار إلى مراجع مستقل لديه صلاحية كتابة أو إلى قرار صريح من المالك لتغيير سياسة المراجعة؛ لا تُخفض قاعدة المراجعة تلقائياً لمعالجة هذا الحجب.

## الحماية المطبقة والتجاوز المؤقت

بقيت قاعدة Ruleset نشطة ومحصورة في `refs/heads/main`، وتحافظ على استخدام Pull Request وحل خيوط المراجعة ومنع الحذف والدفع القسري. أضيف إليها نوع القاعدة `required_status_checks` بالسياق:

```json
{
  "type": "required_status_checks",
  "parameters": {
    "strict_required_status_checks_policy": true,
    "required_status_checks": [
      {
        "context": "TypeScript, tests, lint, and build"
      }
    ]
  }
}
```

نظراً لعدم وجود متعاون مستقل لدى المالك، وافق المالك في 20 أغسطس 2026 على **تجاوز مؤقت ومحدود**: خُفّض `required_approving_review_count` من `1` إلى `0`. لا يعطل هذا التجاوز وجود Pull Request أو شرط حل خيوط المراجعة أو فحص الجودة الإلزامي أو منع الحذف أو منع الدفع القسري. لا يتم دمج أي طلب سحب تلقائياً.

بعد تطبيق التجاوز، أصبحت PRs #1 و#2 و#3 بحالة `CLEAN` وقابلة للدمج، مع نجاح فحص `TypeScript, tests, lint, and build`. دُمجت لاحقاً بالتسلسل وبطريقة squash: #1 في `72d0ec4`، و#2 في `2c91d22`، و#3 في `14533a8`. أصبح عدد طلبات السحب المفتوحة صفراً، وتتوفر الآن على `main` قوالب PR وIssues وسير تسمية Issues.

في 20 أغسطس 2026 دُمج PR #4 أيضاً بطريقة squash في `ba706281c201960e0c0705fef599349a057b05c3` بعد حالة `CLEAN` وفحص الجودة الناجح. يحمل هذا الطلب توسعة Runner المحلي وTypeScript وسجل Runtime والمهاجرات والاختبارات والوثائق المرتبطة. لا تزال قاعدة Pull Request وفحص الجودة وحظر الحذف والدفع القسري سارية. يجب إعادة شرط الموافقة المستقلة إلى `1` فور توفر مراجع موثوق بصلاحية كتابة أو بعد اتخاذ قرار حوكمة بديل موثق.

## مراجع خارجية

[1] [GitHub Docs — Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)  
[2] [GitHub REST API — Create and update repository rulesets](https://docs.github.com/en/rest/repos/rules?apiVersion=2022-11-28#create-a-repository-ruleset)
