# نتائج QA — Alwaha-Pro 3.0.2 R3

**تاريخ آخر تشغيل:** 2 نوفمبر 2026 — R3 مراجعة نهائية
**نوع الاختبار:** فحوص مصدر ساكنة محلية؛ لم يُرفع المرشح بعد إلى GitHub.

## نتائج PASS

| البوابة | النتيجة |
|---|---|
| JSON للحزم والمانيفست وCapacitor | PASS |
| `node --check` لملفات JS/MJS وحزمة Supabase UMD | PASS |
| كتل JavaScript المضمنة في `index.html` | 3 كتل — PASS |
| `npm run audit:release` | PASS |
| `npm run audit:chat` | PASS — 50 تحققاً |
| `npm run audit:compatibility` | PASS |
| `npm run audit:performance` | PASS |
| `npm run audit:field-repair` | PASS — 140 DOM IDs بلا تكرار |
| `npm run audit:native-call-ui` | PASS — 5 تحققّات |
| `npm run audit:ui` | PASS — 244 استدعاء حدث inline إلى 116 اسماً وظيفياً؛ لا مدخل للشبكة المحلية |
| `npm run audit:retention-kids-vault` | PASS — 32 تحققاً |
| `npm run prebuild` | PASS — 41 مورداً محلياً متحققاً منها |
| `bash -n` لسكريبت Termux والاختبار SQL CI | PASS |
| تحليل YAML لسير GitHub Actions | PASS |

## نتائج غير مكتملة أو تنتظر CI

- `npm run build`: جُرّب فعلياً وتوقف لأن `esbuild` غير موجود في بيئة الحاوية. لم يُنتج `dist`.
- تثبيت npm: لم يكتمل في بيئة التجهيز السابقة بسبب تعذر DNS/الوصول إلى سجل npm؛ GitHub Actions سيجرب `npm ci` من runner متصل.
- `npm audit --audit-level=high`: مربوط في CI، ولم يُنفذ محلياً بسبب عدم توفر الشبكة.
- `scripts/ci-validate-supabase-sql.sh`: تمت كتابة بوابة PostgreSQL 16 مؤقتة واختبار سلوك البيع/الضمان/الأرشفة/النزاعات، لكن لم تُشغّل في هذه الحاوية لأنها لا تحتوي `psql`/PostgreSQL. ستعمل على GitHub Actions قبل Android build. واجهة pg_cron ممثلة بـtest double؛ لا يثبت هذا تشغيل امتداد pg_cron في Supabase الحقيقي.
- إنشاء فرع GitHub عبر التكامل أعاد 403 `Resource not accessible by integration`. لا يوجد commit أو push 3.0.2 حتى الآن. يوجد سكربت Termux لرفع الفرع المستقل.
- لا يوجد APK/AAB 3.0.2 موقع أو اختبار جهازين فعلي.
- لم يجر أي تعديل على قاعدة Supabase الإنتاجية.

## حدود يجب ألا تُخفى

- أصل migration تاريخيين مطبقين في الإنتاج غير متاح بعد؛ حارس نشر Supabase يبقى غير ناشر ويوقف أي `db push`.
- `pg_cron` غير مثبت في قاعدة الإنتاج، وترحيل الاحتفاظ لم يُطبق.
- TURN غير مثبت من الأدلة المتاحة؛ دالة `call-config` قد ترجع STUN فقط إذا كانت أسرار TURN غير موجودة.
- وضع الأطفال 2.5D/CSS مع فيديو عائم، وليس تتبع وجه AR أو محاكاة فيزياء/محرك 3D كامل.
- النسخة الاحتياطية لا تضمّن ملفات الوسائط الثنائية ولا تعيد كتابة بيانات السحابة إلى الخادم عند الاستيراد.
- لوحة الإدارة المستقلة خارج ملف المصدر المرفق؛ الموجود واجهة الإدارة المضمنة.
