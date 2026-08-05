// 1. تهيئة الاتصال بـ Supabase
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co'; // استبدل برابط مشروعك
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // استبدل بمفتاح ANON الخاص بك

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
