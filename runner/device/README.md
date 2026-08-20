# حزمة تشغيل Runner على جهاز المالك

هذا المجلد هو نقطة البدء المحلية للـ Runner. انسخه مع مجلد `runner/` أو اربط جذر مشروع `agent-command-hub` على الجهاز الذي يملك Docker. لا يحتوي المجلد على مفاتيح أو رموز، ولا ينبغي إضافة أي رمز إليه أو إلى Git.

| الملف | الغرض |
| --- | --- |
| `build-typescript-image.sh` | بناء صورة TypeScript الثابتة من lockfile المشروع. |
| `smoke-test-typescript.sh` | اختبار محلي آمن للصورة، بلا شبكة وبنفس حدود حاوية الـ Runner. |
| `run-local-runner.sh` | تشغيل عميل Runner بعد إنشاء مفتاح ورمز ربط من التطبيق. |

## المتطلبات

يجب أن يكون Docker Engine أو Docker Desktop يعمل، وأن تكون لدى المستخدم صلاحية `docker run`. يلزم Node.js 22 أو أحدث لتشغيل `local-runner.mjs`. اربط مجلد المشروع على جهازك من تطبيق Manus Desktop قبل تشغيل هذه الأوامر، ثم نفذها من جذر المستودع.

## 1. بناء صورة TypeScript المقيدة

```bash
./runner/device/build-typescript-image.sh
```

يبني الأمر الصورة `agenthub-runner-ts:5.7.3` من `runner/typescript-package-lock.json`. لا يثبّت الـ Runner أي حزم أثناء تنفيذ طلب من التطبيق؛ تقتصر الحاوية على TypeScript 5.7.3 الموجودة في الصورة.

## 2. اختبار Docker قبل ربط التطبيق

```bash
./runner/device/smoke-test-typescript.sh
```

ينشئ الاختبار ملف TypeScript حسابياً مؤقتاً فقط، ثم يترجمه ويشغله في حاوية بلا شبكة، بجذر قراءة فقط، وبحدود 15 ثانية و256MB و0.5 CPU. النتيجة المتوقعة هي `runner-ts-smoke: 42`.

## 3. تشغيل Runner المرتبط

أنشئ Runner من إعدادات Agent Command Hub، وانسخ المفتاح والرمز لمرة واحدة، ثم مررهما كوسائط مباشرة بدلاً من حفظهما في ملف:

```bash
./runner/device/run-local-runner.sh \
  https://YOUR-AGENT-HUB-DOMAIN \
  RUNNER_KEY \
  RUNNER_TOKEN
```

لإجراء نبضة واحدة بدلاً من الاستماع المستمر، أضف `--once` في نهاية الأمر. بعد تشغيل العميل، أنشئ طلب تنفيذ ملف مستقل داخل `source/` أو `tests/`، اعتمده من مركز التحكم، ثم راقب الحالة وstdout وstderr ورمز الخروج والمدة في تبويب **Runtime**.

> لا يربط الـ Runner مجلد المستخدم داخل الحاوية، ولا يمرر متغيرات بيئة المضيف إليها، ولا يقبل صورة Docker أو أمراً قادماً من الخادم.
