/* Alwaha-Pro profile layout and self-service editor. Uses the authenticated profile-update Edge Function. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const safeGet = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const toast = (message, tone = 'info') => window.triggerToastNotification?.(message, tone);

  function enhanceProfileSection() {
    const section = $('profile-section');
    const header = section?.querySelector('.profile-card-header-view');
    const menu = section?.querySelector('.profile-options-menu-list');
    const deviceSuite = $('alwaha-device-suite');
    if (!section || !header || !menu) return;

    if (deviceSuite && !$('profile-device-suite-toggle')) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = 'profile-device-suite-toggle';
      toggle.className = 'profile-menu-btn alwaha-profile-device-toggle';
      toggle.setAttribute('aria-controls', 'alwaha-device-suite');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span><i class="fa-solid fa-sliders"></i> مساحة الواحة وإعدادات التجربة</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
      toggle.addEventListener('click', () => {
        deviceSuite.hidden = !deviceSuite.hidden;
        toggle.setAttribute('aria-expanded', String(!deviceSuite.hidden));
        toggle.querySelector('.fa-chevron-down')?.classList.toggle('fa-rotate-180', !deviceSuite.hidden);
      });
      header.after(toggle);
      toggle.after(deviceSuite);
      deviceSuite.hidden = true;
    }

    menu.querySelectorAll('div.profile-menu-btn[onclick]').forEach((old) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = old.className;
      if (old.id) button.id = old.id;
      if (old.getAttribute('onclick')) button.setAttribute('onclick', old.getAttribute('onclick'));
      button.innerHTML = old.innerHTML;
      button.style.cssText = old.style.cssText;
      button.style.width = '100%';
      button.style.border = button.style.border || '1px solid rgba(255,255,255,.08)';
      button.style.color = button.style.color || 'inherit';
      button.style.font = 'inherit';
      button.style.textAlign = 'right';
      button.style.cursor = 'pointer';
      old.replaceWith(button);
    });

    if (!$('profile-edit-menu-item')) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.id = 'profile-edit-menu-item';
      edit.className = 'profile-menu-btn alwaha-profile-edit-entry';
      edit.hidden = true;
      edit.setAttribute('aria-hidden', 'true');
      edit.innerHTML = '<span><i class="fa-solid fa-user-pen"></i> تعديل بياناتي وإكمال الملف الشخصي</span><i class="fa-solid fa-chevron-left" aria-hidden="true"></i>';
      edit.addEventListener('click', () => { void window.openAlwahaProfileEditor?.(); });
      const login = $('profile-login-menu-item');
      const recovery = menu.querySelector('[onclick*="sub-prof-recovery"]');
      if (login?.parentElement === menu) login.after(edit);
      else if (recovery?.parentElement === menu) recovery.before(edit);
      else menu.prepend(edit);
    }

    if (!$('sub-prof-profile-edit')) {
      const modal = document.createElement('div');
      modal.id = 'sub-prof-profile-edit';
      modal.className = 'sub-profile-view-box';
      modal.innerHTML = `
        <div class="alwaha-profile-editor-head"><h3><i class="fa-solid fa-user-pen"></i> تعديل بياناتي</h3><button type="button" class="btn-action alwaha-profile-editor-close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button></div>
        <form id="alwaha-profile-editor-form" novalidate>
          <div class="alwaha-profile-editor-avatar"><img id="profile-edit-avatar-preview" src="icon.png" alt="معاينة الصورة الشخصية"><button type="button" id="profile-edit-avatar-button"><i class="fa-solid fa-image"></i> تغيير الصورة الشخصية</button><p>الصورة اختيارية ويمكنك تغييرها في أي وقت.</p></div>
          <label for="profile-edit-first-name">الاسم الظاهر <b>(مطلوب)</b></label><input id="profile-edit-first-name" type="text" maxlength="80" autocomplete="given-name" required>
          <label for="profile-edit-last-name">اسم العائلة <small>(اختياري)</small></label><input id="profile-edit-last-name" type="text" maxlength="80" autocomplete="family-name">
          <label for="profile-edit-username">اسم المستخدم <b>(مطلوب)</b></label><input id="profile-edit-username" type="text" minlength="3" maxlength="32" pattern="[a-z0-9_]{3,32}" autocomplete="username" autocapitalize="none" spellcheck="false" dir="ltr" required><p class="alwaha-profile-editor-hint">من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو _، ويجب أن يكون غير مستخدم.</p>
          <label for="profile-edit-email">البريد الإلكتروني <small>(اختياري)</small></label><input id="profile-edit-email" type="email" maxlength="254" autocomplete="email" inputmode="email"><p class="alwaha-profile-editor-hint">إضافة بريد جديد ترسل رسالة تأكيد. لا يصبح البريد صالحًا للاستعادة قبل تأكيده؛ اتركه كما هو إذا لم ترد تغييره.</p>
          <label for="profile-edit-phone">رقم الهاتف <small>(اختياري)</small></label><input id="profile-edit-phone" type="tel" maxlength="32" autocomplete="tel" inputmode="tel" placeholder="مثال: +201xxxxxxxxx" dir="ltr"><p class="alwaha-profile-editor-hint">رقم خاص لا يُستخدم لتسجيل الدخول أو استعادة كلمة المرور.</p>
          <label for="profile-edit-gender">النوع <small>(اختياري)</small></label><select id="profile-edit-gender"><option value="">— النوع اختياري —</option><option value="ذكر">ذكر</option><option value="أنثى">أنثى</option></select>
          <label for="profile-edit-birthdate">تاريخ الميلاد <small>(اختياري)</small></label><input id="profile-edit-birthdate" type="date" autocomplete="bday">
          <button type="submit" id="profile-edit-save-button"><i class="fa-solid fa-floppy-disk"></i> حفظ بياناتي</button>
        </form>`;
      document.body.appendChild(modal);
      window.AlwahaModalShell?.sync?.();
      modal.querySelector('.alwaha-profile-editor-close')?.addEventListener('click', () => window.closeSubProfileView?.('sub-prof-profile-edit'));
      modal.querySelector('#profile-edit-avatar-button')?.addEventListener('click', () => { void window.handleAlwahaProfileAvatarPick?.(); });
      modal.querySelector('#alwaha-profile-editor-form')?.addEventListener('submit', (event) => { event.preventDefault(); void window.saveAlwahaProfileDetails?.(event); });
    }

    if (!$('alwaha-profile-editor-style')) {
      const style = document.createElement('style');
      style.id = 'alwaha-profile-editor-style';
      style.textContent = `
        #profile-section .profile-options-menu-list .profile-menu-btn,#profile-device-suite-toggle{width:100%;min-height:46px;box-sizing:border-box;border:1px solid rgba(255,255,255,.10);font:inherit;text-align:right;cursor:pointer}
        #profile-section .profile-menu-btn:focus-visible,#profile-device-suite-toggle:focus-visible{outline:2px solid #8bf4ff;outline-offset:3px}
        #profile-device-suite-toggle{display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:12px;margin:0 0 10px;background:rgba(139,244,255,.07);color:#8bf4ff;border-color:#8bf4ff33}
        #profile-device-suite-toggle span{font-size:13px}
        #sub-prof-profile-edit{overflow-y:auto;max-height:calc(100dvh - 24px);padding-bottom:max(18px,env(safe-area-inset-bottom))}
        #sub-prof-profile-edit .alwaha-profile-editor-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
        #sub-prof-profile-edit .alwaha-profile-editor-head h3{margin:0;color:#8bf4ff;font-size:16px}
        #sub-prof-profile-edit .alwaha-profile-editor-close{background:transparent;color:#fff;font-size:16px}
        #sub-prof-profile-edit .alwaha-profile-editor-avatar{text-align:center;margin:0 0 16px}
        #sub-prof-profile-edit #profile-edit-avatar-preview{display:block;width:88px;height:88px;object-fit:cover;border-radius:50%;border:2px solid #8bf4ff;margin:0 auto 8px}
        #sub-prof-profile-edit #profile-edit-avatar-button{border:1px solid #8bf4ff66;background:#8bf4ff18;color:#8bf4ff;border-radius:18px;padding:8px 14px;font:700 11px Cairo,sans-serif}
        #sub-prof-profile-edit .alwaha-profile-editor-avatar p,#sub-prof-profile-edit .alwaha-profile-editor-hint{color:#8fa9bc;font-size:10px;line-height:1.7;margin:5px 0 11px}
        #sub-prof-profile-edit label{display:block;color:#cfe7f5;font-size:11px;margin:0 0 5px}
        #sub-prof-profile-edit label b{color:#8bf4ff;font-weight:700}
        #sub-prof-profile-edit label small{color:#8fa9bc;font-size:10px}
        #sub-prof-profile-edit input,#sub-prof-profile-edit select{display:block;box-sizing:border-box;width:100%;min-height:42px;background:rgba(0,0,0,.3);border:1px solid #44515d;padding:10px;border-radius:8px;color:#fff;font:12px Cairo,sans-serif;margin:0 0 10px}
        #sub-prof-profile-edit #profile-edit-username,#sub-prof-profile-edit #profile-edit-phone{direction:ltr;text-align:left}
        #sub-prof-profile-edit #profile-edit-save-button{width:100%;min-height:46px;background:#8bf4ff;color:#07131b;border:0;border-radius:9px;font:800 13px Cairo,sans-serif;margin-top:8px}
        #sub-prof-profile-edit button:focus-visible,#sub-prof-profile-edit input:focus-visible,#sub-prof-profile-edit select:focus-visible{outline:2px solid #8bf4ff;outline-offset:2px}
      `;
      document.head.appendChild(style);
    }
  }

  async function syncProfileEditorVisibility() {
    const button = $('profile-edit-menu-item');
    if (!button) return;
    let signedIn = false;
    try { signedIn = !!(await window.getCurrentAuthUser?.())?.id; } catch (_) {}
    button.hidden = !signedIn;
    button.setAttribute('aria-hidden', String(!signedIn));
    button.style.display = signedIn ? 'flex' : 'none';
  }

  function wrapAuthMenuSync() {
    const original = window.syncProfileAuthMenu;
    if (typeof original !== 'function' || original.__alwahaProfileEditorWrapped) return;
    const wrapped = async function (...args) {
      const result = await original.apply(this, args);
      await syncProfileEditorVisibility();
      return result;
    };
    wrapped.__alwahaProfileEditorWrapped = true;
    window.syncProfileAuthMenu = wrapped;
  }

  async function loadProfileEditor() {
    const user = await window.requireAuthenticatedUser?.('سجّل الدخول أولاً لتعديل بياناتك.');
    if (!user) return false;
    const profile = await window.getCurrentProfile?.();
    const active = await window.getCurrentAuthUser?.();
    if (!profile || active?.id !== user.id) {
      toast('تعذر تحميل بيانات حسابك الآن. تحقق من الاتصال.', 'error');
      return false;
    }
    const set = (id, value) => { const node = $(id); if (node) node.value = value ?? ''; };
    set('profile-edit-first-name', profile.first_name || '');
    set('profile-edit-last-name', profile.last_name || '');
    set('profile-edit-username', profile.username || '');
    const authEmail = String(user.email || '').trim();
    set('profile-edit-email', authEmail.toLowerCase().endsWith('@auth.alwaha.invalid') ? '' : authEmail);
    set('profile-edit-phone', profile.phone || '');
    set('profile-edit-gender', ['ذكر','أنثى'].includes(profile.gender) ? profile.gender : '');
    set('profile-edit-birthdate', profile.birthdate || '');
    const avatar = $('profile-edit-avatar-preview');
    if (avatar) {
      avatar.src = profile.avatar_url || safeGet('alwaha_profile_avatar') || 'icon.png';
      avatar.onerror = () => { avatar.onerror = null; avatar.src = 'icon.png'; };
    }
    return true;
  }

  window.openAlwahaProfileEditor = async function () {
    window.openSubProfileView?.('sub-prof-profile-edit');
    window.AlwahaModalShell?.sync?.();
    await loadProfileEditor();
  };

  let profileSaveInFlight = false;
  window.saveAlwahaProfileDetails = async function (event) {
    event?.preventDefault?.();
    if (profileSaveInFlight) return;
    const user = await window.requireAuthenticatedUser?.('سجّل الدخول أولاً لتعديل بياناتك.');
    if (!user) return;
    const firstName = String($('profile-edit-first-name')?.value || '').trim();
    const lastName = String($('profile-edit-last-name')?.value || '').trim();
    const username = String($('profile-edit-username')?.value || '').trim().toLowerCase();
    const email = String($('profile-edit-email')?.value || '').trim().toLowerCase();
    const rawPhone = String($('profile-edit-phone')?.value || '').trim();
    const phone = rawPhone ? window.normalizeAlwahaPhone?.(rawPhone, '+20', '') : '';
    const gender = String($('profile-edit-gender')?.value || '');
    const birthdate = String($('profile-edit-birthdate')?.value || '').trim();
    if (!firstName || firstName.length > 80) return toast('اكتب الاسم الظاهر، وبحد أقصى 80 حرفًا.', 'error');
    if (lastName.length > 80) return toast('اسم العائلة أطول من الحد المسموح.', 'error');
    if (!/^[a-z0-9_]{3,32}$/.test(username)) return toast('اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو _.', 'error');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast('صيغة البريد الإلكتروني غير صحيحة.', 'error');
    if (rawPhone && !phone) return toast('اكتب رقم الهاتف بصيغة دولية صحيحة مثل +201xxxxxxxxx.', 'error');
    if (gender && !['ذكر', 'أنثى'].includes(gender)) return toast('اختر قيمة صحيحة للنوع.', 'error');
    if (birthdate) {
      const date = new Date(birthdate + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== birthdate || date.getTime() > Date.now()) {
        return toast('تاريخ الميلاد غير صحيح.', 'error');
      }
    }
    const button = $('profile-edit-save-button');
    const original = button?.innerHTML || '';
    profileSaveInFlight = true;
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'جارٍ حفظ البيانات…'; }
    try {
      const result = await window.alwahaInvokeEdgeFunction('profile-update', {
        first_name: firstName, last_name: lastName, username, email,
        phone: phone || '', gender: gender || null, birthdate: birthdate || null,
      });
      safeSet('alwaha_last_username', username);
      await window.hydrateAuthProfile?.(user);
      window.syncUiWithLoadedProfileData?.();
      window.closeSubProfileView?.('sub-prof-profile-edit');
      let notice = 'تم حفظ بيانات ملفك الشخصي.';
      let tone = 'success';
      if (result.email_error) { notice += ' لم نتمكن من طلب تأكيد البريد: ' + result.email_error; tone = 'info'; }
      else if (result.email_update_requested) { notice += ' أرسلنا رسالة تأكيد إلى البريد الجديد؛ أكّد البريد حتى تتمكن من استخدامه في الاستعادة.'; tone = 'info'; }
      toast(notice, tone);
    } catch (error) {
      console.warn('[Alwaha Profile] Update failed:', error?.message || 'profile_update_failed');
      toast(error?.message || 'تعذر حفظ البيانات الآن. تحقق من الاتصال وحاول مجددًا.', 'error');
    } finally {
      profileSaveInFlight = false;
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); button.innerHTML = original || '<i class="fa-solid fa-floppy-disk"></i> حفظ بياناتي'; }
    }
  };

  window.handleAlwahaProfileAvatarPick = async function () {
    const user = await window.requireAuthenticatedUser?.('سجّل الدخول أولاً لتغيير الصورة الشخصية.');
    if (!user) return;
    if (typeof window.pickFilesFromDevice !== 'function' || typeof window.uploadFileToStorage !== 'function') {
      return toast('اختيار الصور غير متاح الآن. حدّث التطبيق ثم حاول مجددًا.', 'error');
    }
    window.pickFilesFromDevice({ accept: 'image/*', multiple: false, onFiles: async (files) => {
      const original = files?.[0];
      if (!original) return;
      try {
        const file = typeof window.compressImageFile === 'function' ? await window.compressImageFile(original, 900, .82) : original;
        const url = await window.uploadFileToStorage(file, 'avatars', { maxBytes: 5 * 1024 * 1024 });
        if (!url) return;
        await window.alwahaInvokeEdgeFunction('profile-update', { avatar_url: url });
        safeSet('alwaha_profile_avatar', url);
        const preview = $('profile-edit-avatar-preview');
        if (preview) preview.src = url;
        await window.hydrateAuthProfile?.(user);
        window.syncUiWithLoadedProfileData?.();
        toast('تم تحديث الصورة الشخصية.', 'success');
      } catch (error) {
        console.warn('[Alwaha Profile] Avatar update failed:', error?.message || 'avatar_update_failed');
        toast(error?.message || 'تعذر رفع الصورة الآن. حاول مرة أخرى.', 'error');
      }
    }});
  };

  window.savePrivacyProfileUpdates = async function () {
    const user = await window.requireAuthenticatedUser?.('سجّل الدخول أولاً لتعديل الخصوصية.');
    if (!user) return;
    const fullName = String($('privacy-new-name')?.value || '').trim();
    if (fullName) {
      if (fullName.length > 80) return toast('الاسم أطول من الحد المسموح.', 'error');
      const parts = fullName.split(/\s+/);
      try {
        await window.alwahaInvokeEdgeFunction('profile-update', { first_name: parts.shift(), last_name: parts.join(' ') });
        safeSet('alwaha_profile_name', fullName);
      } catch (error) {
        return toast(error?.message || 'تعذر حفظ الاسم.', 'error');
      }
    }
    await window.hydrateAuthProfile?.(user);
    window.syncUiWithLoadedProfileData?.();
    toast('تم حفظ بيانات الملف الشخصي والخصوصية.', 'success');
    window.closeSubProfileView?.('sub-prof-privacy');
  };

  window.handleVerificationAvatarPick = async function () {
    const user = await window.requireAuthenticatedUser?.('سجّل الدخول أولاً لرفع الصورة الشخصية.');
    if (!user) return;
    if (typeof window.pickFilesFromDevice !== 'function' || typeof window.uploadFileToStorage !== 'function') {
      return toast('اختيار الصور غير متاح الآن. حدّث التطبيق ثم حاول مجددًا.', 'error');
    }
    window.pickFilesFromDevice({ accept: 'image/*', multiple: false, onFiles: async (files) => {
      const original = files?.[0];
      if (!original) return;
      try {
        const file = typeof window.compressImageFile === 'function' ? await window.compressImageFile(original, 900, .82) : original;
        const url = await window.uploadFileToStorage(file, 'avatars', { maxBytes: 5 * 1024 * 1024 });
        if (!url) return;
        await window.alwahaInvokeEdgeFunction('profile-update', { avatar_url: url });
        safeSet('alwaha_profile_avatar', url);
        await window.hydrateAuthProfile?.(user);
        window.syncUiWithLoadedProfileData?.();
        toast('تم تحديث الصورة الشخصية.', 'success');
      } catch (error) {
        console.warn('[Alwaha Profile] Verification avatar update failed:', error?.message || 'avatar_update_failed');
        toast(error?.message || 'تعذر رفع الصورة؛ تحقق من الاتصال ثم حاول مجددًا.', 'error');
      }
    }});
  };

  function initialize() {
    enhanceProfileSection();
    wrapAuthMenuSync();
    void syncProfileEditorVisibility();
  }
  window.AlwahaProfileEditor = { initialize, load: loadProfileEditor };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();