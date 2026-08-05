import { supabase } from './supabaseClient.js';

// عند تحميل الصفحة: التحقق من الجلسة
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    loadUserData(session.user);
  }
});

// زر إرسال البيانات / حفظ الحساب
document.getElementById('save-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const inputData = document.getElementById('user-input')?.value;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('يرجى تسجيل الدخول أولاً');

  const { error } = await supabase
    .from('user_data') // اسم الجدول الجديد في Supabase
    .insert([{ user_id: user.id, content: inputData }]);

  if (error) {
    alert('حدث خطأ أثناء الحفظ: ' + error.message);
  } else {
    alert('تم حفظ البيانات بنجاح!');
  }
});

// دالة جلب البيانات وعرضها
async function loadUserData(user) {
  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', user.id);

  if (!error && data) {
    console.log('بيانات المستخدم:', data);
  }
}
