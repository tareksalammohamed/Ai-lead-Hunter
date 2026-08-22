# AI Lead Hunter — Android Release Guide

## Project identity

- App name: **AI Lead Hunter**
- Application ID: `com.aileadhunter.app`
- Version: `1.0.0`
- Web directory: `dist`

## Local development

```bash
npm install
npm run build
npm run cap:sync
npm run cap:open:android
```

افتح مجلد `android` في Android Studio. لا تضف مفاتيح API أو مفاتيح توقيع إلى المشروع.

## Build artifacts

لإنشاء Debug APK:

```bash
npm run android:build
```

لإنشاء Release APK غير موقع:

```bash
npm run android:build:release
```

لإنشاء Release Android App Bundle:

```bash
npm run android:aab
```

تظهر الملفات في:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

## Release signing

أنشئ Keystore خارج المستودع، ثم استخدم Android Studio **Build > Generate Signed Bundle / APK**. احفظ كلمة المرور وملف Keystore في مدير أسرار أو مخزن آمن، ولا تضعها في Git أو `.env` الخاص بالواجهة.

## Security and data behavior

Service Worker يخزن App Shell والأصول الثابتة فقط. لا يتم تخزين بيانات العملاء أو ردود AI أو كتابات Supabase في Cache عامة. عمليات AI والبحث والكتابة تتطلب اتصالاً بالإنترنت.

## Verification status

تم التحقق من `npm run build` و`npx cap sync android` وبناء Debug APK وRelease APK وRelease AAB في بيئة التطوير. تم استخدام Android SDK 36 وBuild Tools 35/36 دون إضافة أي signing key إلى المشروع.
