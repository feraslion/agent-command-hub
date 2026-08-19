# Android Native Project

يحتوي هذا المجلد على مشروع Android الأصلي لتطبيق **Agent Command Hub**، وهو متوافق مع Expo SDK 54 وReact Native. لا تُنشأ هذه الملفات يدوياً عند كل تشغيل؛ يجب المحافظة عليها ومزامنتها عبر `npx expo prebuild --platform android` فقط عند تغيير إعدادات Native أو إضافات Expo.

## الملفات الأساسية

| المسار | الغرض |
| --- | --- |
| `app/src/main/AndroidManifest.xml` | تعريف التطبيق والأذونات وDeep Links وخدمات Expo. |
| `app/src/main/java/com/app/agentcommandhub/` | نقاط دخول Kotlin للتطبيق وReact Native. |
| `app/src/main/res/` | أيقونات Android التكيفية، موارد شاشة البداية، والألوان. |
| `app/build.gradle` | معرّف الحزمة `com.app.agentcommandhub` وإعدادات البناء. |
| `gradle.properties` | إعدادات Hermes والمعمارية الجديدة والحد الأدنى لـ SDK. |

## التطوير المحلي

يتطلب فتح المشروع في Android Studio أو تشغيل Gradle وجود Android SDK محلي. أنشئ ملف `android/local.properties` محلياً فقط، ولا تُدخله في Git، بالمحتوى التالي بعد استبدال المسار بموقع SDK لديك:

```properties
sdk.dir=/path/to/Android/Sdk
```

بعدها يمكن تشغيل التطبيق للتطوير عبر:

```bash
pnpm android
```

أما إنتاج حزمة Android قابلة للتثبيت فيتم من خلال زر **Publish** بعد إنشاء نقطة استعادة في واجهة المشروع، بدلاً من بناء APK يدوياً داخل بيئة التطوير.
