const SUPABASE_URL = "https://kjuixjdtqwcsnexfftrt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0gV5EcweIT-Tnblpx9-upQ_7g-vPvPG";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let isAdmin = false;

async function initApp() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    if (currentUser) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

        if (profile && profile.role === 'admin') {
            isAdmin = true;
        }
    }
    loadPosts();
}

async function loadPosts() {
    const feed = document.getElementById('feed-container');
    if (!feed) return;

    const { data: posts, error } = await supabase
        .from('posts')
        .select(`
            *,
            likes(count),
            comments(id, content, created_at, user_id)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("خطأ في جلب المنشورات:", error.message);
        return;
    }

    feed.innerHTML = '';
    posts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'post-card';
        postElement.innerHTML = `
            <div class="post-header">
                <span>مستخدم الواحة</span>
                ${(isAdmin || (currentUser && currentUser.id === post.user_id)) 
                    ? `<button class="delete-btn" onclick="deletePost('${post.id}')">حذف 🗑️</button>` 
                    : ''}
            </div>
            <p class="post-content">${post.content}</p>
            ${post.media_url ? `<img src="${post.media_url}" class="post-media" />` : ''}
            
            <div class="post-actions">
                <button onclick="toggleLike('${post.id}')">❤️ ${post.likes ? post.likes[0].count : 0} إعجاب</button>
                <button onclick="toggleCommentBox('${post.id}')">💬 تعليق</button>
                <button onclick="sharePost('${post.id}')">🔄 مشاركة</button>
            </div>

            <div id="comments-${post.id}" class="comments-section" style="display:none;">
                <div class="comments-list">
                    ${post.comments ? post.comments.map(c => `<p class="comment-item"><b>تعليق:</b> ${c.content}</p>`).join('') : ''}
                </div>
                <div class="add-comment">
                    <input type="text" id="input-comment-${post.id}" placeholder="اكتب تعليقاً..." />
                    <button onclick="addComment('${post.id}')">إرسال</button>
                </div>
            </div>
        `;
        feed.appendChild(postElement);
    });
}

async function toggleLike(postId) {
    if (!currentUser) return alert("يرجى تسجيل الدخول أولاً للتفاعل");
    
    const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

    if (existingLike) {
        await supabase.from('likes').delete().eq('id', existingLike.id);
    } else {
        await supabase.from('likes').insert([{ post_id: postId, user_id: currentUser.id }]);
    }
    loadPosts();
}

async function addComment(postId) {
    if (!currentUser) return alert("يرجى تسجيل الدخول أولاً");
    const input = document.getElementById(`input-comment-${postId}`);
    if (!input || !input.value.trim()) return;

    await supabase.from('comments').insert([{
        post_id: postId,
        user_id: currentUser.id,
        content: input.value.trim()
    }]);

    input.value = '';
    loadPosts();
}

function toggleCommentBox(postId) {
    const box = document.getElementById(`comments-${postId}`);
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function deletePost(postId) {
    if (!confirm("هل أنت تأكد من حذف هذا المنشور؟")) return;
    await supabase.from('posts').delete().eq('id', postId);
    loadPosts();
}

function sharePost(postId) {
    if (navigator.share) {
        navigator.share({ title: 'Alwaha Pro', url: window.location.href });
    } else {
        alert("تم نسخ رابط التطبيق للمشاركة!");
    }
}

document.addEventListener('DOMContentLoaded', initApp);
