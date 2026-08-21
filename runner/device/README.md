# حزمة تشغيل Runner على جهاز المالك

هذا المجلد هو نقطة البدء المحلية للـ Runner. انسخه مع مجلد `runner/` أو اربط جذر مشروع `agent-command-hub` على الجهاز الذي يملك Docker. لا يحتوي المجلد على مفاتيح أو رموز، ولا ينبغي إضافة أي رمز إليه أو إلى Git.

| الملف | الغرض |
| --- | --- |
| `build-typescript-image.sh` | بناء صورة TypeScript الثابتة من lockfile المشروع. |
| `smoke-test-typescript.sh` | اختبار محلي آمن للصورة، بلا شبكة وبنفس حدود حاوية الـ Runner. |
| `.env.runner.example` | مثال لإعداد محلي يحفظ عنوان الخادم ومفتاح Runner ورمز الربط. |
| `run-local-runner.sh` | يتحقق من الإعداد ثم يشغل عميل Runner بعد فحص Docker التمهيدي. |

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

## 3. تجهيز الإعداد المؤجل بلا أسرار

إذا كنت تقرأ هذا الدليل من الهاتف أو لا يتوفر أمامك جهاز Docker بعد، جهز ملف الإعداد المحلي عند توفر الجهاز بهذا الأمر. ينشئ الأمر ملفاً مقيد القراءة لمستخدم الجهاز فقط، يضع نطاق التطبيق ويترك المفتاح والرمز كقيمتين بديلتين. لا ينشئ الأمر رمز إقران، ولا يطبعه، ولا يرسله إلى الشبكة.

```bash
./runner/device/prepare-runner-pairing.sh
```

يستخدم الأمر نطاق التطبيق المنشور الحالي `https://agenthub-gkta8g2i.manus.space`. لبيئة منشورة مختلفة، مرر نطاق HTTPS صريحاً فقط:

```bash
./runner/device/prepare-runner-pairing.sh --server https://YOUR-AGENT-HUB-DOMAIN
```

يرفض النص استبدال ملف إعداد موجود افتراضياً حتى لا يمحو رمزاً محلياً. لا تستخدم `--overwrite` إلا بعد إلغاء الإقران السابق أو إزالة بياناته محلياً عن قصد.

## 4. إصدار بيانات الإقران وإعداد متغيرات Runner محلياً

انسخ ملف المثال إلى ملفك المحلي المستثنى من Git، ثم احصر قراءته على حسابك. لا تضف علامات اقتباس أو أوامر shell أو تعليقات في نهاية السطر؛ كل قيمة تعامل كقيمة حرفية.

```bash
cp runner/device/.env.runner.example runner/device/.env.runner
chmod 600 runner/device/.env.runner
```

حرر ملف `.env.runner` وضع نطاق التطبيق ومفتاح Runner والرمز الذي أصدره التطبيق. قبل التشغيل، تحقق من الملف وDocker تلقائياً من دون طباعة الرمز:

```bash
./runner/device/run-local-runner.sh --check-config
```

يفحص الأمر تمهيدياً توفر عميل Docker، ووصوله إلى Docker Engine، ووجود صورتي `node:22-alpine` و`agenthub-runner-ts:5.7.3`. إذا غابت الصورة الأولى، نفذ `docker pull node:22-alpine`؛ وإذا غابت الثانية، نفذ `./runner/device/build-typescript-image.sh`. يمنع Runner الاتصال بالخادم أو تنفيذ طلبات عند فشل هذا الفحص.

عند غياب Docker أو توقف الخدمة، يتعرف Runner إلى نظام التشغيل ويقترح إجراء مناسباً بدلاً من رسالة عامة:

| النظام | الإجراء الذي ستقترحه الرسالة | المرجع الرسمي |
| --- | --- | --- |
| macOS | `brew install --cask docker` ثم `open -a Docker`. | [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) |
| Windows | في PowerShell بصلاحية مسؤول: `winget install -e --id Docker.DockerDesktop`. | [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) |
| Debian / Ubuntu | `sudo apt-get update && sudo apt-get install -y docker.io` ثم `sudo systemctl enable --now docker`. | [Docker Engine for Ubuntu](https://docs.docker.com/engine/install/ubuntu/) |
| Fedora أو Arch أو توزيع آخر | يستخدم `dnf` أو `pacman` عند التعرف إلى التوزيع، أو يعرض رابط دليل Linux العام. | [Docker Engine for Linux](https://docs.docker.com/engine/install/) |

## 5. تشغيل Runner المرتبط

بعد إكمال ملف الإعداد، شغل Runner:

```bash
./runner/device/run-local-runner.sh
```

لإجراء نبضة واحدة بدلاً من الاستماع المستمر، نفذ `./runner/device/run-local-runner.sh --once`، أو غيّر `AGENTHUB_RUN_ONCE=true` في ملف الإعداد. تبقى صيغة الوسائط المباشرة مدعومة للتوافق: `./runner/device/run-local-runner.sh SERVER_URL RUNNER_KEY RUNNER_TOKEN [--once]`. بعد تشغيل العميل، أنشئ طلب تنفيذ ملف مستقل داخل `source/` أو `tests/`، اعتمده من مركز التحكم، ثم راقب الحالة وstdout وstderr ورمز الخروج والمدة في تبويب **Runtime**.

> لا يربط الـ Runner مجلد المستخدم داخل الحاوية، ولا يمرر متغيرات بيئة المضيف إليها، ولا يقبل صورة Docker أو أمراً قادماً من الخادم.

## 6. فحص مستودع محلي قبل التخطيط

افتح المشروع من تبويب **المشاريع** واختر **ربط وفحص مستودع** لمعرفة رقم المشروع، ثم نفّذ الأمر التالي على جهاز Runner بعد استبدال المسار المحلي:

```bash
./runner/device/run-local-runner.sh --scan-dir "/المسار/المحلي/للمشروع" --project 123
```

لا يحتاج الفحص إلى Docker ولا ينفذ أي شيفرة. يقرأ أسماء الملفات وامتداداتها فقط ليحسب عدد الملفات والمجلدات واللغات وملفات البناء والاختبار وإشارات أسماء حساسة مثل `.env`. يتجاهل `.git` و`node_modules` والمجلدات الثقيلة والروابط الرمزية، ولا يرفع محتوى الملفات أو المسارات الكاملة أو قيم الأسرار. يتوقف الفحص عند 20,000 ملف لحماية الجهاز.

> إرسال ملخص الفحص لا يمنح التطبيق وصولاً مستمراً إلى المجلد. يبقى إنشاء Pull Request أو أي تنفيذ متعدد الملفات عملية منفصلة تتطلب موافقة صريحة وسياسة مستقلة.

## 7. تشغيل TypeScript متعدد الملفات

عند طلب المالك تنفيذ حزمة من Workspace، يختار التطبيق ملف دخول وملفات TypeScript محفوظة ضمن `source/` أو `tests/` فقط. قبل أن تصل الحزمة إلى الجهاز، تتحقق البوابة من العدد والحجم والمسارات ثم تنشئ **موافقة صريحة**. بعد الاعتماد، يستلم Runner الحزمة ذاتها ويعيد التحقق منها قبل الكتابة في مجلد مؤقت.

| البند | الحد المقيد |
| --- | ---: |
| عدد الملفات | 2–24 ملفاً |
| الحجم الإجمالي | 96KB |
| حجم الملف الواحد | 24KB |
| الاستيراد | نسبي (`./` أو `../`) فقط |
| الشبكة | معطلة داخل الحاوية |
| الموارد | 20 ثانية، 384MB، 0.75 CPU، 96 عملية |

تمنع السياسة الحزم الخارجية ووحدات النظام والوصول إلى متغيرات البيئة وتنفيذ `eval` أو الاستيراد الديناميكي. لا يدعم هذا المسار تثبيت تبعيات أو قراءة ملف مضيف أو تعديل Git؛ وهو مخصص لاختبارات وتجميع حزم TypeScript صغيرة قابلة للمراجعة فقط.
