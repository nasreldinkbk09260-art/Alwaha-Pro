import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard(session.user);
    initApp(session.user);
  } else {
    showAuthForms();
  }
});

function initApp(user) {
  fetchPosts();
  fetchMessages(user.id);
  setupRealtimeListeners(user.id);
}

document.getElementById('create-post-btn')?.addEventListener('click', async () => {
  const content = document.getElementById('post-content')?.value;
  const { data: { user } } = await supabase.auth.getUser();

  if (!content) return alert('يرجى كتابة نص المنشور');

  const { error } = await supabase
    .from('posts')
    .insert([{ user_id: user.id, content }]);

  if (error) alert('خطأ في النشر: ' + error.message);
  else {
    document.getElementById('post-content').value = '';
    fetchPosts();
  }
});

document.getElementById('send-msg-btn')?.addEventListener('click', async () => {
  const text = document.getElementById('message-input')?.value;
  const receiverId = document.getElementById('receiver-id-input')?.value;
  const { data: { user } } = await supabase.auth.getUser();

  if (!text || !receiverId) return alert('يرجى تحديد المستقبل وكتابة الرسالة');

  const { error } = await supabase
    .from('messages')
    .insert([{ sender_id: user.id, receiver_id: receiverId, text }]);

  if (error) alert('خطأ في إرسال الرسالة: ' + error.message);
  else {
    document.getElementById('message-input').value = '';
    fetchMessages(user.id);
  }
});

async function fetchPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return console.error(error);

  container.innerHTML = posts.map(p => `
    <div class="post-card" id="post-${p.id}">
      <p>${p.content}</p>
      <button onclick="likePost('${p.id}')">❤️ إعجاب</button>
    </div>
  `).join('');
}

window.likePost = async (postId) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('likes')
    .insert([{ post_id: postId, user_id: user.id }]);

  if (error) alert('تم الإعجاب مسبقاً أو حدث خطأ');
  else alert('تم تسجيل الإعجاب!');
};

async function fetchMessages(userId) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: true });

  if (error) return console.error(error);

  container.innerHTML = messages.map(m => `
    <div class="message-bubble ${m.sender_id === userId ? 'sent' : 'received'}">
      <p>${m.text}</p>
    </div>
  `).join('');
}

function setupRealtimeListeners(userId) {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      if (payload.new.receiver_id === userId || payload.new.sender_id === userId) {
        fetchMessages(userId);
      }
    })
    .subscribe();
}

function showDashboard(user) {
  document.getElementById('auth-container')?.classList.add('hidden');
  document.getElementById('dashboard-container')?.classList.remove('hidden');
}

function showAuthForms() {
  document.getElementById('auth-container')?.classList.remove('hidden');
  document.getElementById('dashboard-container')?.classList.add('hidden');
}
