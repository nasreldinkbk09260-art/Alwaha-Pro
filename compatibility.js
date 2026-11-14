/* Alwaha-Pro device compatibility and local performance tuner.
 * Diagnostics run on-device only. No device report or capability data is uploaded.
 * The score is an estimate of browser feature availability, not a guarantee of server/network health.
 */
(function () {
  'use strict';
  if (window.__ALWAHA_COMPATIBILITY_V1) return;
  window.__ALWAHA_COMPATIBILITY_V1 = true;

  function androidVersion() {
    const match = String(navigator.userAgent || '').match(/Android\s([0-9]+(?:\.[0-9]+)?)/i);
    return match ? Number(match[1]) : null;
  }
  function isNativeApp() {
    const cap = window.Capacitor;
    try {
      return !!(cap && ((typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) || (typeof cap.getPlatform === 'function' && ['android', 'ios'].includes(cap.getPlatform()))));
    } catch (_) { return false; }
  }
  function snapshot() {
    const nav = navigator;
    const media = nav.mediaDevices;
    const checks = [
      { id: 'core', label: 'تشغيل التطبيق والتنقل بين الأقسام', weight: 20, ok: !!(window.Promise && window.fetch && window.URL && window.Map && window.Set) },
      { id: 'server', label: 'تسجيل الدخول والاتصال بخدمات الواحة', weight: 15, ok: !!(window.fetch && window.WebSocket) },
      { id: 'cache', label: 'حفظ المحتوى مؤقتاً وتحسين التحميل', weight: 10, ok: !!(window.indexedDB || window.localStorage) },
      { id: 'voice', label: 'المكالمات الصوتية عبر الإنترنت', weight: 15, ok: !!(window.RTCPeerConnection && window.WebSocket && media && media.getUserMedia) },
      { id: 'video', label: 'مكالمات الفيديو', weight: 10, ok: !!(window.RTCPeerConnection && media && media.getUserMedia) },
      { id: 'record', label: 'تسجيل ونشر مقاطع الريلز بالكاميرا', weight: 10, ok: !!(window.MediaRecorder && media && media.getUserMedia) },
      { id: 'files', label: 'اختيار الملفات ورفع الصور والفيديو', weight: 10, ok: !!(window.FileReader && window.FormData && window.Blob) },
      { id: 'share', label: 'المشاركة المباشرة من قائمة الهاتف', weight: 5, ok: !!(nav.share || nav.clipboard) },
      { id: 'offline', label: 'التخزين المحلي والعمل دون اتصال جزئياً', weight: 5, ok: !!(window.caches && window.indexedDB) }
    ];
    const os = androidVersion();
    const native = isNativeApp();
    const nativeSupported = !(native && os !== null && os < 7);
    let score = checks.reduce((total, check) => total + (check.ok ? check.weight : 0), 0);
    if (!nativeSupported) score = 0;
    const unsupported = checks.filter(check => !check.ok);
    if (native && os !== null && os < 7) unsupported.unshift({ id: 'android-native', label: 'تثبيت وتشغيل النسخة الأصلية على هذا الإصدار من Android', weight: 0, ok: false });
    return { score, checks, os, native, nativeSupported, unsupported };
  }
  function localOptimize(persist = true) {
    document.documentElement.classList.add('alwaha-compat-lite');
    if (document.body) document.body.classList.add('alwaha-compat-lite');
    document.querySelectorAll('.app-section img').forEach((img, index) => {
      if (index > 1 && !img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
    });
    document.querySelectorAll('video').forEach(video => {
      if (video.preload !== 'none') video.preload = 'metadata';
    });
    window.__ALWAHA_COMPAT_OPTIMIZED = true;
    if (persist) { try { window.localStorage.setItem('alwaha_compat_lite_v1', '1'); } catch (_) {} }
  }
  function createPanel() {
    const anchor = document.getElementById('alwaha-ux-preferences');
    if (!anchor || document.getElementById('alwaha-device-compatibility')) return;
    const panel = document.createElement('section');
    panel.id = 'alwaha-device-compatibility';
    panel.setAttribute('aria-labelledby', 'alwaha-compat-title');
    panel.innerHTML = '<div class="alwaha-compat-head"><div><h4 id="alwaha-compat-title">توافق الجهاز</h4><p>فحص محلي لإمكانات الهاتف وتشغيل وضع الأداء الخفيف عند الحاجة.</p></div><strong id="alwaha-compat-score">--%</strong></div>' +
      '<div class="alwaha-compat-track" role="progressbar" aria-label="نسبة توافق الجهاز" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="alwaha-compat-bar"></span></div>' +
      '<div id="alwaha-compat-status" role="status" aria-live="polite">جاري البحث عن إمكانات الجهاز...</div>' +
      '<button type="button" id="alwaha-compat-run">توفيق الجهاز</button>' +
      '<div id="alwaha-compat-result" hidden></div>';
    anchor.insertAdjacentElement('afterend', panel);
    const run = document.getElementById('alwaha-compat-run');
    run.addEventListener('click', async function () {
      if (run.disabled) return;
      run.disabled = true;
      run.setAttribute('aria-busy', 'true');
      run.textContent = 'جاري التوفيق...';
      const status = document.getElementById('alwaha-compat-status');
      status.textContent = 'جاري البحث وضبط الأداء على هذا الجهاز...';
      try {
        await new Promise(resolve => setTimeout(resolve, 120));
        localOptimize();
        renderReport(snapshot(), true);
        run.textContent = 'إعادة التوفيق';
      } catch (error) {
        console.warn('[Alwaha Compatibility] Local optimization:', error);
        status.textContent = 'تعذر تطبيق بعض تحسينات الأداء؛ ما زال بإمكانك استخدام التطبيق.';
        run.textContent = 'إعادة المحاولة';
      } finally {
        run.disabled = false;
        run.removeAttribute('aria-busy');
      }
    });
    let optimized = false;
    try { optimized = window.localStorage.getItem('alwaha_compat_lite_v1') === '1'; } catch (_) {}
    if (optimized) localOptimize(false);
    renderReport(snapshot(), optimized);
  }
  function renderReport(report, optimized) {
    const score = document.getElementById('alwaha-compat-score');
    const bar = document.getElementById('alwaha-compat-bar');
    const status = document.getElementById('alwaha-compat-status');
    const result = document.getElementById('alwaha-compat-result');
    if (!score || !bar || !status || !result) return;
    score.textContent = report.score + '%';
    bar.style.width = report.score + '%';
    bar.setAttribute('aria-valuenow', String(report.score));
    bar.parentElement?.setAttribute('aria-valuenow', String(report.score));
    status.textContent = optimized ? 'اكتمل التوفيق المحلي. لم يتم إرسال بيانات الجهاز إلى أي خادم.' : 'اكتمل الفحص المحلي المبدئي.';
    const missing = report.unsupported.map(item => '<li>' + item.label + '</li>').join('');
    const osMessage = report.os === null ? '' : (report.os < 7 ? '<p class="alwaha-compat-warning">إصدار Android أقدم من الحد الأدنى للحزمة الأصلية الحالية.</p>' : '');
    const nativeMessage = report.native && !report.nativeSupported ? '<p class="alwaha-compat-warning">هذه الحزمة الأصلية لا تدعم إصدار Android الموجود على الجهاز.</p>' : '';
    result.hidden = false;
    result.innerHTML = '<p class="alwaha-compat-summary">' + (report.nativeSupported ? 'هذه نسبة التوافق التقديرية حسب الإمكانات المتاحة.' : 'لا يمكن تشغيل الحزمة الأصلية الحالية على إصدار النظام هذا.') + '</p>' + osMessage + nativeMessage +
      (missing ? '<div class="alwaha-compat-missing-title">ميزات قد لا تعمل بالكامل على هذا الجهاز</div><ul>' + missing + '</ul>' : '<p>لم يرصد الفحص المحلي نقصاً في الإمكانات الأساسية.</p>') +
      '<p class="alwaha-compat-footnote">قد تتأثر بعض الوظائف أيضاً بإذن النظام أو جودة الإنترنت أو إعدادات الخدمة.</p>';
  }
  window.getAlwahaCompatibilityReport = snapshot;
  window.runAlwahaCompatibilityOptimization = localOptimize;
  window.addEventListener('DOMContentLoaded', createPanel, { once: true });
})();
