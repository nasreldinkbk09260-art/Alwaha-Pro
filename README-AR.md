# Alwaha-Pro 3.0.2 — R7.3 Release Candidate Source

R7.3 هي نقطة المصدر الموحدة بعد مصالحة إصلاحات 3.0.1 الأخيرة وتطويرات 3.0.2. ابدأ بقراءة `ALWAHA-PRO-MASTER-NOTEBOOK-AR.md` ثم `docs/CONTINUITY-STATE-20261102-R7.3-AR.md`.

- الفرع المستهدف: `alwaha-pro-3.0.2-release-r7.3-20261102`.
- لا ترفع إلى `main` ولا تشغّل `supabase db push`.
- استخدم سكربت واحد: `bash ./TERMUX-PUSH-3.0.2-R7.3-20261102.sh` بعد فك الحزمة في Termux.
- سكربت Termux يتحقق من الملف والهوية ويقوم بالرفع فقط. GitHub Actions يعيد SQL regression والتدقيقات والبناء الموقّع.
- Web Pages workflow manual build-only. Supabase history guard manual/non-deploying.

هذه **Release Candidate Source** وليست إصداراً رسمياً حتى نجاح Actions/SQL والتوقيع واختبار الهاتفين وشبكتين ومصالحة Supabase production.


خريطة مصادر الدردشات والإصلاحات: `docs/CHAT-CONTINUITY-SOURCE-MAP-R7.3-AR.md` — تشرح ما تمت مقارنته فعلياً وحدود الملفات التي أمكن استعادتها.
