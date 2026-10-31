/* Alwaha-Pro registration and layered sci-fi ringtone polish.
 * No network-loaded audio, third-party tracking, or additional dependencies.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const safeGet = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };

  function enhanceRegistrationForm() {
    const form = $('sub-prof-register');
    if (!form || form.dataset.polishApplied === '1') return;
    const firstName = $('reg-first-name'), lastName = $('reg-last-name');
    const username = $('reg-username'), email = $('reg-identifier');
    const countryCode = $('reg-country-code'), customCode = $('reg-country-code-custom');
    const gender = $('reg-gender'), birthdate = $('reg-birthdate');
    const password = $('reg-password'), confirm = $('reg-confirm-password');
    const button = form.querySelector('button[onclick="handleNewUserRegistrationSubmit()"]');
    if (!firstName || !password || !button || !username) return;

    const usernameHelp = username.nextElementSibling;
    const avatar = $('reg-avatar-preview')?.parentElement || null;
    const phoneRow = countryCode?.parentElement || null;
    const birthdateBlock = birthdate?.parentElement || null;

    const intro = document.createElement('div');
    intro.className = 'alwaha-reg-intro';
    intro.innerHTML = '<strong>أهلًا بك في الواحة 🌿</strong><span>اكتب اسمك وكلمة المرور فقط؛ اسم المستخدم جاهز تلقائيًا ويمكنك تغييره. البريد والهاتف اختياريان.</span>';
    form.insertBefore(intro, firstName);
    firstName.placeholder = 'اسمك (مطلوب)';
    firstName.autocomplete = 'given-name';
    firstName.setAttribute('aria-label', 'اسمك');
    firstName.required = true;
    password.placeholder = 'كلمة المرور — 8 أحرف على الأقل';
    password.autocomplete = 'new-password';

    // Keep the existing submit handler compatible while removing the extra visible field.
    if (confirm) {
      confirm.value = '';
      confirm.required = false;
      confirm.style.display = 'none';
      confirm.setAttribute('aria-hidden', 'true');
      confirm.autocomplete = 'off';
    }

    const details = document.createElement('details');
    details.className = 'alwaha-reg-optional';
    details.id = 'alwaha-reg-optional';
    const summary = document.createElement('summary');
    summary.textContent = 'بيانات إضافية (اختياري) — البريد، الهاتف، الصورة، معلومات الملف';
    const hint = document.createElement('p');
    hint.className = 'alwaha-reg-optional-hint';
    hint.textContent = 'يمكنك ترك هذه البيانات فارغة؛ لا نحتاج البريد أو الهاتف لإنشاء الحساب.';
    const fields = document.createElement('div');
    fields.className = 'alwaha-reg-optional-fields';
    details.append(summary, hint, fields);
    for (const node of [avatar, lastName, email, phoneRow, customCode, gender, birthdateBlock]) {
      if (node && node !== button && node !== details && node.parentElement) fields.appendChild(node);
    }
    form.insertBefore(details, button);
    // Keep the login handle visible beside the name and password; suggest one automatically.
    form.insertBefore(username, password);
    if (usernameHelp) form.insertBefore(usernameHelp, password);
    username.placeholder = 'اسم المستخدم (جاهز تلقائيًا ويمكنك تغييره)';
    username.autocomplete = 'username';
    username.autocapitalize = 'none';
    username.spellcheck = false;
    if (!username.value.trim()) {
      username.value = typeof window.generateAlwahaUsername === 'function'
        ? window.generateAlwahaUsername()
        : 'alwaha_' + Math.random().toString(36).slice(2, 10);
    }
    button.textContent = 'إنشاء الحساب مجانًا';
    button.setAttribute('aria-label', 'إنشاء حساب جديد');

    if (!document.getElementById('alwaha-registration-polish-style')) {
      const style = document.createElement('style');
      style.id = 'alwaha-registration-polish-style';
      style.textContent =
        '#sub-prof-register .alwaha-reg-intro{padding:12px 14px;margin:0 0 12px;border:1px solid rgba(0,255,136,.28);border-radius:13px;background:linear-gradient(120deg,rgba(0,255,136,.08),rgba(0,210,255,.05));display:flex;flex-direction:column;gap:5px}' +
        '#sub-prof-register .alwaha-reg-intro strong{color:#00ffad;font-size:14px}' +
        '#sub-prof-register .alwaha-reg-intro span{color:#9fb4c6;font-size:11px;line-height:1.7}' +
        '#sub-prof-register .alwaha-reg-optional{margin:4px 0 13px;border:1px solid rgba(130,170,200,.25);border-radius:11px;background:rgba(255,255,255,.025);padding:10px}' +
        '#sub-prof-register .alwaha-reg-optional summary{color:#b8d6e8;font-size:12px;cursor:pointer;list-style:none}' +
        '#sub-prof-register .alwaha-reg-optional summary::-webkit-details-marker{display:none}' +
        '#sub-prof-register .alwaha-reg-optional summary:after{content:"＋";float:left;color:#00ffb0;font-size:16px}' +
        '#sub-prof-register .alwaha-reg-optional[open] summary:after{content:"－"}' +
        '#sub-prof-register .alwaha-reg-optional-hint{color:#829cb1;font-size:10px;line-height:1.7;margin:9px 0}' +
        '#sub-prof-register .alwaha-reg-optional-fields{padding-top:4px}' +
        '#sub-prof-register #reg-username{direction:ltr;text-align:left}' +
        '#sub-prof-register #reg-avatar-preview{margin-top:8px}';
      document.head.appendChild(style);
    }
    form.dataset.polishApplied = '1';
  }

  const nativeRegister = window.handleNewUserRegistrationSubmit;
  let registrationInFlight = false;
  if (typeof nativeRegister === 'function') {
    window.handleNewUserRegistrationSubmit = async function (...args) {
      if (registrationInFlight) return undefined;
      const confirm = $('reg-confirm-password');
      const form = $('sub-prof-register');
      const button = form && form.querySelector('button[onclick="handleNewUserRegistrationSubmit()"]');
      const originalText = button ? button.textContent : '';
      registrationInFlight = true;
      if (confirm && !confirm.value) confirm.value = $('reg-password')?.value || '';
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.innerHTML = '<span class="alwaha-button-spinner" aria-hidden="true"></span><span>جاري إنشاء الحساب...</span>';
      }
      try {
        return await nativeRegister.apply(this, args);
      } catch (error) {
        console.error('Alwaha registration:', error);
        if (typeof window.triggerToastNotification === 'function') window.triggerToastNotification('تعذر إكمال التسجيل الآن. تحقق من الاتصال وحاول مرة أخرى.', 'error');
        return undefined;
      } finally {
        if (confirm) confirm.value = '';
        if (button) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.textContent = originalText || 'إنشاء الحساب مجانًا';
        }
        registrationInFlight = false;
      }
    };
  }
  if (!document.getElementById('alwaha-registration-progress-style')) {
    const style = document.createElement('style');
    style.id = 'alwaha-registration-progress-style';
    style.textContent = '.alwaha-button-spinner{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-left-color:transparent;border-radius:50%;vertical-align:middle;margin-inline-end:8px;animation:alwaha-spin .75s linear infinite}@keyframes alwaha-spin{to{transform:rotate(360deg)}}#sub-prof-register button[aria-busy="true"]{opacity:.78;cursor:wait}';
    document.head.appendChild(style);
  }

  // Multi-layer space-inspired ringing: warm chord, glassy arpeggio, soft low pulse and a short echo.
  let ringContext = null, ringTimer = null, ringPreviewTimer = null, ringOscillators = [];
  function stopLayeredRingtone() {
    if (ringTimer) clearInterval(ringTimer);
    if (ringPreviewTimer) clearTimeout(ringPreviewTimer);
    ringTimer = ringPreviewTimer = null;
    for (const osc of ringOscillators) { try { osc.stop(); } catch (_) {} }
    ringOscillators = [];
    const old = ringContext;
    ringContext = null;
    if (old && old.state !== 'closed') old.close().catch(() => {});
  }
  function addTone(ctx, bus, echo, start, frequency, offset, duration, volume, wave, slideTo, pan = 0) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = wave || 'sine';
    osc.frequency.setValueAtTime(frequency, start + offset);
    if (slideTo && slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, start + offset + duration);
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.001), start + offset + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
    let output = gain;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), start + offset);
      gain.connect(panner);
      output = panner;
    }
    output.connect(bus);
    output.connect(echo);
    osc.connect(gain);
    osc.onended = () => { ringOscillators = ringOscillators.filter((item) => item !== osc); };
    osc.start(start + offset);
    osc.stop(start + offset + duration + 0.04);
    ringOscillators.push(osc);
  }
  async function playLayeredRingtone(preview = false) {
    if (!preview && safeGet('alwaha_call_ringtone_enabled') === 'false') return;
    stopLayeredRingtone();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      if (preview && typeof window.triggerToastNotification === 'function') window.triggerToastNotification('الصوت غير مدعوم على هذا الجهاز.', 'error');
      return;
    }
    try {
      ringContext = new AudioContextClass();
      const ctx = ringContext;
      await ctx.resume();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24; compressor.knee.value = 20;
      compressor.ratio.value = 5; compressor.attack.value = 0.006; compressor.release.value = 0.24;
      const master = ctx.createGain(); master.gain.value = 0.72;
      master.connect(compressor); compressor.connect(ctx.destination);
      const delay = ctx.createDelay(0.6); delay.delayTime.value = 0.19;
      const echoGain = ctx.createGain(); echoGain.gain.value = 0.16;
      delay.connect(echoGain); echoGain.connect(compressor);
      const phrase = () => {
        if (ringContext !== ctx || ctx.state === 'closed') return;
        const start = ctx.currentTime + 0.045;
        const melody = [
          [659.25,0,.36,.060,'sine',783.99,-.45],[987.77,.31,.42,.052,'sine',1046.50,.35],
          [1318.51,.66,.47,.043,'sine',1174.66,.55],[1046.50,1.06,.38,.049,'sine',987.77,-.15],
          [783.99,1.42,.48,.051,'sine',659.25,-.55],[523.25,1.88,.43,.044,'sine',659.25,.43],
          [659.25,2.27,.38,.050,'sine',783.99,.10]
        ];
        for (const [f,o,d,v,w,s,p] of melody) addTone(ctx,master,delay,start,f,o,d,v,w,s,p);
        const low = [[130.81,.03,.68,.022,146.83],[164.81,.73,.66,.019,146.83],[196,1.42,.66,.018,174.61],[164.81,2.08,.65,.019,130.81]];
        for (const [f,o,d,v,s] of low) addTone(ctx,master,delay,start,f,o,d,v,'triangle',s,0);
        const sparkles = [[1567.98,.25],[1760,.96],[1396.91,1.71],[1567.98,2.30]];
        for (const [f,o] of sparkles) addTone(ctx,master,delay,start,f,o,.22,.014,'sine',f*.96,o%1>.5?-.4:.4);
      };
      phrase();
      if (preview) ringPreviewTimer = setTimeout(stopLayeredRingtone,5600);
      else ringTimer = setInterval(phrase,3300);
    } catch (error) {
      console.warn('Alwaha layered ringtone:',error);
      stopLayeredRingtone();
      if (preview && typeof window.triggerToastNotification === 'function') window.triggerToastNotification('لم تعمل النغمة. اضغط تجربة النغمة مرة أخرى.','info');
    }
  }
  function setRingtoneEnabled(enabled) {
    safeSet('alwaha_call_ringtone_enabled',enabled?'true':'false');
    if (!enabled) stopLayeredRingtone();
    if (typeof window.triggerToastNotification === 'function') window.triggerToastNotification(enabled?'تم تفعيل النغمة الفضائية للمكالمات الواردة.':'تم إيقاف نغمة المكالمات الواردة.','success');
  }
  window.playAlwahaCallRingtone = playLayeredRingtone;
  window.previewAlwahaCallRingtone = () => { void playLayeredRingtone(true); };
  window.stopAlwahaCallRingtone = stopLayeredRingtone;
  window.setAlwahaRingtoneEnabled = setRingtoneEnabled;

  function polishSoundDescription() {
    const button = document.querySelector('button[onclick="previewAlwahaCallRingtone()"]');
    const card = button?.parentElement;
    const note = card ? Array.from(card.children).find((child) => child.tagName === 'DIV') : null;
    if (note) note.textContent = 'نغمة فضائية أصلية من طبقات لحنية متعددة مع صدى ناعم ونبضات منخفضة. تعمل عند السماح بالصوت أثناء تشغيل التطبيق؛ الرنين بعد إغلاقه تمامًا يحتاج إشعارات واتصالًا أصليين.';
    if (button) button.innerHTML = '<i class="fa-solid fa-music"></i> تجربة النغمة الفضائية';
  }
  enhanceRegistrationForm();
  polishSoundDescription();

  // Local audio assets are intentionally not precached; the selected track loads only on demand.
  let ringtoneAudio = null;
  let ringtoneTimeout = null;
  function stopRingtoneMedia() {
    if (ringtoneTimeout) clearTimeout(ringtoneTimeout);
    ringtoneTimeout = null;
    if (ringtoneAudio) {
      try { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; ringtoneAudio.src = ''; } catch (_) {}
      ringtoneAudio = null;
    }
    try { stopLayeredRingtone(); } catch (_) {}
  }
  function ringtoneChoice() {
    // One-time rollout: switch the old default to Marimba Bloom, then preserve a manual choice.
    if (safeGet('alwaha_call_ringtone_choice_version') !== '2') {
      safeSet('alwaha_call_ringtone_choice_version', '2');
      safeSet('alwaha_ringtone_choice', 'marimba_bloom');
      return 'marimba_bloom';
    }
    const saved = safeGet('alwaha_ringtone_choice');
    return saved === 'saffron_tide' ? 'saffron_tide' : 'marimba_bloom';
  }
  function setRingtoneChoice(value, silent = false) {
    const chosen = value === 'marimba_bloom' ? 'marimba_bloom' : 'saffron_tide';
    safeSet('alwaha_ringtone_choice', chosen);
    const select = $('alwaha-ringtone-choice');
    if (select) select.value = chosen;
    stopRingtoneMedia();
    if (!silent && typeof window.triggerToastNotification === 'function') {
      window.triggerToastNotification(chosen === 'marimba_bloom' ? 'تم اختيار Marimba Bloom كنغمة للمكالمات.' : 'تم اختيار Saffron Tide كنغمة للمكالمات.', 'success');
    }
  }
  async function playChosenRingtone(preview = false) {
    if (!preview && safeGet('alwaha_call_ringtone_enabled') === 'false') return;
    stopRingtoneMedia();
    const source = ringtoneChoice() === 'marimba_bloom' ? './assets/sounds/marimba_bloom.mp3' : './assets/sounds/saffron_tide.mp3';
    try {
      const audio = new Audio(source);
      ringtoneAudio = audio;
      audio.preload = 'none';
      audio.loop = !preview;
      audio.volume = 0.78;
      if (preview) audio.addEventListener('ended', () => { if (ringtoneAudio === audio) { ringtoneAudio = null; if (ringtoneTimeout) clearTimeout(ringtoneTimeout); ringtoneTimeout = null; } }, { once: true });
      await audio.play();
    } catch (error) {
      console.warn('Supplied ringtone could not play; using the built-in fallback.', error);
      stopRingtoneMedia();
      try { await playLayeredRingtone(preview); }
      catch (_) { if (preview && typeof window.triggerToastNotification === 'function') window.triggerToastNotification('لم يبدأ الصوت. ارفع صوت الجهاز ثم اضغط التجربة مرة أخرى.', 'info'); }
    }
  }
  function setRingtoneEnabled(enabled, silent = false) {
    safeSet('alwaha_call_ringtone_enabled', enabled ? 'true' : 'false');
    if (!enabled) stopRingtoneMedia();
    const check = $('alwaha-call-ringtone-enabled');
    if (check) check.checked = !!enabled;
    if (!silent && typeof window.triggerToastNotification === 'function') window.triggerToastNotification(enabled ? 'تم تفعيل نغمة المكالمات.' : 'تم إيقاف نغمة المكالمات.', 'success');
  }
  window.setAlwahaRingtoneChoice = setRingtoneChoice;
  window.setAlwahaRingtoneEnabled = setRingtoneEnabled;
  window.previewAlwahaCallRingtone = () => { void playChosenRingtone(true); };
  window.playAlwahaCallRingtone = (preview = false) => { void playChosenRingtone(!!preview); };
  window.stopAlwahaCallRingtone = stopRingtoneMedia;

  const AR_TO_EN = {
    'الرئيسية':'Home','السوق':'Market','الشبكة':'File sharing','محادثة':'Chats','ريلز':'Reels','الألعاب':'Games','حسابي':'My profile',
    'التنبيهات':'Notifications','تثبيت تطبيق الواحة بروفيشينال':'Install Alwaha-Pro','احصل على تجربة أسرع بدون فتح المتصفح':'A faster experience without opening the browser','تثبيت الآن':'Install now',
    'سوق Alwaha-Pro':'Alwaha-Pro Market','الشراء':'Buy','بيع سلعة':'Sell item','سلعي':'My items','إضافة إعلان جديد في السوق':'Create a marketplace listing','اسم المنتج أو السلعة':'Product name','السعر':'Price','التصنيف':'Category','الوصف والموقع':'Description and location','صور المنتج':'Product images','رفع صور المنتج':'Upload product images','نشر الإعلان الآن':'Publish listing',
    'إنشاء حساب جديد':'Create account','تسجيل الدخول':'Sign in','استعادة كلمة المرور بالبريد':'Recover password by email','إعدادات الخصوصية والاسم':'Privacy and name','طلب توثيق الحساب (العلامة الزرقاء)':'Request account verification','الضبط والخلفيات':'Settings and wallpapers','تسجيل الخروج':'Sign out','حفظ الإعدادات':'Save settings',
    'خلفيات التطبيق والمظهر':'App wallpapers and appearance','فضائي افتراضي':'Nebula','طبيعة':'Aurora','تكنولوجيا':'Underwater technology','هادئ':'Moonlit calm','متقدم':'Advanced','تنظيف الكاش وتسريع التطبيق':'Clear cache and speed up','تفعيل رنة الواحة الحصرية للمكالمات الواردة':'Enable Alwaha incoming-call ringtone','تجربة رنة الواحة الحديثة':'Preview ringtone','اختيار نغمة المكالمة':'Call ringtone','لغة التطبيق':'App language','توفير البيانات والتحميل الكسول للصور':'Data saver and lazy image loading','تقليل الحركة والمؤثرات':'Reduce motion and effects',
    'مشاركة الملفات المحلية':'Local file sharing','تفعيل وضع المشاركة الحرة':'Enable local sharing mode','ألعاب Alwaha-Pro':'Alwaha-Pro Games','ريلز Alwaha-Pro':'Alwaha-Pro Reels','إضافة محتوى':'Add content','مغادرة التطبيق؟':'Leave the app?','هل أنت متأكد من أنك تريد مغادرة واحة المحترفين؟':'Are you sure you want to leave Alwaha-Pro?','خروج':'Exit','إلغاء':'Cancel','نشر':'Publish','جاري جلب المنشورات...':'Loading posts…','جاري تحميل أعضاء الواحة...':'Loading members…','لا توجد رسائل بعد. ابدأ المحادثة.':'No messages yet. Start the conversation.','تعذر حفظ الرسالة.':'Could not save the message.','تم حفظ المظهر وتفعيله.':'Appearance saved and applied.'
  };
  const EN_TO_AR = Object.fromEntries(Object.entries(AR_TO_EN).map(([ar, en]) => [en, ar]));
  function activeLanguage() { return safeGet('alwaha_language') === 'en' ? 'en' : 'ar'; }
  function translateValue(value, lang) {
    const trimmed = String(value ?? '').trim();
    const map = lang === 'en' ? AR_TO_EN : EN_TO_AR;
    if (!Object.prototype.hasOwnProperty.call(map, trimmed)) return value;
    const left = String(value).match(/^\s*/)?.[0] || '';
    const right = String(value).match(/\s*$/)?.[0] || '';
    return left + map[trimmed] + right;
  }
  function safeToTranslate(node) {
    const parent = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!parent || !parent.closest) return false;
    return !parent.closest('script,style,textarea,input,select,option,code,pre,.user-content,[data-user-content],#chat-messages-container,#home-posts-feed-container,#reels-container');
  }
  function translateTree(root, lang) {
    if (!root || !document.body) return;
    const start = root.nodeType === Node.DOCUMENT_NODE ? document.body : root;
    if (start.nodeType === Node.TEXT_NODE) {
      if (safeToTranslate(start)) start.nodeValue = translateValue(start.nodeValue, lang);
      return;
    }
    if (start.nodeType !== Node.ELEMENT_NODE && start.nodeType !== Node.DOCUMENT_NODE) return;
    if (start.nodeType === Node.ELEMENT_NODE && !safeToTranslate(start)) return;
    const translateAttributes = (element) => {
      if (!element || element.closest?.('script,style,textarea,.user-content,[data-user-content],#chat-messages-container,#home-posts-feed-container,#reels-container')) return;
      for (const attr of ['placeholder','aria-label','title','alt']) {
        const current = element.getAttribute?.(attr);
        if (current) { const translated = translateValue(current, lang); if (translated !== current) element.setAttribute(attr, translated); }
      }
    };
    if (start.nodeType === Node.ELEMENT_NODE) {
      translateAttributes(start);
      start.querySelectorAll?.('*').forEach(translateAttributes);
    }
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!safeToTranslate(node)) continue;
      const translated = translateValue(node.nodeValue, lang);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    }
  }
  function setLanguage(value, silent = false) {
    const lang = value === 'en' ? 'en' : 'ar';
    safeSet('alwaha_language', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    const select = $('alwaha-language-choice');
    if (select) select.value = lang;
    translateTree(document.body, lang);
    if (!silent && typeof window.triggerToastNotification === 'function') window.triggerToastNotification(lang === 'en' ? 'App language set to English.' : 'تم ضبط لغة التطبيق إلى العربية.', 'success');
  }
  window.setAlwahaLanguage = setLanguage;

  function setDataSaver(enabled, silent = false) {
    safeSet('alwaha_data_saver', enabled ? 'true' : 'false');
    document.body.classList.toggle('alwaha-data-saver', !!enabled);
    document.querySelectorAll('.app-section img').forEach(img => { if (enabled) img.loading = 'lazy'; });
    const check = $('alwaha-data-saver'); if (check) check.checked = !!enabled;
    if (!silent && typeof window.triggerToastNotification === 'function') window.triggerToastNotification(enabled ? 'تم تفعيل توفير البيانات.' : 'تم إيقاف توفير البيانات.', 'success');
  }
  function setReducedMotion(enabled, silent = false) {
    safeSet('alwaha_reduced_motion', enabled ? 'true' : 'false');
    document.body.classList.toggle('alwaha-reduced-motion', !!enabled);
    const check = $('alwaha-reduced-motion'); if (check) check.checked = !!enabled;
    if (!silent && typeof window.triggerToastNotification === 'function') window.triggerToastNotification(enabled ? 'تم تقليل الحركة والمؤثرات.' : 'تمت استعادة المؤثرات.', 'success');
  }
  window.setAlwahaDataSaver = setDataSaver;
  window.setAlwahaReducedMotion = setReducedMotion;

  window.addEventListener('DOMContentLoaded', () => {
    setRingtoneChoice(ringtoneChoice(), true);
    setRingtoneEnabled(safeGet('alwaha_call_ringtone_enabled') !== 'false', true);
    const language = $('alwaha-language-choice');
    if (language) language.addEventListener('change', () => setLanguage(language.value));
    const ringtone = $('alwaha-ringtone-choice');
    if (ringtone) ringtone.addEventListener('change', () => setRingtoneChoice(ringtone.value));
    const saver = $('alwaha-data-saver');
    if (saver) saver.addEventListener('change', () => setDataSaver(saver.checked));
    const motion = $('alwaha-reduced-motion');
    if (motion) motion.addEventListener('change', () => setReducedMotion(motion.checked));
    setDataSaver(safeGet('alwaha_data_saver') === 'true', true);
    setReducedMotion(safeGet('alwaha_reduced_motion') === 'true', true);
    setLanguage(activeLanguage(), true);
    let translateTimer = null;
    const observer = new MutationObserver(records => {
      if (activeLanguage() !== 'en') return;
      if (translateTimer) clearTimeout(translateTimer);
      translateTimer = setTimeout(() => {
        for (const record of records) {
          if (record.type === 'characterData') translateTree(record.target, 'en');
          for (const node of record.addedNodes || []) translateTree(node, 'en');
        }
      }, 80);
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  });
})();
