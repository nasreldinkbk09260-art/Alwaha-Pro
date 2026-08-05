// 1. التحقق من الجلسة عند فتح التطبيق
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof supabase !== 'undefined') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showDashboard(session.user);
    } else {
      showAuthForms();
    }
  }
});

// 2. زر تسجيل الدخول
document.getElementById('login-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    alert('يرجى كتابة البريد وكلمة المرور');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('خطأ في الدخول: ' + error.message);
  } else {
    alert('تم تسجيل الدخول بنجاح!');
    showDashboard(data.user);
  }
});

// 3. زر إنشاء حساب جديد
document.getElementById('signup-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email')?.value;
  const password = document.getElementById('signup-password')?.value;

  if (!email || !password) {
    alert('يرجى كتابة البريد وكلمة المرور');
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    alert('خطأ في التسجيل: ' + error.message);
  } else {
    alert('تم إنشاء الحساب بنجاح!');
  }
});

// 4. زر تسجيل الخروج
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.reload();
});

function showDashboard(user) {
  const authBox = document.getElementById('auth-container');
  const dashBox = document.getElementById('dashboard-container');
  if (authBox) authBox.style.display = 'none';
  if (dashBox) dashBox.style.display = 'block';
}

function showAuthForms() {
  const authBox = document.getElementById('auth-container');
  const dashBox = document.getElementById('dashboard-container');
  if (authBox) authBox.style.display = 'block';
  if (dashBox) dashBox.style.display = 'none';
}
