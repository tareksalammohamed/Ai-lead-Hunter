# تنفيذ SMART AI ROUTER & FAILOVER ENGINE

تم تنفيذ طبقة Smart AI Router داخل تطبيق **AI Lead Hunter** مع الحفاظ على المعمارية الحالية وإضافة مسار آمن عبر Supabase Edge Functions.

## ما تم تنفيذه

أصبح كل طلب AI يمر عبر عقد موحد يحتوي على `task_id` و`job_id` و`input_state` و`structured_schema` و`idempotency_key`. يُحفظ السياق canonical state قبل التحويل، وتُسجل المحاولات والأخطاء والـfallbacks والـlatency والاستهلاك في Supabase.

تمت إضافة adapters موحدة لـOpenRouter وOpenAI وGemini وAnthropic وHugging Face، مع دعم structured output وstream contract وhealth check. يستخدم OpenRouter وضع `openrouter/free` عند تفعيله، ويضمّن fallback models داخل الطلب، بينما يُبنى الترتيب النهائي خادمياً من إعدادات Supabase وصحة النماذج وCircuit Breaker.

تمت إضافة تصنيفات موحدة للأخطاء، وإعادة محاولة بتأخير أسي، وGlobal Failover، وContext Compression، وCheckpoint Restore، وIdempotency لتجنب تكرار العمل. كما تم تعديل executeJob ليحفظ العملاء والـraw records تدريجياً، ويستأنف البحث من السجلات المحفوظة بدلاً من إعادة البحث من البداية.

## Supabase

أُضيفت ترحيلات:

| الترحيل | الغرض |
|---|---|
| `20260821140000_smart_ai_router.sql` | الجداول والحقول والسياسات والإعدادات الافتراضية |
| `20260821141000_smart_ai_router_indexes.sql` | فهارس مفاتيح العلاقات الجديدة |

الجداول الجديدة هي `ai_task_checkpoints` و`ai_provider_health` و`ai_model_health` و`ai_routing_rules` و`ai_routing_events` و`ai_context_snapshots` و`ai_circuit_breakers`. كما تم توسيع `ai_runs` و`research_jobs` و`research_job_steps` و`admin_ai_providers`.

تم نشر الدوال التالية على مشروع Supabase `hbpjkomkbtpiciioqggn` مع `verify_jwt = true`:

| الدالة | الوظيفة |
|---|---|
| `ai-orchestrator` | التنفيذ، adapters، retries، failover، checkpoints، health، circuit breaker |
| `openrouter-model-discovery` | جلب `/api/v1/models` وتحديث Free Model Pool |
| `admin-user-management` | الدالة الإدارية السابقة |

## واجهة Super Admin

أُضيفت صفحة **AI Reliability Center** إلى لوحة Super Admin، وتعرض صحة المزودين والنماذج، Fallbacks Today، Successful Recoveries، Failed Recoveries، متوسط latency، Free/Paid Requests، وسجل Agent Console. كما تتضمن Refresh Models واختبارات محاكاة لفشل OpenRouter وGemini وtimeout وcontext compression.

## التحقق

تم اجتياز `npm run typecheck` و`npm run build`. فحص Supabase الأمني لم يعرض lints. فحص الأداء أزال تنبيهات المفاتيح الأجنبية الجديدة، وتبقى فقط تنبيهات `unused_index` المعلوماتية السابقة أو الناتجة عن عدم وجود بيانات تشغيلية بعد.

اختبار الإنتاج الحقيقي يحتاج إلى جلسة مستخدم مصادق عليها ومفاتيح مزودي AI مضبوطة كـSupabase secrets، مثل `OPENROUTER_API_KEY` و`GEMINI_API_KEY` أو `GOOGLE_API_KEY` و`OPENAI_API_KEY` و`ANTHROPIC_API_KEY` و`HUGGINGFACE_API_KEY`. لا توجد أي مفاتيح سرية داخل المستودع.

## التشغيل

بعد إضافة مفاتيح المزودين في Secrets الخاصة بمشروع Supabase، افتح لوحة Super Admin ثم **مركز اعتمادية AI** واضغط **Refresh Models**. بعدها يمكن تشغيل اختبارات Failover من نفس الصفحة، ومراجعة checkpoints والأحداث في Agent Console.
