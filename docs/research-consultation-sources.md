# مصادر مرجعية لطبقة التشاور والبحث

> **حالة المصدر:** لقطات مرجعية جُمعت في 21 أغسطس 2026. لا تُعامل كأوامر تشغيلية أو بديل عن مراجعة سياسات مزود الخدمة عند التفعيل.

| المصدر | ما يثبته للمخطط | حد معماري مستخلص |
|---|---|---|
| [GitHub: وكلاء البرمجة الخارجيون](https://docs.github.com/en/copilot/concepts/agents/about-third-party-coding-agents) | يمكن إسناد مهمة لوكيل خارجي ينتج Pull Request ويطلب مراجعة. | أي محول GitHub في Hub ينتهي عند PR ومراجعته، لا دمج أو دفع خفي. |
| [GitHub: وكيل Copilot السحابي](https://docs.github.com/copilot/concepts/agents/cloud-agent/about-cloud-agent) | يتعامل الوكيل مع بحث المستودع والخطة والتغييرات في بيئة مؤقتة على فرع، مع حدود زمنية وتكلفة. | يحتفظ Hub بحالة الجلسة والأدلة والحدود؛ ولا ينسخ بيئة التنفيذ السحابية داخل التطبيق. |
| [GitHub: Agentic Workflows](https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows) | الحماية تبدأ بالقراءة فقط، وتقتصر الكتابة على safe outputs معلنة. | أي تشغيل حدثي مؤجل يحتاج مخرجات آمنة معلنة وميزانية مستقلة ومراجعة بشرية. |
| [OpenHands Software Agent SDK](https://docs.openhands.dev/sdk) | يوفر واجهات تشغيل محلية/سحابية وأدوات مثل shell والملفات والويب وMCP. | يعامل كـ **محرك خارجي عالي الخطورة** خلف Adapter ولا يمنح صلاحيات محلية مباشرة. |
| [OpenHands SDLC Integration](https://docs.openhands.dev/openhands/usage/essential-guidelines/sdlc-integration) | يدعم التخطيط والبناء والاختبار والمراجعة وCI/CD. | يبدأ التكامل في وضع قراءة/اقتراح/PR، ثم يتوسع فقط بعد إثبات Runner وE2E. |
| [MCP Specification](https://modelcontextprotocol.io/specification/2026-07-28) | يوحد موارد السياق، prompts والأدوات عبر Host/Client/Server ويتطلب موافقة واضحة على الأدوات. | يبنى MCP Registry داخل Hub بقوائم سماح وقدرات معلنة وموافقات منفصلة لكل tool. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices) | توثق مخاطر SSRF وتمرير الرموز وخوادم MCP المحلية غير الموثوقة. | يمنع اكتشاف URL الحر، ويمتنع عن token passthrough، ويعرض الأمر المحلي كاملاً قبل الموافقة ويعزل التشغيل. |

## قواعد اقتباس داخل مخطط المشروع

1. تستخدم هذه الروابط لإسناد **حقائق التكامل** فقط؛ لا تقرر صلاحية موصل أو تكلفة أو موافقة تلقائياً.
2. أي معلومة من الويب أو README أو Issue تدخل أولاً كـ **معرفة غير موثوقة** وتخضع للتنقيح والتصنيف.
3. يلزم عند تنفيذ موصل خارجي ربط كل جلسة بمعرّف محرك، نطاق وصول، مصدر سرّ آمن، سقف تكلفة، وقرار مالك قابل للتدقيق.
