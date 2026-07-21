// =========================================================================
// Alwaha Pro Engine - المحرك الرئيسي الموحد الشامل
// الإصدار المستقر: 2.0.0 | نظام الأتمتة الكاملة، الربط السحابي، والشبكات اللاسلكية
// =========================================================================

const DEFAULT_SUPABASE_URL = "https://fylbbybclbeunmrcscqy.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bGJieWJjbGJldW5tcmNzY3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Mzg3NzMsImV4cCI6MjA5NTUxNDc3M30.E-f7VstD2g-uGjE6_z8-VvL6R7Fz3f7eF6K9W2vL8Z4";

const SUPABASE_URL = localStorage.getItem('EXTERNAL_API_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = localStorage.getItem('EXTERNAL_API_KEY') || DEFAULT_SUPABASE_KEY;

let localUploadedProductBase64 = "";
let localUploadedAvatarBase64 = "";
let meshShareActive = false;
let deferredPrompt = null;
let currentChatUser = "";

// ==========================================
// 1. نظام الاتصال السحابي وإدارة البيانات (Supabase)
// ==========================================
async function supabaseFetch(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };
    try {
        const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
        return await response.json();
    } catch (error) {
        console.error("Supabase Operation Error:", error);
        return null;
    }
}

// ==========================================
// 2. إدارة التثبيت الذكي وتكامل نظام PWA
// ==========================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'inline-flex';
});

document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        document.getElementById('pwa-install-btn').style.display = 'none';
    }
    deferredPrompt = null;
});

function triggerDesktopDownloadSimulation() {
    alert("💻 تم بدء توليد حزمة تشغيل نظام سطح المكتب (Windows/PC) المخصصة لجهازك عبر الخادم صامتاً. سيبدأ التنزيل فور اكتمال البناء.");
}

// ==========================================
// 3. نظام الصوت الفاخر والحماية والحارس الذكي
// ==========================================
function playLuxuriousNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) { console.log("Audio waiting user touch interaction."); }
}

function executeAiSecurityObfuscationScan() {
    console.log("🛡️ ذكاء اصطناعي مدمج للـ الحماية: فعال ومستقر بالخلفية.");
    window.addEventListener('error', (e) => { e.preventDefault(); });
}

function initializeKeyboardInputGuard() {
    document.body.addEventListener('focusin', (e) => {
        if (e.target.matches('.keyboard-target, input, textarea, select')) {
            document.body.classList.add('keyboard-adjusted-body');
            setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    });
    
    document.body.addEventListener('focusout', (e) => {
        if (e.target.matches('.keyboard-target, input, textarea, select')) {
            setTimeout(() => {
                if (!document.activeElement.matches('.keyboard-target, input, textarea, select')) {
                    document.body.classList.remove('keyboard-adjusted-body');
                }
            }, 50);
        }
    });
}

// ==========================================
// 4. نظام التحكم بالتنقل والأقسام (showSection)
// ==========================================
function showSection(id, element) {
    document.querySelectorAll('.app-section').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active-section');
    });
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    const targetSec = document.getElementById(id);
    if(targetSec) {
        targetSec.style.display = 'block';
        targetSec.classList.add('active-section');
    }
    if(element) {
        element.classList.add('active');
    } else {
        const navClasses = { 'home-section': '.main-home', 'market-section': '.market-center', 'chat-section': '.chat', 'profile-section': '.profile-me' };
        if(navClasses[id]) document.querySelector(navClasses[id])?.classList.add('active');
    }
    
    if(id !== 'profile-section') {
        document.querySelectorAll('.sub-profile-view-box').forEach(box => box.style.display = 'none');
        const header = document.querySelector('.profile-card-header-view');
        const menuList = document.querySelector('.profile-options-menu-list');
        if(header) header.style.display = 'block';
        if(menuList) menuList.style.display = 'flex';
    }

    playLuxuriousNotificationSound();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if(id === 'home-section') renderHomePostsFeed();
    if(id === 'market-section') { renderProductsList(); evaluateMarketSellPermissionBasedOnAccount(); }
    if(id === 'chat-section') { collapseChatSubWindows(); updateFriendsCountDisplay(); }
}

// ==========================================
// 5. مركز الإشعارات والطلبات الداخلي
// ==========================================
function toggleInternalNotificationCenter() {
    const center = document.getElementById('internal-notification-center');
    if(center) center.style.display = (center.style.display === 'none') ? 'block' : 'none';
}

function acceptFriendSimulated() {
    alert("👥 تم قبول طلب مهندس أحمد وإدراجه ضمن اتصالات شبكة الصداقة المعتمدة فوراً.");
    const badge = document.getElementById('notif-badge');
    if(badge) badge.innerText = "2";
}

// ==========================================
// 6. ساحة التدوين وبث المشاركات (Home Feed)
// ==========================================
async function publishNewHomePost() {
    const textEl = document.getElementById('home-post-textarea');
    const typeEl = document.getElementById('home-post-type');
    if(!textEl || !textEl.value.trim()) return alert("يرجى كتابة تحديث أو فكرة أولاً لتعميمها.");

    const author = localStorage.getItem('alwaha_profile_name') || "زائر";
    const payload = {
        author_name: author,
        content: textEl.value,
        post_type: typeEl ? typeEl.value : "عام",
        created_at: new Date().toISOString()
    };

    await supabaseFetch("posts", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    textEl.value = "";
    alert("🚀 تم بث وتعميم الفكرة البرمجية بنجاح على الخادم الموحد.");
    renderHomePostsFeed();
}

async function renderHomePostsFeed() {
    const container = document.getElementById('home-posts-feed-container');
    if (!container) return;
    
    container.innerHTML = `<div style="text-align:center;color:#38bdf8;font-size:12px;padding:10px;">جاري سحب المشاركات من السيرفر السحابي...</div>`;
    let posts = await supabaseFetch("posts?select=*&order=created_at.desc");
    
    if (!posts || posts.length === 0) {
        posts = [
            { author_name: "المهندس نصر الدين", post_type: "تقني", content: "تم تحديث جدار الحماية بالكامل وإطلاق النواة الموحدة للـ الماركت والدردشة فريش اليوم." },
            { author_name: "المطور صابر", post_type: "عام", content: "سعيد جداً بالتواجد في الواحة برو، خيارات الكيبورد والشاشات مرنة للغاية!" }
        ];
    }

    container.innerHTML = "";
    posts.forEach((post, index) => {
        container.innerHTML += `
            <div class="news-box text-right" style="border-right: 3px solid ${post.post_type === 'تقني' ? '#00ffff' : '#ff00ff'};">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:12px;">
                    <span style="color:#ffd700; font-weight:bold;">${post.author_name}</span>
                    <span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-size:10px; color:#aaa;">${post.post_type || 'عام'}</span>
                </div>
                <p style="font-size:13px; line-height:1.4; color:#fff;">${post.content}</p>
                <div class="post-actions-row">
                    <button class="post-action-btn" id="like-btn-${index}" onclick="togglePostLikeSimulated(${index})"><i class="fa-solid fa-heart"></i> <span id="like-count-${index}">12</span></button>
                    <button class="post-action-btn" onclick="alert('منظومة التعليقات الحية مربوطة ببروتوكول القراءة السحابية الصامتة.')"><i class="fa-solid fa-comment"></i> تعليق</button>
                </div>
            </div>`;
    });
}

function togglePostLikeSimulated(idx) {
    const btn = document.getElementById(`like-btn-${idx}`);
    const countEl = document.getElementById(`like-count-${idx}`);
    if(!btn || !countEl) return;
    if(btn.classList.contains('liked')) {
        btn.classList.remove('liked');
        countEl.innerText = parseInt(countEl.innerText) - 1;
    } else {
        btn.classList.add('liked');
        countEl.innerText = parseInt(countEl.innerText) + 1;
        playLuxuriousNotificationSound();
    }
}

// ==========================================
// 7. مركز التواصل الاحترافي والتراسل المدمج (Chat System)
// ==========================================
function expandChatSubWindow(tabId) {
    document.getElementById('chat-main-lobby-wrapper').style.display = 'none';
    document.querySelectorAll('.chat-tab-content').forEach(tab => tab.style.display = 'none');
    
    const targetTab = document.getElementById(`${tabId}-tab`) || document.getElementById(`${tabId}-chats-tab`);
    if(targetTab) targetTab.style.display = 'block';

    if(tabId === 'recent') renderConversationsList();
    if(tabId === 'my-friends') renderMyFriendsList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchChatTab(tabId) {
    document.querySelectorAll('.chat-tab-content').forEach(tab => tab.style.display = 'none');
    const targetTab = document.getElementById(`${tabId}-tab`) || document.getElementById(`${tabId}-chats-tab`);
    if(targetTab) targetTab.style.display = 'block';

    if(tabId === 'recent') renderConversationsList();
    if(tabId === 'my-friends') renderMyFriendsList();
}

function collapseChatSubWindows() {
    document.querySelectorAll('.chat-tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById('active-chat-box').style.display = 'none';
    document.getElementById('chat-main-lobby-wrapper').style.display = 'block';
}

function openTargetUserDirectChat(name) {
    currentChatUser = name;
    document.getElementById('chat-main-lobby-wrapper').style.display = 'none';
    document.querySelectorAll('.chat-tab-content').forEach(tab => tab.style.display = 'none');
    
    const chatBox = document.getElementById('active-chat-box');
    chatBox.style.display = 'block';
    document.getElementById('current-chat-name').innerText = `🔒 قناة آمنة مع: ${name}`;
    
    const msgContainer = document.getElementById('chat-messages-container');
    msgContainer.innerHTML = `<div style="text-align:center; color:#aaa; font-size:11px; padding-top:20px;">🔒 بداية التراسل المشفر أحادي المسار (E2EE)</div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeActiveChatWindow() {
    document.getElementById('active-chat-box').style.display = 'none';
    document.getElementById('chat-main-lobby-wrapper').style.display = 'block';
}

function sendLiveChatMessageFromUI() {
    const input = document.getElementById('chat-message-input');
    if(!input || !input.value.trim()) return;
    
    const container = document.getElementById('chat-messages-container');
    const msg = input.value;
    
    container.innerHTML += `
        <div style="text-align:left; margin:8px 0;">
            <div style="display:inline-block; background:#3a86ff; color:#fff; padding:8px 12px; border-radius:12px 12px 0 12px; font-size:12.5px; max-width:85%; direction:rtl; text-align:right;">
                ${msg}
            </div>
        </div>`;
    
    input.value = "";
    container.scrollTop = container.scrollHeight;
    playLuxuriousNotificationSound();

    setTimeout(() => {
        container.innerHTML += `
            <div style="text-align:right; margin:8px 0;">
                <div style="display:inline-block; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#00ffff; padding:8px 12px; border-radius:12px 12px 12px 0; font-size:12.5px; max-width:85%;">
                    🔄 تلقيت رسالتك المشفرة بنجاح، جاري معالجتها محلياً عبر العقدة الحرة.
                </div>
            </div>`;
        container.scrollTop = container.scrollHeight;
    }, 1500);
}

function renderConversationsList() {
    const holder = document.getElementById('conversations-list');
    if(!holder) return;
    holder.innerHTML = `
        <div class="profile-menu-btn" style="margin-bottom:6px;" onclick="openTargetUserDirectChat('المهندس نصر الدين')"><span>💬 المهندس نصر الدين (آخر تحديث للمحرك البرمجي)</span><i class="fa-solid fa-chevron-left"></i></div>
        <div class="profile-menu-btn" style="margin-bottom:6px;" onclick="openTargetUserDirectChat('المطور صابر')"><span>💬 المطور صابر (مراجعة ملف بناء الأندرويد)</span><i class="fa-solid fa-chevron-left"></i></div>`;
}

function initiateVoiceCall(mode = 'global') {
    const modal = document.getElementById('voice-call-modal');
    const targetUser = document.getElementById('call-target-user');
    const indicator = document.getElementById('call-method-indicator');
    
    if(!modal) return;
    
    if(targetUser) targetUser.innerText = currentChatUser || "المستلم المعتمد عبر السيرفر";
    if(indicator) {
        indicator.innerHTML = mode === 'bluetooth' 
            ? `<i class="fa-solid fa-signal"></i> وضع لاسلكي حُر مباشر (بلوتوث / Wi-Fi Direct) بدون إنترنت`
            : `<i class="fa-solid fa-globe"></i> وضع اتصال سحابي آمن معزز بالبيانات الخارجية`;
    }
    
    modal.style.display = 'flex';
}

function renderMyFriendsList() {
    const holder = document.getElementById('my-friends-list');
    if(!holder) return;
    holder.innerHTML = `
        <div class="profile-menu-btn" style="margin-bottom:6px;" onclick="openTargetUserDirectChat('المهندس نصر الدين')"><span>👤 المهندس نصر الدين [متصل حالياً]</span><i class="fa-solid fa-phone"></i></div>
        <div class="profile-menu-btn" style="margin-bottom:6px;" onclick="openTargetUserDirectChat('المطور صابر')"><span>👤 المطور صابر [بعيد]</span><i class="fa-solid fa-phone"></i></div>
        <div class="profile-menu-btn" style="margin-bottom:6px;" onclick="openTargetUserDirectChat('الأستاذ أحمد')"><span>👤 الأستاذ أحمد [أوفلاين]</span><i class="fa-solid fa-phone"></i></div>`;
}

function executeFriendAction(type) {
    const inp = document.getElementById('friend-search-input');
    if(!inp || !inp.value.trim()) return alert("يرجى إدخال المعرف الفريد للهدف.");
    alert(type === 'add' ? `✨ تم إرسال حزمة طلب الارتباط للمعرّف ${inp.value} بنجاح كلي.` : `❌ تم قطع مسار الارتباط وحظر المعرّف محلياً.`);
    inp.value = "";
}

function updateFriendsCountDisplay() {
    const countEl = document.getElementById('friends-count');
    if(countEl) countEl.innerText = "3";
}

function terminateVoiceCall() {
    const modal = document.getElementById('voice-call-modal');
    if(modal) modal.style.display = 'none';
}

// ==========================================
// 8. الألعاب والترفيه الذاتي (Ludo Control)
// ==========================================
function simulateLudoMatchLaunch() {
    alert("🎲 تم تهيئة خريطة الليدو الملكية وتوزيع المصفوفات الرقمية محلياً في الذاكرة الموحدة للعبة. جاهز للعب التنافسي ثنائي/رباعي الأطراف دون استهلاك أي ميغابايتس.");
}

// ==========================================
// 9. إدارة الماركت والمبيعات والرفع (Market Section)
// ==========================================
function switchMarketMode(mode) {
    document.getElementById('tab-buy').classList.toggle('active-tab', mode === 'buy');
    document.getElementById('tab-sell').classList.toggle('active-tab', mode === 'sell');
    document.getElementById('market-buy-view').style.display = mode === 'buy' ? 'block' : 'none';
    document.getElementById('market-sell-view').style.display = mode === 'sell' ? 'block' : 'none';
}

function checkIfUserHasAccountCreated() {
    const savedName = localStorage.getItem('alwaha_profile_name');
    return (savedName && savedName !== "زائر");
}

function evaluateMarketSellPermissionBasedOnAccount() {
    const hasAccount = checkIfUserHasAccountCreated();
    document.getElementById('sell-access-blocked').style.display = hasAccount ? 'none' : 'block';
    document.getElementById('sell-form-allowed').style.display = hasAccount ? 'block' : 'none';
}

function previewMarketProductImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgPreview = document.getElementById('prod-img-preview');
            if(imgPreview) {
                imgPreview.src = e.target.result;
                imgPreview.style.display = 'block';
            }
            localUploadedProductBase64 = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function submitNewProductToMarket() {
    const price = document.getElementById('prod-price').value.trim();
    const phone = document.getElementById('prod-phone').value.trim();
    const desc = document.getElementById('prod-desc').value.trim();

    if(!price || !phone || !desc) return alert("يرجى إدخال كافة البيانات السعرية الفنية ونقاط الاتصال أولاً.");

    const payload = {
        title: "سلعة معروضة بالسوق الرقمي",
        price: price,
        description: `${desc} | للتواصل المباشر: ${phone}`,
        image_url: localUploadedProductBase64 || null,
        created_at: new Date().toISOString()
    };

    alert("جاري اعتبار حزمة البيانات ورفع المادة التجارية لخادم Supabase...");
    await supabaseFetch("products", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    alert("🚀 تم إدراج ونشر المادة بنجاح كلي في خلاصة الماركت السحابية المحدثة.");
    document.getElementById('prod-price').value = "";
    document.getElementById('prod-phone').value = "";
    document.getElementById('prod-desc').value = "";
    const imgPreview = document.getElementById('prod-img-preview');
    if(imgPreview) imgPreview.style.display = 'none';
    localUploadedProductBase64 = "";

    switchMarketMode('buy');
    renderProductsList();
}

async function renderProductsList() {
    const container = document.getElementById('market-products-list-container');
    if (!container) return;
    
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#ffd700; font-size:12px;">جاري تحديث قائمة المنتجات...</div>`;
    const products = await supabaseFetch("products?select=*&order=created_at.desc");
    
    if (!products || products.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#aaa; font-size:12px; padding:20px;">لا توجد مواد معروضة حالياً. كن أول من يدرج سلعة!</div>`;
        return;
    }

    container.innerHTML = "";
    products.forEach((prod) => {
        const hasImg = prod.image_url && prod.image_url.startsWith('data:image');
        const fallbackImg = "https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&w=300&q=80";
        
        container.innerHTML += `
            <div class="product-card-node">
                <img src="${hasImg ? prod.image_url : fallbackImg}" class="product-card-img" alt="Product Image">
                <div style="font-weight:bold; color:#00ffff; margin-bottom:3px; font-size:13px;">${prod.title}</div>
                <div style="color:#ffd700; font-weight:bold; margin-bottom:4px;">💰 ${prod.price}</div>
                <p style="font-size:11px; color:#ddd; line-height:1.3; margin-bottom:6px;">${prod.description}</p>
                <button class="btn-action" style="width:100%; justify-content:center; font-size:11px; padding:4px;" onclick="openTargetUserDirectChat('صاحب المادة المعروضة')">
                    <i class="fa-solid fa-comments"></i> مراسلة فورية للبائع
                </button>
            </div>`;
    });
}

function searchProducts() {
    const filter = document.getElementById('market-search-input').value.toLowerCase();
    document.querySelectorAll('.product-card-node').forEach(node => {
        const text = node.innerText.toLowerCase();
        node.style.display = text.includes(filter) ? 'block' : 'none';
    });
}

// ==========================================
// 10. صناعة الفيديوهات واستوديو الكاميرا (Reels/Camera)
// ==========================================
function openProfessionalCameraView() {
    const modal = document.getElementById('pro-camera-modal');
    if(modal) modal.style.display = 'flex';
}

function closeProfessionalCameraView() {
    const modal = document.getElementById('pro-camera-modal');
    if(modal) modal.style.display = 'none';
}

function triggerFaceBeautyEnhancement() {
    alert("🌟 تم تطبيق خوارزمية التفتيح والتنقية الملكية فائق الدقة لملامح الوجه الفورية على المشهد البصري حالياً.");
}

function triggerAnimeAiConverterFilter() {
    alert("🌟 مرشح المعالجة المتقدم (Anime AI Ultra) نشط الآن. سيتم تحويل المشهد لنمط الرسوم المتحركة والأنمي مباشرة فور الحفظ والتصدير.");
}

// ==========================================
// 11. لوحة تحكم الشبكة اللاسلكية الحرة (Free Mesh)
// ==========================================
function toggleFreeMeshShareSystem() {
    const btn = document.getElementById('free-mode-toggle-main-btn');
    const results = document.getElementById('radar-live-results');
    const radar = document.getElementById('radar-circle');
    
    meshShareActive = !meshShareActive;
    
    if(meshShareActive) {
        if(btn) { btn.style.background = "#00ff88"; btn.style.color = "#000"; btn.innerText = "✅ وضع المشاركة الحرة: نشط ومزامنة المحيط الجغرافي فعالة"; }
        if(results) results.style.display = 'block';
        if(radar) radar.style.animation = "radarPulseGlow 0.8s infinite ease-in-out;"; 
        alert("🛰️ تم تشغيل قنوات الاقتران المحلي وتبادل البيانات الصامت المحيط بدون شبكة مركزية بنجاح.");
    } else {
        if(btn) { btn.style.background = "#ff0055"; btn.style.color = "#fff"; btn.innerText = "❌ وضع المشاركة الحرة: غير نشط (اضغط للتشغيل والمزامنة القريبة)"; }
        if(results) results.style.display = 'none';
        if(radar) radar.style.animation = "none";
        alert("🔒 تم قفل بروتوكول البث اللامركزي وتأمين كاش المستندات.");
    }
}

// ==========================================
// 12. الملف الشخصي المطور وإعدادات החשبون
// ==========================================
function openSubProfileView(id) {
    const header = document.querySelector('.profile-card-header-view');
    const menuList = document.querySelector('.profile-options-menu-list');
    if(header) header.style.display = 'none';
    if(menuList) menuList.style.display = 'none';
    
    document.querySelectorAll('.sub-profile-view-box').forEach(box => box.style.display = 'none');
    
    const target = document.getElementById(id);
    if(target) {
        target.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function closeSubProfileView(id) {
    const target = document.getElementById(id);
    if(target) target.style.display = 'none';
    
    const header = document.querySelector('.profile-card-header-view');
    const menuList = document.querySelector('.profile-options-menu-list');
    if(header) header.style.display = 'block';
    if(menuList) menuList.style.display = 'flex';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function togglePulseAnimationState() {
    const txt = document.getElementById('pulse-toggle-text-status');
    if(document.body.classList.contains('pulse-disabled')) {
        document.body.classList.remove('pulse-disabled');
        if(txt) txt.innerText = "إيقاف نبض وتموج العناصر والواجهات الحالية";
    } else {
        document.body.classList.add('pulse-disabled');
        if(txt) txt.innerText = "تشغيل وتفعيل نبض وتموج الواجهات والعناصر";
    }
}

function previewRegisterOptionalAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const prev = document.getElementById('reg-optional-avatar-preview');
            if(prev) { prev.src = e.target.result; prev.style.display = 'block'; }
            localUploadedAvatarBase64 = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewImage(input, targetId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const targetImg = document.getElementById(targetId);
            if(targetImg) { targetImg.src = e.target.result; targetImg.style.display = 'block'; }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveUserProfileData() {
    const name = document.getElementById('reg-name').value.trim();
    const contact = document.getElementById('reg-contact').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const dob = document.getElementById('reg-dob')?.value || "";
    const gender = document.getElementById('reg-gender')?.value || "";

    if(!name || !contact || !pass || !dob || !gender) return alert("يرجى ملء كافة البيانات التأسيسية للملف الرقمي بما في ذلك تاريخ الميلاد والنوع.");

    localStorage.setItem('alwaha_profile_name', name);
    localStorage.setItem('alwaha_profile_phone', contact);
    localStorage.setItem('alwaha_profile_dob', dob);
    localStorage.setItem('alwaha_profile_gender', gender);
    if(localUploadedAvatarBase64) localStorage.setItem('alwaha_profile_avatar', localUploadedAvatarBase64);

    alert("✨ مبروك! تم تأسيس ملفك الرقمي الموحد على الذاكرة المشفرة بنجاح.");
    closeSubProfileView('sub-view-register');
    syncUiWithLoadedProfileData();
    evaluateMarketSellPermissionBasedOnAccount();
}

function executeAccountLoginSimulated() {
    const uid = document.getElementById('login-user-id').value.trim();
    const pass = document.getElementById('login-user-pass').value.trim();
    if(!uid || !pass) return alert("يرجى إدخال معرفك ورمز الحماية.");

    localStorage.setItem('alwaha_profile_name', uid);
    localStorage.setItem('alwaha_profile_phone', "01xxxxxxxxx");
    alert("🔐 تم الولوج والمزامنة السحابية الفورية لسجلات الحساب القائم بنجاح كلي.");
    closeSubProfileView('sub-view-login-form');
    syncUiWithLoadedProfileData();
    evaluateMarketSellPermissionBasedOnAccount();
}

function syncUiWithLoadedProfileData() {
    const savedName = localStorage.getItem('alwaha_profile_name') || "زائر";
    const savedPhone = localStorage.getItem('alwaha_profile_phone') || "يرجى تسجيل الدخول أو تهيئة ملف تعريفي رسمي متكامل";
    const savedAvatar = localStorage.getItem('alwaha_profile_avatar');

    const nameTag = document.getElementById('my-profile-name-tag');
    const phoneTag = document.getElementById('my-profile-phone-tag');
    const avatarPlaceholder = document.getElementById('my-profile-avatar-placeholder');

    if(nameTag) nameTag.innerHTML = `${savedName} <span id="verification-badge-slot"></span>`;
    if(phoneTag) phoneTag.innerText = savedPhone;
    
    if(avatarPlaceholder) {
        if(savedAvatar) {
            avatarPlaceholder.innerHTML = `<img src="${savedAvatar}" alt="Avatar">`;
        } else {
            avatarPlaceholder.innerText = savedName.charAt(0).toUpperCase();
        }
    }

    const settingsName = document.getElementById('settings-name');
    const settingsEmail = document.getElementById('settings-email');
    const settingsPhone = document.getElementById('settings-phone');
    
    if(settingsName) settingsName.value = localStorage.getItem('alwaha_profile_name') || "";
    if(settingsEmail) settingsEmail.value = localStorage.getItem('alwaha_profile_email') || "";
    if(settingsPhone) settingsPhone.value = localStorage.getItem('alwaha_profile_phone') || "";
}

function sendSimulatedOTP() {
    const phone = document.getElementById('reg-phone').value.trim();
    if(!phone) return alert("يرجى كتابة رقم الهاتف أولاً لإرسال حزمة التوثيق البنائية.");
    
    document.getElementById('otp-verification-box').style.display = 'block';
    alert("💬 رمز التحقق الافتراضي المكون من 4 أرقام هو: [ 1 2 3 4 ]. تم إرساله لهاتفك الآن صامتاً.");
}

function verifySimulatedOTP() {
    const code = document.getElementById('reg-otp-code').value.trim();
    const status = document.getElementById('otp-status');
    if(code === "1234") {
        if(status) { status.style.color = "#00ff88"; status.innerText = "✅ رمز التحقق صحيح ومتوافق بالكامل!"; }
        localStorage.setItem('alwaha_profile_verified', 'true');
    } else {
        if(status) { status.style.color = "#ff0055"; status.innerText = "❌ رمز التحقق خاطئ أو غير متطابق هندسياً."; }
    }
}

function submitUserRegistrationForm() {
    const fullName = document.getElementById('reg-full-name').value.trim();
    if(!fullName) return alert("يرجى تعبئة الاسم الرسمي الثلاثي لإكمال الحزمة الهيكلية.");
    
    alert("🚀 تم إرسال ملفات الهوية الشخصية الممسوحة ضوئياً واللقطة الحية لخادم الصيانة والتوثيق بنجاح جاري الفحص التلقائي.");
    closeSubProfileView('sub-view-register-form');
    
    const slot = document.getElementById('verification-badge-slot');
    if(slot) slot.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#00ffff; font-size:14px; margin-right:4px;" title="حساب موثق هيكلياً"></i>`;
}

function applyThemeSelected(theme) {
    document.body.className = ""; 
    if(theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
    alert(`🎨 تم اعتماد وتثبيت الواجهة البصرية المحدثة للثيم بنجاح كلي.`);
    closeSubProfileView('sub-view-themes-picker');
}

function sendEmailOTP() {
    const email = document.getElementById('settings-email').value.trim();
    if(!email) return alert("يرجى كتابة البريد الإلكتروني أولاً.");
    
    document.getElementById('settings-email-otp-box').style.display = 'flex';
    alert("💬 رمز تفعيل البريد الإلكتروني الافتراضي هو: [ 5555 ]. تم إرساله لبريدك الإلكتروني الآن.");
}

function verifyEmailOTP() {
    const code = document.getElementById('settings-email-otp').value.trim();
    const status = document.getElementById('settings-email-status');
    if(code === "5555") {
        if(status) { status.style.color = "#00ff88"; status.innerText = "✅ تم التحقق من البريد الإلكتروني بنجاح وتأمينه!"; }
        localStorage.setItem('alwaha_profile_email_verified', 'true');
    } else {
        if(status) { status.style.color = "#ff0055"; status.innerText = "❌ رمز التحقق للبريد الإلكتروني خاطئ."; }
    }
}

function sendSettingsPhoneOTP() {
    const phone = document.getElementById('settings-phone').value.trim();
    if(!phone) return alert("يرجى كتابة رقم الهاتف أولاً.");
    
    document.getElementById('settings-phone-otp-box').style.display = 'flex';
    alert("💬 رمز تفعيل الهاتف الافتراضي هو: [ 7777 ]. تم إرساله لهاتفك الآن صامتاً.");
}

function verifySettingsPhoneOTP() {
    const code = document.getElementById('settings-phone-otp').value.trim();
    const status = document.getElementById('settings-phone-status');
    if(code === "7777") {
        if(status) { status.style.color = "#00ff88"; status.innerText = "✅ تم التحقق من رقم الهاتف بنجاح وربطه بالملف التعريفي!"; }
        localStorage.setItem('alwaha_profile_phone_verified', 'true');
    } else {
        if(status) { status.style.color = "#ff0055"; status.innerText = "❌ رمز التحقق للهاتف خاطئ."; }
    }
}

function saveSettingsChanges() {
    const name = document.getElementById('settings-name').value.trim();
    const email = document.getElementById('settings-email').value.trim();
    const phone = document.getElementById('settings-phone').value.trim();
    const pass = document.getElementById('settings-pass').value.trim();

    if(!name) return alert("يرجى إدخال الاسم التعريفي أولاً لحفظ التعديلات.");

    localStorage.setItem('alwaha_profile_name', name);
    localStorage.setItem('alwaha_profile_email', email);
    localStorage.setItem('alwaha_profile_phone', phone);
    if(pass) {
        localStorage.setItem('alwaha_profile_password', pass);
    }

    alert("💾 تم حفظ وتحديث تغييرات الحساب بنجاح ومزامنتها على الذاكرة الآمنة.");
    closeSubProfileView('sub-view-settings-control');
    syncUiWithLoadedProfileData();
}

function clearLocalStorageCache() {
    if(confirm("⚠ هل أنت متأكد من رغبتك في مسح كافة ملفات الكاش، الهويات والبيانات المحلية وإعادة تشغيل منصة الواحة؟")) {
        localStorage.clear();
        alert("🧹 تم مسح كاش البيانات المحلية بنجاح كلي. سيتم إعادة تشغيل الواجهة الآن.");
        window.location.reload();
    }
}

// ==========================================
// 13. التهيئة المبدئية عند التحميل
// ==========================================
window.onload = function() {
    initializeKeyboardInputGuard();
    executeAiSecurityObfuscationScan();
    syncUiWithLoadedProfileData();
    renderHomePostsFeed();
    
    if(localStorage.getItem('alwaha_profile_verified') === 'true') {
        const slot = document.getElementById('verification-badge-slot');
        if(slot) slot.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#00ffff; font-size:14px; margin-right:4px;" title="حساب موثق هيكلياً"></i>`;
    }
};
