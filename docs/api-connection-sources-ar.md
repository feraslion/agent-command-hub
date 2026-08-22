# مراجع تكاملات API الآمنة

تُستخدم هذه المراجع لتصميم خيارات ربط الحساب داخل التطبيق. لا ينسخ التطبيق مفاتيح من حساب المالك ولا يخزنها في جداول البيانات أو حقول الروابط.

| المزوّد | النموذج المدعوم | قرار التصميم |
|---|---|---|
| GitHub | توصي الوثائق بتطبيق GitHub ذي الصلاحيات الدقيقة والرموز القصيرة؛ تتطلب تطبيقات OAuth عنوان callback و`client_id`، ويظل السر خادمياً فقط. | يُظهر التطبيق حالة الربط وخيار التفويض، لكنه لا يبدأ OAuth قبل إعداد تطبيق GitHub وبياناته الخادمية من المالك. |
| OpenRouter | يمكن إنشاء مفتاح باسم وحد ائتماني اختياري، أو استخدام OAuth PKCE الذي يعيد مفتاحاً يتحكم به المستخدم. | يُظهر التطبيق أن الربط يحتاج مفتاحاً آمناً أو OAuth PKCE. لا يُحفظ المفتاح في قاعدة البيانات أو يعرض في التطبيق. |
| Public APIs | الخدمة العامة الموجودة في المشروع لا تحتاج مفتاحاً. | يمكن تفعيلها كمرجع قراءة محكوم بلا حساب خارجي. |

## المصادر الرسمية

1. [OpenRouter API authentication](https://openrouter.ai/docs/api_reference/authentication)
2. [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth)
3. [OpenRouter quickstart](https://openrouter.ai/docs/quickstart)
4. [GitHub authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
5. [GitHub creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
6. [GitHub REST API authentication](https://docs.github.com/rest/authentication/authenticating-to-the-rest-api)
