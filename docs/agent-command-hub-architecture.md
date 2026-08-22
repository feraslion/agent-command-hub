# المخطط المعماري الحي

يعرض هذا المخطط المسار الفعلي بين تطبيق الجوال والحوكمة وطبقة النماذج وتخزين الأدلة. العناصر ذات الخط المتصل تعمل داخل المشروع أو تتطلب قراراً واضحاً قبل تنفيذها. أما الأسهم المنقطة فتمثل قدرات مجهزة فقط؛ لا تملك اعتماداً أو جدولة أو بيئة Docker مثبتة بعد.

![مخطط Agent Command Hub المعماري](./agent-command-hub-architecture.png)

```mermaid
flowchart TB
  Owner["المالك · تطبيق جوال عربي"] --> API["tRPC · API محمي"]
  API --> Context["حزمة سياق منقحة"]
  Context --> Roles["أدوار LLM منظمة"]
  Roles --> Artifact["Artifact JSON منقح"]
  Artifact --> Storage["تخزين مرفق مملوك"]
  Roles --> Alert["تنبيه المالك"]
  API --> Request["طلب تنفيذ معتمد فقط"]
  Request --> Runner["Runner محلي · Docker مقيد"]
  API --> Research["Public APIs · بحث واحد محكوم"]
  Schedule["ملخص دوري"] -. معطل حتى النشر والاعتماد .-> API
  Connector["موصلات وManus API"] -. معطلة حتى اعتماد صريح .-> API
```

ملف المصدر `agent-command-hub-architecture.mmd` هو المرجع القابل للتعديل. يمكن إعادة توليد الصورة منه عند تغيير مسار الحوكمة أو Runner أو الموصلات.
