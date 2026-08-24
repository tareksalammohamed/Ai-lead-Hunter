# إعداد OAuth الآمن لـ LinkedIn وFacebook

يوفر التطبيق تدفق OAuth 2.0 رسميًا: يبدأ المستخدم الربط من صفحة إعدادات المصادر، ثم تتم الموافقة على نطاقات الصلاحيات في موقع المزود، ويُعاد `code` و`state` إلى التطبيق. يُرسل التطبيق هذه القيم إلى Edge Function، التي تتحقق من `state` أحادي الاستخدام، وتبادل `code` مع المزود، ثم تحفظ بيانات الاعتماد مشفّرة في `source_connection_secrets`. لا تُرسل access tokens إلى الواجهة ولا تُحفظ في المستودع.

## عناوين callback

استبدل `APP_ORIGIN` بالنطاق الفعلي المنشور. يجب أن يكون العنوان مسجّلًا حرفيًا في لوحة المزود:

```text
LinkedIn: APP_ORIGIN/oauth/linkedin/callback
Facebook: APP_ORIGIN/oauth/facebook/callback
```

في التطوير المحلي يمكن استخدام:

```text
http://localhost:5173/oauth/linkedin/callback
http://localhost:5173/oauth/facebook/callback
```

## إعداد LinkedIn

أنشئ أو افتح تطبيقًا في [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)، ثم أضف عنوان LinkedIn callback في تبويب **Auth**. فعّل منتج **Sign in with LinkedIn using OpenID Connect**، وابدأ بالنطاقات الأقل المطلوبة: `openid profile email`. هذه النطاقات تمنح التطبيق هوية العضو وملفه الأساسي وبريده عند توفره؛ أما البحث في أعضاء أو شركات LinkedIn فيحتاج منتجًا أو موافقة Partner إضافية ولا يفعّله هذا التدفق تلقائيًا.

ضع القيم التالية كأسرار للخادم فقط:

```text
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_OAUTH_SCOPES=openid profile email
```

## إعداد Meta/Facebook

في [Meta for Developers](https://developers.facebook.com/apps/) أضف عنوان Facebook callback ضمن **Facebook Login > Settings > Valid OAuth Redirect URIs**، ثم فعّل Facebook Login. يستخدم التطبيق `public_profile,email,pages_show_list` افتراضيًا؛ قد تحتاج صلاحيات Pages إلى مراجعة Meta أو حسابات اختبار/أدوار داخل التطبيق. يستخدم التطبيق `GET /me` للتحقق من العضو و`GET /me/accounts` لجلب الصفحات التي يديرها العضو، وليس endpoint بحث عامًا.

ضع القيم التالية كأسرار للخادم فقط:

```text
META_APP_ID=...
META_APP_SECRET=...
META_OAUTH_SCOPES=public_profile,email,pages_show_list
```

## أسرار Supabase Edge Functions

اضبط الأسرار من مدير أسرار Supabase، ولا تضعها في متغيرات `VITE_` أو في ملفات Git:

```text
SOURCE_CONNECTION_SECRET=<قيمة عشوائية طويلة خاصة بالتشفير>
ALLOWED_ORIGINS=APP_ORIGIN
```

يجب أن تكون قيمة `SOURCE_CONNECTION_SECRET` ثابتة أثناء عمر الاتصالات المشفّرة؛ تغييرها يجعل الاتصالات القديمة غير قابلة لفك التشفير. وظيفة `social-oauth` ووظيفة `source-connector-proxy-v2` تستخدمان هذه القيمة على الخادم فقط.

## النشر والتحقق

طبّق migration `20260824100000_social_oauth_connections.sql`، ثم انشر وظيفتي `social-oauth` و`source-connector-proxy-v2`. بعد ذلك افتح الإعدادات، اختر **اتصالات المصادر**، وحدد LinkedIn أو Facebook، ثم اضغط زر OAuth الرسمي. بعد الموافقة يجب أن تعود إلى `/oauth/<provider>/callback` ثم إلى التطبيق، وأن يظهر الاتصال بحالة **متصل**. زر الاختبار لا يعرض الرمز ويعيد رسالة تحقق فقط.

## ملاحظات الصلاحيات

لا يتيح OAuth وحده البحث العام في LinkedIn؛ لذلك يبقى موصل LinkedIn مخصصًا للتحقق من الحساب إلى أن يحصل التطبيق على منتج LinkedIn API مناسب. وبالنسبة إلى Facebook، تقتصر النتائج على صفحات الحساب الذي منح الصلاحية، وفق الصلاحيات التي وافق عليها المستخدم وسمحت بها Meta.

## المراجع الرسمية

1. [LinkedIn Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
2. [LinkedIn Sign in with OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
3. [Meta Access Tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens)
4. [Meta Facebook Login Permissions](https://developers.facebook.com/documentation/facebook-login/guides/permissions)
