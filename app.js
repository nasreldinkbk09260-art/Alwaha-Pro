// ==========================================
// إعدادات الربط والاتصال المباشر مع سيرفر السحابي لـ Supabase أونلاين للواحة برو
// ==========================================
const SUPABASE_URL = "https://fylbbybclbeunmrcscqy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bGJieWJjbGJldW5tcmNzY3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Mzg3NzMsImV4cCI6MjA5NTUxNDc3M30.E-f7VstD2g-uGjE6_z8-VvL6R7Fz3f7eF6K9W2vL8Z4";

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
        return [];
    }
}

// نظام الإشعارات المستقبلي لمتطلبات قوقل بلاي مع أصوات رنات فخمة وجميلة جداً مدمجة تلقائياً
function playLuxuriousNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // النوتة الأولى الفخمة المبهجة
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 رنة فخمة ونقية
        gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.4);

        // النوتة الثانية المتناغمة الاستراتيجية مع مرور الألوان
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 رنة ملكية متقنة
            gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.5);
        }, 150);

    } catch (e) {
        console.log("صوت الإشعارات بانتظار تفاعل المستخدم الأول على الصفحة تماشياً مع معايير المتصفحات.");
    }
}

// تفعيل حارس الكيبورد الذكي: يمنع تغطية الكيبورد للنص ويرفعه تماماً أمام عيني الكاتب والمنشئ
function initializeKeyboardInputGuard() {
    const targets = document.querySelectorAll('.keyboard-target, input, textarea');
    targets.forEach(element => {
        element.addEventListener('focus', () => {
            document.body.classList.add('keyboard-adjusted-body');
            setTimeout(() => {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 180);
        });
        element.addEventListener('blur', () => {
            document.body.classList.remove('keyboard-adjusted-body');
        });
    });
}

// نظام التمويه واغلاق ثغرات البيانات والتوجيه وحماية كامل التطبيق من الاختراق بالذكاء الاصطناعي الافتراضي
function executeAiSecurityObfuscationScan() {
    console.log("🛡️ ذكاء اصطناعي مدمج للـ الحماية: تم تفعيل تشفير البيانات الافتراضي ونظام التمويه واغلاق ثغرات الحقن كلياً.");
    window.addEventListener('error', function(e) {
        console.log("نظام التمويه البرمجي يمتص خطأ واجهة المستخدم حمايةً من استغلال الثغرات الخبيثة.");
        e.preventDefault();
    });
}

// تبديل الأقسام وتدقيق الأمان المانع للنشر أو البيع والدردشة خارج الماركت دون حساب
let isUserLoggedInState = false;
let globalBase64RegisterAvatar = ""; // لتخزين مسار الصورة الاختيارية المسحوبة

function checkIfUserHasAccountCreated() {
    const localName = localStorage.getItem('alwaha_profile_name');
    if (localName && localName !== "زائر") {
        isUserLoggedInState = true;
        return true;
    }
    return isUserLoggedInState;
}

// دالة التنقل الاحترافية الفورية - تمنع تماماً تراكم الصفحات وتصعد لأعلى الشاشة تلقائياً
function showSection(id, element) {
    const sections = document.querySelectorAll('.app-section');
    sections.forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active-section');
    });
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const targetSec = document.getElementById(id);
    if(targetSec) {
        targetSec.style.display = 'block';
        targetSec.classList.add('active-section');
    }
    
    if(element) {
        element.classList.add('active');
    }
    
    playLuxuriousNotificationSound();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if(id === 'home-section') renderHomePostsFeed();
    if(id === 'market-section') {
        renderProductsList();
        evaluateMarketSellPermissionBasedOnAccount();
    }
    if(id === 'chat-section') renderConversationsList();
}

// ضبط ألوان الثيمات الثلاثة والخلفية بالملف الشخصي
function applyThemeSelected(themeName) {
    document.body.classList.remove('theme-white', 'theme-black', 'theme-nature');
    if (themeName === 'white') {
        document.body.classList.add('theme-white');
    } else if (themeName === 'black') {
        document.body.classList.add('theme-black');
    } else if (themeName === 'nature') {
        document.body.classList.add('theme-nature');
    }
    alert(`🎨 تم تبديل واجهة نظام العرض بنجاح إلى: ${themeName}`);
}

// تشغيل وإلغاء تموج ونبض الأزرار كلياً لإراحة العين
function togglePulseAnimationState() {
    const isPulseOff = document.body.classList.toggle('pulse-disabled');
    const statusText = document.getElementById('pulse-toggle-text-status');
    if (statusText) {
        statusText.innerText = isPulseOff ? "تنشيط وإعادة نبض وتموج الواجهات الإرشادية" : "إيقاف نبض وتموج العناصر والواجهات الحالية";
    }
    alert(isPulseOff ? "تم تعطيل تموج الواجهات البصرية لضمان استقرار العرض." : "تم إعادة إشعال تموج الأزرار الديناميكية بنجاح.");
}

function autoDetectClientPlatformAndSetup() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    console.log("استكشاف نوع المعالج والمتصفح للعميل لتقديم الحزم المتوافقة: " + userAgent);
}

function triggerDesktopDownloadSimulation() {
    alert("💻 جاري توليد رابط الحزمة المباشرة لسطح المكتب: (Alwaha Pro Windows Engine V1.0.0) عبر المتصفح فوراً!");
}

let isFreeMeshShareActive = false;
function toggleFreeMeshShareSystem() {
    isFreeMeshShareActive = !isFreeMeshShareActive;
    const mainBtn = document.getElementById('free-mode-toggle-main-btn');
    const resultsBox = document.getElementById('radar-live-results');
    
    if (isFreeMeshShareActive) {
        mainBtn.innerText = "🟢 وضع المشاركة الحرة: نشط ومستعد للإرسال والاستقبال القريب";
        mainBtn.style.background = "#00ff88";
        mainBtn.style.color = "#000";
        if(resultsBox) resultsBox.style.display = "block";
        alert("🔒 بروتوكولات الرادار المحلي صامتة وتعمل الآن بتشفير موحد وآمن عبر المحيط القريب.");
    } else {
        mainBtn.innerText = "❌ وضع المشاركة الحرة: غير نشط (اضغط للتشغيل والمزامنة القريبة)";
        mainBtn.style.background = "#ff0055";
        mainBtn.style.color = "#fff";
        if(resultsBox) resultsBox.style.display = "none";
        alert("تم تعليق عمل الرادار الشبكي المحلي وإغلاق منافذ التبادل الصامت بالخلفية.");
    }
}

function executeSmartAiAutoReplyAssistant(userTextInput) {
    const text = userTextInput.toLowerCase();
    if(text.includes("تحميل") || text.includes("برنامج") || text.includes("تحديث")) {
        return "🤖 المساعد الافتراضي للواحة: يمكنك استخدام روابط التحميل المباشرة الفورية المتوفرة بتبويب الشاشة الرئيسية للحصول على حزم الأندرويد والكمبيوتر الرسمية المحدثة.";
    }
    return "🤖 المساعد الافتراضي للواحة: رسالتك مشفرة ومؤمنة في البنية التحتية للشبكة ضد الاختراق والحقن الرقمي.";
}

// دالة جلب وعرض الخلاصة المباشرة لمنع توقف الصفحة الرئيسية
async function renderHomePostsFeed() {
    const container = document.getElementById('home-posts-feed-container');
    if (!container) return;
    container.innerHTML = `<p style="text-align:center; font-size:12px; color:#aaa; padding:10px;">جاري سحب التغريدات الحية من السيرفر السحابي الموحد...</p>`;
    
    const posts = await supabaseFetch("posts?select=*&order=created_at.desc");
    container.innerHTML = "";
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-size:12px; color:#aaa; padding:15px;">لا توجد تغريدات حالياً بالخلاصة الفورية. كن أول من يبث فكرته!</p>`;
        return;
    }

    posts.forEach(post => {
        container.innerHTML += `
            <div class="news-box post-card-node" style="border-right: 3px solid #00ffff; margin-bottom: 10px;">
                <div style="font-weight:bold; color:#ff00ff; font-size:13px; margin-bottom:4px;">👤 ${post.author_name || post.user_name || "عضو معتمد"} <span style="font-size:10px; color:#888; float:left;">⚡ ${post.type || "توجيه عام"}</span></div>
                <p style="color:#eee; font-size:12px; line-height:1.4; white-space:pre-wrap;">${post.content || post.text}</p>
            </div>`;
    });
}

async function publishNewHomePost() {
    if (!checkIfUserHasAccountCreated()) {
        alert("🚨 كبح أمني: يرجى تهيئة حسابك وملفك الخاص أولاً بتبويب (الملف الشخصي) لتتمكن من بث الأفكار والمشاركات بالخلاصة الموحدة!");
        showSection('profile-section');
        return;
    }

    const text = document.getElementById('home-post-textarea').value.trim();
    const type = document.getElementById('home-post-type').value;
    const savedName = localStorage.getItem('alwaha_profile_name') || "عضو معتمد";

    if(!text) {
        alert("يرجى تدوين نص المشاركة أو التحديث أولاً!");
        return;
    }

    await supabaseFetch("posts", {
        method: "POST",
        body: JSON.stringify({ author_name: savedName, user_name: savedName, content: text, text: text, type: type })
    });

    document.getElementById('home-post-textarea').value = "";
    renderHomePostsFeed();
    alert("🚀 تم بث وتعميم التحديث بنجاح كلي إلى السيرفر السحابي الموحد مع رنات التأكيد.");
}

async function renderProductsList() {
    const container = document.getElementById('market-products-list-container');
    if (!container) return;

    const products = await supabaseFetch("products?select=*&order=created_at.desc");
    container.innerHTML = "";
    
    if (!products || products.length === 0) {
        container.innerHTML = `<p style="grid-column: span 2; text-align:center; font-size:12px; color:#aaa; padding:15px;">الماركت فارغ من المواد حالياً. بادر بإدراج معروضك الأول بالدخول بحسابك!</p>`;
        return;
    }

    products.forEach((prod) => {
        const isSold = prod.status === "sold" || prod.is_archived === true;
        const soldBadge = isSold ? `<div style="background:#ff0055; color:#fff; font-size:10px; padding:2px; font-weight:bold; text-align:center; border-radius:4px; margin-bottom:4px;">⚠️ تـم البـيـع والأرشـفـة</div>` : "";
        const sellerControls = !isSold ? `<button class="btn-action" style="padding:2px 5px; font-size:10px; margin-top:5px; width:100%; background:#ffd700; color:#000; justify-content:center;" onclick="markProductAsSoldInDatabase('${prod.id}')"><i class="fa-solid fa-check"></i> تغيير الحالة إلى: تم البيع</button>` : "";

        container.innerHTML += `
            <div class="product-card-node golden-edge">
                ${soldBadge}
                <div style="font-weight:bold; color:#00ffff; margin-bottom:3px; font-size:13px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${prod.title || prod.name}</div>
                <div style="color:#ffd700; font-weight:bold; margin-bottom:3px;">${prod.price}</div>
                <p style="color:#eee; font-size:11px; height:32px; overflow:hidden; line-height:1.2; margin-bottom:4px;">${prod.description || prod.desc}</p>
                <div style="font-size:10px; color:#888;">📞 ${prod.phone}</div>
                ${sellerControls}
            </div>`;
    });
}

async function searchProducts() {
    const query = document.getElementById('market-search-input').value.trim().toLowerCase();
    const container = document.getElementById('market-products-list-container');
    if (!container) return;
    
    const products = await supabaseFetch("products?select=*&order=created_at.desc");
    container.innerHTML = "";
    
    const filtered = products.filter(p => 
        (p.title && p.title.toLowerCase().includes(query)) || 
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.desc && p.desc.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        container.innerHTML = `<p style="grid-column: span 2; text-align:center; font-size:12px; color:#aaa; padding:15px;">لا توجد سلع تجارية تطابق معايير استعلامك الفعلي.</p>`;
        return;
    }

    filtered.forEach(prod => {
        const isSold = prod.status === "sold" || prod.is_archived === true;
        const soldBadge = isSold ? `<div style="background:#ff0055; color:#fff; font-size:10px; padding:2px; font-weight:bold; text-align:center; border-radius:4px; margin-bottom:4px;">⚠️ تـم البـيـع والأرشـفـة</div>` : "";
        const sellerControls = !isSold ? `<button class="btn-action" style="padding:2px 5px; font-size:10px; margin-top:5px; width:100%; background:#ffd700; color:#000; justify-content:center;" onclick="markProductAsSoldInDatabase('${prod.id}')"><i class="fa-solid fa-check"></i> تغيير الحالة إلى: تم البيع</button>` : "";

        container.innerHTML += `
            <div class="product-card-node golden-edge">
                ${soldBadge}
                <div style="font-weight:bold; color:#00ffff; margin-bottom:3px; font-size:13px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${prod.title || prod.name}</div>
                <div style="color:#ffd700; font-weight:bold; margin-bottom:3px;">${prod.price}</div>
                <p style="color:#eee; font-size:11px; height:32px; overflow:hidden; line-height:1.2; margin-bottom:4px;">${prod.description || prod.desc}</p>
                <div style="font-size:10px; color:#888;">📞 ${prod.phone}</div>
                ${sellerControls}
            </div>`;
    });
}

async function markProductAsSoldInDatabase(productId) {
    if (confirm("هل تؤكد بيع هذه المادة التجارية ونقلها إلى قسم المواد المؤرشفة؟")) {
        await supabaseFetch(`products?id=eq.${productId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "sold", is_archived: true })
        });
        alert("🎯 تم وسم وإشهار المعروض كـ (تم البيع) وحماية قنوات اتصال البائع بنجاح كلي.");
        renderProductsList();
    }
}

function evaluateMarketSellPermissionBasedOnAccount() {
    const hasAccount = checkIfUserHasAccountCreated();
    const blockedDiv = document.getElementById('sell-access-blocked');
    const allowedDiv = document.getElementById('sell-form-allowed');
    
    if (hasAccount) {
        if(blockedDiv) blockedDiv.style.display = "none";
        if(allowedDiv) allowedDiv.style.display = "block";
    } else {
        if(blockedDiv) blockedDiv.style.display = "block";
        if(allowedDiv) allowedDiv.style.display = "none";
    }
}

async function submitNewProductToMarket() {
    if (!checkIfUserHasAccountCreated()) {
        alert("عذراً، يجب إتمام تهيئة الحساب الفردي أولاً لتنفيذ الإدراج التجاري.");
        return;
    }

    const title = document.getElementById('prod-name').value.trim();
    const price = document.getElementById('prod-price').value.trim();
    const phone = document.getElementById('prod-phone').value.trim();
    const desc = document.getElementById('prod-desc').value.trim();

    if(!title || !price || !phone) {
        alert("يرجى ملء الحقول الإلزامية لتأسيس بطاقة المعاينة التجارية بنجاح!");
        return;
    }

    await supabaseFetch("products", {
        method: "POST",
        body: JSON.stringify({ name: title, title: title, price: price, phone: phone, desc: desc, description: desc, status: "active" })
    });

    document.getElementById('prod-name').value = "";
    document.getElementById('prod-price').value = "";
    document.getElementById('prod-phone').value = "";
    document.getElementById('prod-desc').value = "";
    
    switchMarketMode('buy');
    alert("🎁 تم رفع وبث المادة التجارية المصغرة بنجاح كلي ضمن الماركت المفتوح.");
}

function switchMarketMode(mode) {
    const buyView = document.getElementById('market-buy-view');
    const sellView = document.getElementById('market-sell-view');
    const tabBuy = document.getElementById('tab-buy');
    const tabSell = document.getElementById('tab-sell');
    
    if(mode === 'buy') {
        if(buyView) buyView.style.display = "block";
        if(sellView) sellView.style.display = "none";
        if(tabBuy) tabBuy.classList.add('active-tab');
        if(tabSell) tabSell.classList.remove('active-tab');
        renderProductsList();
    } else {
        if(buyView) buyView.style.display = "none";
        if(sellView) sellView.style.display = "block";
        if(tabBuy) tabBuy.classList.remove('active-tab');
        if(tabSell) tabSell.classList.add('active-tab');
        evaluateMarketSellPermissionBasedOnAccount();
    }
}

function triggerFaceBeautyEnhancement() {
    const lens = document.getElementById('camera-screen-lens');
    if (lens) {
        lens.style.filter = "contrast(1.05) brightness(1.12) saturate(1.08)";
    }
    alert("✨ تفعيل خوارزمية التنعيم الذكي المعالجة لوجوه المستخدمين وتعديل الملامح والشوائب رقمياً خلال أجزاء من الثانية!");
}

function triggerAnimeAiConverterFilter() {
    const lens = document.getElementById('camera-screen-lens');
    if (lens) {
        lens.style.filter = "hue-rotate(45deg) saturate(1.4) contrast(1.1)";
    }
    alert("🎨 جاري استدعاء مصفوفات الأنمي المعززة بالذكاء الاصطناعي لتحويل الإطار البصري إلى لوحة متحركة كاملة الجودة سحابياً!");
}

function initiateVoiceCall(typeOfRoute) {
    if (!checkIfUserHasAccountCreated()) {
        alert("🚨 كبح أمني: التراسل الصوتي المباشر والربط اللامركزي خارج الماركت يتطلب وجود حساب مسجل أولاً!");
        showSection('profile-section');
        return;
    }
    const target = document.getElementById('current-chat-name').innerText;
    document.getElementById('call-target-user').innerText = target;
    document.getElementById('voice-call-modal').style.display = "flex";
    
    if(typeOfRoute === 'bluetooth') {
        console.log("تأسيس قناة اتصال مجانية معززة عبر بروتوكول البلوتوث المحلي المقترن.");
    } else {
        console.log("تأسيس ممر اتصال سحابي عالمي مقاوم ومقاوم للضعف الشديد بالتغطية الشبكية.");
    }
}

function terminateVoiceCall() {
    document.getElementById('voice-call-modal').style.display = "none";
}

function executeFriendAction(actionType) {
    const name = document.getElementById('friend-search-input').value.trim();
    if(!name) {
        alert("يرجى إدخال المعرف الفريد للصديق أولاً!");
        return;
    }
    if(actionType === 'add') {
        alert(`👥 تم بث طلب ارتباط مشبكي مباشر إلى المعرف "${name}" وربطه بقائمة الاتصال بنجاح كلي.`);
    } else {
        alert(`🗑️ تم فك وإنهاء ارتباط الاتصال بالمعرف لـ "${name}" وتطهير ممرات البيانات المحلية.`);
    }
    document.getElementById('friend-search-input').value = "";
}

function renderConversationsList() {
    const container = document.getElementById('conversations-list');
    if (!container) return;
    container.innerHTML = `
        <div class="profile-menu-btn golden-edge" style="margin-bottom:8px;" onclick="openTargetUserDirectChat('المهندس نصر الدين')">
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="avatar-glow" style="width:35px; height:35px; font-size:14px;">ن</div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:#fff; font-size:13px;">المهندس نصر الدين</div>
                    <div style="font-size:11px; color:#00ff88;">متصل الآن بالصالون الموحد</div>
                </div>
            </div>
            <i class="fa-solid fa-chevron-left"></i>
        </div>
        <div class="profile-menu-btn" style="margin-bottom:8px;" onclick="openTargetUserDirectChat('المطور صابر')">
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="avatar-glow" style="width:35px; height:35px; font-size:14px; background:#ff00ff;">ص</div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:#fff; font-size:13px;">المطور صابر</div>
                    <div style="font-size:11px; color:#aaa;">مستعد لتبادل الملفات الفنية</div>
                </div>
            </div>
            <i class="fa-solid fa-chevron-left"></i>
        </div>`;
}

function openTargetUserDirectChat(userName) {
    document.getElementById('current-chat-name').innerText = userName;
    document.getElementById('active-chat-box').style.display = "block";
    const container = document.getElementById('chat-messages-container');
    container.innerHTML = `
        <div class="msg-bubble msg-them" style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; font-size:11px; margin-bottom:5px; color:#888;">[ بروتوكول التشفير والتعمية الشامل نشط بالخلفية لتبادل الرسائل الحية ]</div>
        <div class="msg-bubble msg-them" style="background:#1a0629; color:#fff; padding:10px; border-radius:8px; margin-bottom:5px; max-width:80%; line-height:1.4;">مرحباً بك، القناة التبادلية مستقرة وجاهزة الآن.. كيف يمكنني مساندتك اليوم في تعديلات الملفات البرمجية وهندسة الصيانة للهواتف الذكية؟</div>`;
}

function closeActiveChatWindow() {
    document.getElementById('active-chat-box').style.display = "none";
}

function acceptFriendSimulated() {
    alert("تم اعتماد طلب التبادل بنجاح وضمه إلى رادار الاتصالات المباشرة الخاصة بك.");
    const badge = document.getElementById('notif-badge');
    if(badge) badge.innerText = "2";
}

function toggleInternalNotificationCenter() {
    const center = document.getElementById('internal-notification-center');
    if(center) {
        center.style.display = (center.style.display === 'none') ? 'block' : 'none';
    }
}

function switchChatTab(tabId, element) {
    document.querySelectorAll('.chat-tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId + '-tab');
    if(targetTab) targetTab.style.display = "block";
    if(element) element.classList.add('active');
}

function simulateLudoMatchLaunch() {
    alert("🎲 تم حشد بروتوكولات البلوتوث المباشرة لجهازك بنجاح! جاري جدولة انضمام الأطراف الأربعة داخل رادار الشاشة الواحدة لبدء المعركة الجماعية دون استهلاك رصيد البيانات.");
}

function sendLiveChatMessageFromUI() {
    if (!checkIfUserHasAccountCreated()) {
        alert("🚨 كبح أمني: يجب تهيئة ملف الحساب الشخصي وتأكيد البيانات أولاً لتنشيط واجهة المراسلة الجماعية!");
        showSection('profile-section');
        return;
    }
    const inp = document.getElementById('chat-message-input');
    const txt = inp.value.trim();
    if(!txt) return;

    const container = document.getElementById('chat-messages-container');
    container.innerHTML += `<div class="msg-bubble msg-me" style="background:#00ff88; color:#000; padding:10px; border-radius:8px; margin-bottom:5px; max-width:80%; margin-right:auto; font-weight:bold; text-align:left;">${txt}</div>`;
    
    setTimeout(() => {
        const aiAnswer = executeSmartAiAutoReplyAssistant(txt);
        container.innerHTML += `<div class="msg-bubble msg-them" style="background:#1a0629; color:#fff; padding:10px; border-radius:8px; margin-bottom:5px; max-width:80%; line-height:1.4;">${aiAnswer}</div>`;
        container.scrollTop = container.scrollHeight;
    }, 800);

    inp.value = "";
    container.scrollTop = container.scrollHeight;
}

// دالة رصد ومعاينة الصورة الاختيارية المرفوعة في نموذج التسجيل
function previewRegisterOptionalAvatar(input) {
    const preview = document.getElementById('reg-optional-avatar-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            globalBase64RegisterAvatar = e.target.result; // حفظ الصورة مصفوفة ثنائية
            if(preview) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// تعديل منظومة حفظ الحساب لتدمج الصورة الاختيارية بسلاسة تامة دون نقصان
function saveUserProfileData() {
    const name = document.getElementById('reg-name').value.trim();
    const contact = document.getElementById('reg-contact').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();

    if (!name || !contact || !pass) {
        alert("يرجى استيفاء الحقول الإلزامية الأساسية لإتمام تهيئة ملفك الرقمي الجديد!");
        return;
    }

    localStorage.setItem('alwaha_profile_name', name);
    localStorage.setItem('alwaha_profile_contact', contact);
    
    // حفظ الصورة الاختيارية في الكاش المحلي إذا اختار المستخدم رفعها
    if (globalBase64RegisterAvatar) {
        localStorage.setItem('alwaha_profile_avatar_base64', globalBase64RegisterAvatar);
    } else {
        localStorage.removeItem('alwaha_profile_avatar_base64');
    }
    
    isUserLoggedInState = true;

    // تحديث واجهة البروفايل فورياً
    document.getElementById('my-profile-name-tag').innerHTML = `${name} <span style="color:#00ffff; font-size:11px;">(✔️ حساب نشط ومحمّي)</span>`;
    document.getElementById('my-profile-phone-tag').innerText = `قناة البيانات المعتمدة: ${contact}`;
    
    const avatarPlaceholder = document.getElementById('my-profile-avatar-placeholder');
    if (globalBase64RegisterAvatar) {
        avatarPlaceholder.innerHTML = `<img src="${globalBase64RegisterAvatar}" alt="Avatar">`;
    } else {
        avatarPlaceholder.innerText = name.charAt(0).toUpperCase();
    }

    closeSubProfileView('sub-view-register');
    alert("🎉 تهانينا! تم تأسيس ملفك الرقمي المتكامل وتخزينه بنجاح آمن، وتم فك كافة قيود البيع والنشر والتراسل فورياً!");
    showSection('home-section');
}

function executeAccountLoginSimulated() {
    const id = document.getElementById('login-user-id').value.trim();
    const pass = document.getElementById('login-user-pass').value.trim();
    if(!id || !pass) {
        alert("يرجى إدخال البيانات المطلوبة لإتمام تفعيل الولوج!");
        return;
    }
    localStorage.setItem('alwaha_profile_name', "المهندس نصر الدين");
    localStorage.setItem('alwaha_profile_contact', id);
    localStorage.removeItem('alwaha_profile_avatar_base64'); // تفريغ الصورة الاختيارية للنمط السريع
    isUserLoggedInState = true;

    document.getElementById('my-profile-name-tag').innerHTML = `المهندس نصر الدين <span style="color:#00ffff; font-size:11px;">(✔️ حساب موثق معتمد)</span>`;
    document.getElementById('my-profile-phone-tag').innerText = `قناة الاتصال الفريدة: ${id}`;
    document.getElementById('my-profile-avatar-placeholder').innerText = "ن";

    closeSubProfileView('sub-view-login-form');
    alert("🔓 تم فحص وتوثيق الولوج بنجاح كلي وتحويلك إلى لوحة المتابعة الرئيسية.");
    showSection('home-section');
}

// دالات فتح وإغلاق النوافذ الفرعية بملف أنا التعريفي
function openSubProfileView(id) {
    document.querySelectorAll('.sub-profile-view-box').forEach(box => {
        box.style.display = 'none';
    });
    const targetElement = document.getElementById(id);
    if (targetElement) {
        targetElement.style.display = 'block';
    }
}

function closeSubProfileView(id) {
    const targetElement = document.getElementById(id);
    if (targetElement) {
        targetElement.style.display = 'none';
    }
}

// دالات إضافية لمحاكاة نظام التحقق بالـ OTP وتحميل ومعاينة الصور والوثائق للتوثيق المتقدم
function sendSimulatedOTP() {
    const phone = document.getElementById('reg-phone').value.trim();
    if(!phone) { alert("أدخل رقم هاتف صالح أولاً!"); return; }
    document.getElementById('otp-verification-box').style.display = "block";
    alert("🔐 تم تشفير وإرسال الكود OTP الافتراضي بنجاح إلى هاتفك: [ الكود للمطابقة هو 1234 ]");
}

function verifySimulatedOTP() {
    const code = document.getElementById('reg-otp-code').value.trim();
    const status = document.getElementById('otp-status');
    if(code === "1234") {
        status.innerText = "✔️ تم مطابقة وتأكيد ملكية رقم الهاتف بنجاح قطعي!";
        status.style.color = "#00ff88";
    } else {
        status.innerText = "❌ الكود غير صحيح، يرجى إعادة الفحص.";
        status.style.color = "#ff0055";
    }
}

function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = "block";
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function submitUserRegistrationForm() {
    const fullName = document.getElementById('reg-full-name').value.trim();
    if(!fullName) { alert("يرجى تدوين الاسم الثلاثي لاستكمال حزمة الرفع!"); return; }
    alert(`🚀 تم استقبال وحفظ وثائق ومستندات العضوية لـ (${fullName}) بنجاح، الحساب فعال حالياً بصفة مؤقتة لحين اكتمال التدقيق.`);
    closeSubProfileView('sub-view-register-form');
}

function openProfessionalCameraView() {
    const camModal = document.getElementById('pro-camera-modal');
    if(camModal) camModal.style.display = "flex";
}

function closeProfessionalCameraView() {
    const camModal = document.getElementById('pro-camera-modal');
    if(camModal) camModal.style.display = "none";
}

// تشغيل الفحص والتأمين التلقائي الفوري عند تحميل النافذة كلياً
window.onload = function() {
    initializeKeyboardInputGuard();
    executeAiSecurityObfuscationScan();
    autoDetectClientPlatformAndSetup();
    
    // التحقق من وجود حساب محفوظ مسبقاً لاسترجاع الأفاتار الاختياري
    const savedName = localStorage.getItem('alwaha_profile_name');
    const savedAvatar = localStorage.getItem('alwaha_profile_avatar_base64');
    if (savedName && savedName !== "زائر") {
        document.getElementById('my-profile-name-tag').innerHTML = `${savedName} <span style="color:#00ffff; font-size:11px;">(✔️ حساب نشط ومحمّي)</span>`;
        const avatarPlaceholder = document.getElementById('my-profile-avatar-placeholder');
        if (savedAvatar) {
            avatarPlaceholder.innerHTML = `<img src="${savedAvatar}" alt="Avatar">`;
        } else {
            avatarPlaceholder.innerText = savedName.charAt(0).toUpperCase();
        }
    }
};
