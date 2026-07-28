#!/bin/bash
echo "=================================================="
echo "🔍 فحص حالة مشروع الواحة (Alwaha Pro)"
echo "=================================================="
echo ""

# 1. فحص ملفات المشروع الرئيسية
echo "📌 [1] فحص الملفات الهيكلية:"
files=("index.html" "app.js" "style.css" "manifest.json" "sw.js" "privacy.html")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file" 2>/dev/null || echo "0")
        echo "  ✅ $file (موجود - $lines خط)"
    else
        echo "  ❌ $file (غير موجود!)"
    fi
done
echo ""

# 2. فحص ملفات GitHub Workflows
echo "📌 [2] فحص سير العمل (GitHub Workflows):"
if [ -d ".github/workflows" ]; then
    echo "  ✅ مجلد workflows موجود. الملفات بداخله:"
    ls -1 .github/workflows
else
    echo "  ❌ مجلد .github/workflows غير موجود!"
fi
echo ""

# 3. فحص ربط Supabase
echo "📌 [3] فحص إعدادات Supabase داخل app.js:"
if [ -f "app.js" ]; then
    URL=$(grep -oE "https://[a-zA-Z0-9\.-]+\.supabase\.co" app.js | head -n 1)
    if [ -n "$URL" ]; then
        echo "  ✅ تم العثور على URL السيرفر: $URL"
    else
        echo "  ⚠️ لم يتم العثور على رابط URL مباشر لـ Supabase"
    fi

    if grep -q "createClient" app.js; then
        echo "  ✅ تهيئة Supabase Client موجودة"
    else
        echo "  ⚠️ كود createClient غير مكتمل أو مفقود"
    fi
else
    echo "  ❌ ملف app.js غير موجود لمراجعته"
fi
echo ""

# 4. فحص حالة Git
echo "📌 [4] حالة مستودع Git المحلي:"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "  🔹 الفرع الحالي: $(git branch --show-current)"
    echo "  🔹 التغييرات غير المرفوعة:"
    git status -s
else
    echo "  ⚠️ المجلد الحالي ليس مستودع Git"
fi

echo ""
echo "=================================================="
echo "✅ انتهى الفحص! انسخ النتيجة وأرسلها لي هنا."
echo "=================================================="
