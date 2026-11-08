(() => {
  'use strict';

  const IDS = {
    panel: 'alwaha-smart-assistant',
    message: 'alwaha-smart-assistant-message',
    action: 'alwaha-smart-assistant-action',
    textarea: 'home-post-textarea',
    image: 'home-post-image-preview',
    feed: 'home-posts-feed-container',
    badge: 'notification-badge-home'
  };

  function chooseSuggestion(state = {}) {
    if (state.online === false) {
      return {
        key: 'offline',
        title: 'تصفّحك مستمر دون إنترنت',
        message: 'يمكنك متابعة آخر المنشورات التي حُفظت على هذا الجهاز. سنحدّث المحتوى عند عودة الاتصال.',
        actionLabel: 'عرض المنشورات المحفوظة',
        action: 'feed'
      };
    }
    if (state.hasDraft) {
      return {
        key: 'draft',
        title: 'لديك مسودة لم تكتمل',
        message: 'النص أو الصورة التي اخترتها ما زالت في مساحة الكتابة. راجعها قبل النشر أو أزل الصورة عند الحاجة.',
        actionLabel: 'العودة إلى المسودة',
        action: 'draft'
      };
    }
    if (Number(state.unreadCount) > 0) {
      return {
        key: 'notifications',
        title: 'لديك تنبيهات تنتظر مراجعتك',
        message: 'افتح مركز التنبيهات لمراجعة الرسائل وطلبات الصداقة والتحديثات، واختر بنفسك ما تريد التعامل معه.',
        actionLabel: 'عرض التنبيهات',
        action: 'notifications'
      };
    }
    if (state.profileComplete === false) {
      return {
        key: 'profile',
        title: 'أكمل ملفك الشخصي',
        message: 'إضافة اسم وصورة مناسبة تساعد الآخرين على التعرّف عليك. لا نرسل هذه البيانات إلى مساعد خارجي.',
        actionLabel: 'فتح حسابي',
        action: 'profile'
      };
    }
    return {
      key: 'discover',
      title: 'اكتشف ما يناسبك الآن',
      message: 'يمكنك استكشاف عروض السوق أو متابعة المحادثات والريلز. اختر القسم الذي تحتاجه.',
      actionLabel: 'استكشاف السوق',
      action: 'market'
    };
  }

  function readState() {
    const textarea = document.getElementById(IDS.textarea);
    const image = document.getElementById(IDS.image);
    const badge = document.getElementById(IDS.badge);
    const imageSelected = !!image && image.style.display !== 'none' && !!image.getAttribute('src');
    const hasDraft = !!String(textarea?.value || '').trim() || imageSelected;
    const badgeText = String(badge?.textContent || '').trim();
    const unreadCount = badgeText === '99+' ? 100 : Math.max(0, Number(badgeText) || 0);
    let profileComplete = true;
    try {
      const name = String(localStorage.getItem('alwaha_profile_name') || '').trim();
      const userId = String(localStorage.getItem('alwaha_auth_user_id') || '').trim();
      profileComplete = !userId || !!name;
    } catch (_) {}
    return {
      online: navigator.onLine !== false,
      hasDraft,
      unreadCount,
      profileComplete
    };
  }

  function runAction(action) {
    if (action === 'draft') {
      const textarea = document.getElementById(IDS.textarea);
      const composer = textarea?.closest?.('#home-section > div');
      (composer || textarea)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      textarea?.focus?.({ preventScroll: true });
      return;
    }
    if (action === 'feed') {
      const feed = document.getElementById(IDS.feed);
      feed?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      if (typeof window.renderHomePostsFeed === 'function') void window.renderHomePostsFeed();
      return;
    }
    if (action === 'notifications') {
      if (typeof window.toggleInternalNotificationCenter === 'function') void window.toggleInternalNotificationCenter();
      return;
    }
    if (action === 'profile' || action === 'market') {
      const target = action === 'profile' ? 'profile-section' : 'market-section';
      const button = document.querySelector(action === 'profile' ? '.nav-item.profile-me' : '.nav-item.market-center');
      if (button) button.click();
      else if (typeof window.showSection === 'function') window.showSection(target);
    }
  }

  let observer = null;
  let initialized = false;
  function refresh() {
    const panel = document.getElementById(IDS.panel);
    const message = document.getElementById(IDS.message);
    const action = document.getElementById(IDS.action);
    if (!panel || !message || !action) return null;
    const suggestion = chooseSuggestion(readState());
    panel.dataset.state = suggestion.key;
    const title = panel.querySelector('[data-smart-title]');
    if (title) title.textContent = suggestion.title;
    message.textContent = suggestion.message;
    action.textContent = suggestion.actionLabel;
    action.dataset.action = suggestion.action;
    return suggestion;
  }

  function initialize() {
    if (initialized || !document.body) return;
    const panel = document.getElementById(IDS.panel);
    if (!panel) return;
    initialized = true;
    const action = document.getElementById(IDS.action);
    action?.addEventListener('click', () => runAction(action.dataset.action || ''));
    document.getElementById(IDS.textarea)?.addEventListener('input', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    const badge = document.getElementById(IDS.badge);
    if (badge && typeof MutationObserver === 'function') {
      observer = new MutationObserver(refresh);
      observer.observe(badge, { childList: true, characterData: true, attributes: true, subtree: true });
    }
    const image = document.getElementById(IDS.image);
    if (image && typeof MutationObserver === 'function') {
      const imageObserver = new MutationObserver(refresh);
      imageObserver.observe(image, { attributes: true, attributeFilter: ['src', 'style'] });
    }
    refresh();
  }

  window.AlwahaSmartAssistant = { chooseSuggestion, refresh, initialize };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
