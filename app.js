import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. التحقق من الجلسة وإعادة التوجيه التلقائي
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard(session.user);
    fetchPosts(); // جلب المنشورات عند فتح التطبيق
  } else {
    showAuthForms();
  }
});

// 2. زر إنشاء منشور جديد وحفظه حقيقياً في Supabase
document.getElementById('create-post-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const postContent = document.getElementById('post-content')?.value;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('يرجى تسجيل الدخول أولاً');

  if (!postContent) return alert('اكتب شيئاً لنشره');

  const { data, error } = await supabase
    .from('posts') // اسم جدول المنشورات
    .insert([{ user_id: user.id, content: postContent, created_at: new Date() }]);

  if (error) {
    alert('خطأ أثناء النشر: ' + error.message);
  } else {
    alert('تم نشر المنشور بنجاح!');
    document.getElementById('post-content').value = '';
    fetchPosts(); // تحديث القائمة فوراً
  }
});

// 3. دالة جلب كل المنشورات من Supabase وعرضها
async function fetchPosts() {
  const postsContainer = document.getElementById('posts-container');
  if (!postsContainer) return;

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('خطأ في جلب المنشورات:', error.message);
    return;
  }

  postsContainer.innerHTML = '';
  posts.forEach(post => {
    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    postElement.innerHTML = `
      <p>${post.content}</p>
      <button onclick="likePost('${post.id}')">❤️ إعجاب</button>
    `;
    postsContainer.appendChild(postElement);
  });
}

function showDashboard(user) {
  document.getElementById('auth-container')?.classList.add('hidden');
  document.getElementById('dashboard-container')?.classList.remove('hidden');
}

function showAuthForms() {
  document.getElementById('auth-container')?.classList.remove('hidden');
  document.getElementById('dashboard-container')?.classList.add('hidden');
}
