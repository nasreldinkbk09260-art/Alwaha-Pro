import requests

SUPABASE_URL = "https://fylbbybclbeunmrcscqy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bGJieWJjbGJldW5tcmNzY3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Mzg3NzMsImV4cCI6MjA5NTUxNDc3M30.E-f7VstD2g-uGjE6_z8-VvL6R7Fz3f7eF6K9W2vL8Z4"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

tables = ["posts", "products", "profiles", "messages"]

print("========================================")
print("🔍 جاري فحص جداول Supabase وشبكة البيانات...")
print("========================================\n")

for table in tables:
    url = f"{SUPABASE_URL}/rest/v1/{table}?limit=1"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ الجدول [{table}]: متصل بنجاح!")
        if data:
            print(f"   📋 الأعمدة المكتشفة: {list(data[0].keys())}")
        else:
            print("   ⚠️ الجدول فارغ (جاهز لاستقبال البيانات)")
    else:
        print(f"❌ الجدول [{table}]: لم يتم العثور عليه أو بحاجة لإنشاء (رمز: {response.status_code})")

print("\n========================================")
print("🎯 تم اكتمال الفحص الشامل!")
print("========================================")
