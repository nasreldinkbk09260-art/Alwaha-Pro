/* Alwaha-Pro 2.8.6: online chess, two-player Ludo, and War (playing cards). */
(() => {
  'use strict';

  const GAME_INFO = {
    chess: { title: 'الشطرنج', icon: '♟️', color: '#70d6ff', description: 'شطرنج بقواعد قانونية كاملة، بما فيها الكش والكش مات والتعادل.' },
    ludo: { title: 'ليدو', icon: '🎲', color: '#00e0a4', description: 'ليدو لشخصين: رمي النرد، إخراج القطع، أكل قطع الخصم والوصول إلى النهاية.' },
    war: { title: 'الكتشينة — حرب الورق', icon: '🂡', color: '#ffd166', description: 'ورق لعب قياسي؛ أعلى ورقة تفوز بالجولة، والتعادل يفعّل الحرب.' }
  };
  const SESSION = { room: null, user: null, timer: null, loading: false, pollGeneration: 0, syncFailed: false, roomActionBusy: false, qrScanner: null, lastRenderKey: '', selectedSquare: null, legalTargets: [], game: null, busy: false };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const toast = (message, type = 'info') => {
    if (typeof window.triggerToastNotification === 'function') window.triggerToastNotification(message, type);
    else console.info(message);
  };

  function addStyles() {
    if ($('alwaha-games-v283-style')) return;
    const style = document.createElement('style');
    style.id = 'alwaha-games-v283-style';
    style.textContent = `
      /* ALWAHA FIELD REPAIR: viewport-safe room dialog and legacy WebView fallback */
      .game-modal-overlay{position:fixed!important;inset:0!important;width:100%!important;height:100vh!important;z-index:2147482500!important;align-items:center!important;justify-content:center!important;overflow-y:auto!important;overflow-x:hidden!important;box-sizing:border-box!important;padding:12px!important}
      .alwaha-game-page.game-modal-overlay{z-index:2147483200!important;align-items:stretch!important;justify-content:stretch!important;overflow:hidden!important;padding:0!important;background:rgba(3,8,17,.97)!important;}
      .alwaha-game-page>.game-modal-card{display:flex!important;flex-direction:column!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;overflow:hidden!important;box-sizing:border-box!important;padding:calc(10px + env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))!important;}
      .alwaha-game-page #mp-room-stage{flex:1 1 auto!important;min-height:0!important;width:100%!important;overflow:auto!important;overscroll-behavior:contain!important;padding:4px 0!important;}
      .alwaha-game-page #mp-room-meta{flex:0 0 auto!important;}
      .alwaha-game-page .mp-help{flex:0 0 auto!important;max-height:72px!important;overflow:auto!important;}
      @supports(height:100dvh){.alwaha-game-page>.game-modal-card{height:100dvh!important;}}
      #alwaha-multiplayer-room.alwaha-game-page>.game-modal-card{display:flex!important;flex-direction:column!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;overflow:hidden!important;box-sizing:border-box!important;padding:calc(10px + env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))!important}
      @supports(height:100dvh){.game-modal-overlay{height:100dvh!important}#alwaha-multiplayer-room .game-modal-card{max-height:calc(100dvh - 24px)!important}}

      .mp-game-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:12px 0 20px}
      .mp-game-card{border:1px solid #ffffff20;background:linear-gradient(145deg,#142033,#0c111d);border-radius:16px;padding:14px;min-width:0}
      .mp-game-icon{font-size:34px;margin-bottom:7px}.mp-game-title{font-size:16px;color:#fff;font-weight:900}.mp-game-desc{font-size:11px;line-height:1.8;color:#b7c1d1;min-height:43px;margin:7px 0 11px}
      .mp-action{border:0;border-radius:10px;padding:9px 12px;font-family:inherit;font-weight:800;font-size:11px;cursor:pointer;margin:3px;max-width:100%}
      .mp-join-code-form{display:grid;gap:8px;margin:10px 0 2px;padding:11px;border:1px solid #70d6ff55;border-radius:13px;background:linear-gradient(145deg,#14263b,#0d1726)}
      .mp-join-code-form label{font-size:11px;font-weight:900;color:#e8f4ff}
      .mp-join-code-form input{width:100%;min-width:0;box-sizing:border-box;border:1px solid #70d6ff65;border-radius:10px;background:#071321;color:#fff;padding:11px 12px;text-align:center;letter-spacing:4px;font:800 17px Cairo,sans-serif;text-transform:uppercase;outline:none}
      .mp-join-code-form input:focus{border-color:#70d6ff;box-shadow:0 0 0 3px #70d6ff22}
      .mp-join-code-actions{display:flex;gap:6px;flex-wrap:wrap}.mp-join-code-actions button{flex:1 1 105px;margin:0}
      .mp-join-code-help{font-size:9px;line-height:1.7;color:#aebed1;margin:0}
      .mp-room-qr-panel{display:grid;justify-items:center;gap:7px;margin:10px auto;padding:12px;width:min(100%,270px);box-sizing:border-box;background:#fff;border-radius:15px;color:#182333}
      .mp-room-qr-panel img{display:block;width:min(100%,220px);height:auto;aspect-ratio:1;object-fit:contain;image-rendering:pixelated}
      .mp-room-qr-panel p{margin:0;color:#26364c;font:700 10px/1.7 Cairo,sans-serif;text-align:center}
      #mp-room-code-value{width:min(100%,230px);box-sizing:border-box;font:900 23px Cairo,sans-serif;letter-spacing:5px;color:#ffd166;background:#0005;border:1px dashed #ffd16670;border-radius:12px;padding:8px;text-align:center;user-select:all}
      .mp-qr-camera-shell{position:relative;width:100%;max-height:58dvh;min-height:220px;overflow:hidden;border:1px solid #70d6ff55;border-radius:18px;background:#000}
      .mp-qr-camera-shell video{display:block;width:100%;height:min(58dvh,470px);min-height:220px;object-fit:cover;background:#000}
      .mp-qr-scan-frame{position:absolute;inset:16% 13%;border:3px solid #70d6ff;border-radius:20px;box-shadow:0 0 0 999px #0005,inset 0 0 18px #70d6ff55;pointer-events:none}
      .mp-qr-scanner-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.mp-qr-scanner-actions button{min-width:125px}
      .alwaha-game-qr-scanner>.game-modal-card{gap:9px}.alwaha-game-qr-scanner #mp-qr-scan-status{margin:4px 0}
      .mp-create{background:#00e0a4;color:#001b15}.mp-join{background:#70d6ff;color:#07151c}.mp-muted{background:#ffffff12;color:#fff;border:1px solid #ffffff25}
      .mp-room-code{font-size:26px;letter-spacing:5px;font-weight:900;color:#ffd166;background:#0005;border:1px dashed #ffd16670;border-radius:12px;padding:9px;text-align:center;user-select:text}
      .mp-room-meta{font-size:11px;color:#d2d9e3;line-height:1.9;margin:8px 0}
      .mp-board-wrap{display:flex;justify-content:center;width:100%;overflow:auto;padding:4px 0 12px}.mp-chess-board{width:min(88vw,352px);aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);border:3px solid #b8c5d5;border-radius:5px;overflow:hidden;flex-shrink:0}
      .mp-chess-square{border:0;border-radius:0;font-size:clamp(22px,7vw,39px);display:flex;align-items:center;justify-content:center;line-height:1;cursor:pointer;position:relative;padding:0;color:#111}
      .mp-chess-light{background:#e8edf3}.mp-chess-dark{background:#5c7a8a}.mp-chess-square.mp-selected{box-shadow:inset 0 0 0 4px #ffd166}.mp-chess-square.mp-target:after{content:'';width:24%;height:24%;border-radius:50%;background:#14b88599;position:absolute}
      .mp-chess-piece-white{color:#fff;text-shadow:-1px -1px 1px #222,1px 1px 2px #222}.mp-chess-piece-black{color:#17202a;text-shadow:0 0 1px #fff}
      .mp-ludo-board{width:min(88vw,360px);height:min(88vw,360px);max-width:360px;max-height:360px;position:relative;margin:auto;border-radius:50%;background:radial-gradient(circle,#1c293c 0 23%,#172132 24% 52%,#0c1320 53%);border:2px solid #32465d;overflow:hidden}
      .mp-ludo-cell{position:absolute;width:5.1%;height:5.1%;border-radius:50%;background:#d7e3ef;border:1px solid #172438;transform:translate(-50%,-50%);padding:0;pointer-events:none}
      .mp-ludo-cell.safe{background:#ffd166}.mp-ludo-piece{position:absolute;transform:translate(-50%,-50%);width:8%;height:8%;min-width:17px;min-height:17px;border:2px solid #fff;border-radius:50%;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 5px #0009;padding:0}
      .mp-ludo-piece.p0{background:#ed4f60;color:#fff}.mp-ludo-piece.p1{background:#2788e8;color:#fff}.mp-ludo-piece:disabled{cursor:default;opacity:.85}.mp-ludo-yard{position:absolute;font-size:9px;color:#fff9;font-weight:800}.mp-ludo-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:24px;pointer-events:none}
      .mp-war-cards{display:flex;justify-content:center;gap:14px;margin:16px 0}.mp-playing-card{width:92px;height:130px;background:#f5f5ef;border-radius:12px;border:2px solid #d0d4da;color:#222;display:flex;flex-direction:column;justify-content:space-between;padding:8px;font-size:22px;font-weight:900;box-shadow:0 6px 14px #0005}.mp-playing-card .big{font-size:35px;text-align:center}.mp-playing-card.red{color:#c73546}.mp-playing-card.back{background:repeating-linear-gradient(45deg,#1e4e83,#1e4e83 7px,#e0e9f8 7px,#e0e9f8 9px);color:transparent}
      .mp-help{font-size:11px;line-height:1.8;color:#c6d0dc;text-align:center;margin:8px 0}.mp-status{background:#ffffff09;border:1px solid #ffffff16;border-radius:11px;padding:9px;font-size:11px;color:#e3eaf4;text-align:center;margin:8px 0}
      .mp-legacy{margin-top:18px;border-top:1px solid #ffffff18;padding-top:14px}.mp-legacy button{width:100%;text-align:right;background:#ffffff08;color:#fff;border:1px solid #ffffff14;border-radius:10px;padding:10px;font-family:inherit;margin:4px 0;font-size:11px}
      @media(max-width:380px){.mp-game-cards{grid-template-columns:1fr}.mp-playing-card{width:78px;height:112px}}
    `;
    document.head.appendChild(style);
  }

  function normalizeRoom(payload) {
    if (Array.isArray(payload)) return payload[0] || null;
    if (payload && typeof payload === 'object' && payload.room) return normalizeRoom(payload.room);
    return payload && typeof payload === 'object' ? payload : null;
  }
  async function requireUser() {
    if (typeof window.requireAuthenticatedUser === 'function') {
      const user = await window.requireAuthenticatedUser('سجّل الدخول أولاً لاستخدام الألعاب الجماعية.');
      if (user) return user;
      return null;
    }
    const user = typeof window.getCurrentAuthUser === 'function' ? await window.getCurrentAuthUser() : null;
    if (!user) toast('سجّل الدخول أولاً لاستخدام الألعاب الجماعية.', 'error');
    return user || null;
  }
  function initialState(gameId) {
    if (gameId === 'chess') return { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lastMove: '', result: '' };
    if (gameId === 'ludo') return { pawns: [[-1,-1,-1,-1],[-1,-1,-1,-1]], dice: null, lastDice: null, message: 'يرمي اللاعب صاحب الدور النرد أولاً.' };
    const deck = [];
    for (let rank = 2; rank <= 14; rank++) for (let suit = 0; suit < 4; suit++) deck.push(rank);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return { deck1: deck.slice(0, 26), deck2: deck.slice(26), lastCards: null, rounds: 0, message: 'ابدأ بسحب الورقتين للمقارنة.' };
  }
  function randomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    if (window.crypto?.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  }
  function roomEndpoint(id) { return `game_rooms?select=*&id=eq.${encodeURIComponent(id)}&limit=1`; }
  function beginRoomAction(button, busyLabel) {
    if (SESSION.roomActionBusy) {
      toast('جارٍ تنفيذ طلب لعبة آخر. انتظر اكتماله أولاً.', 'info');
      return null;
    }
    SESSION.roomActionBusy = true;
    const container = $('games-list-container');
    const controls = container ? [...container.querySelectorAll('[data-mp-create],[data-mp-join],.mp-join-code-form input,.mp-join-code-form button')] : [];
    const previous = controls.map(control => ({
      disabled: control.disabled,
      ariaBusy: control.getAttribute('aria-busy'),
      textContent: control.textContent
    }));
    controls.forEach(control => {
      control.disabled = true;
      control.setAttribute('aria-busy', 'true');
    });
    if (button) button.textContent = busyLabel;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      controls.forEach((control, index) => {
        control.disabled = previous[index].disabled;
        if (previous[index].ariaBusy === null) control.removeAttribute('aria-busy');
        else control.setAttribute('aria-busy', previous[index].ariaBusy);
        control.textContent = previous[index].textContent;
      });
      SESSION.roomActionBusy = false;
    };
  }
  async function createRoom(gameId, button = null) {
    if (!GAME_INFO[gameId]) return toast('نوع اللعبة غير معروف.', 'error');
    const releaseAction = beginRoomAction(button, 'جارٍ إنشاء الغرفة…');
    if (!releaseAction) return;
    try {
      const user = await requireUser(); if (!user) return;
      if (typeof window.alwahaInvokeEdgeFunction !== 'function') throw new Error('خدمة الألعاب الآمنة غير متاحة في هذه النسخة.');
      toast('جاري إنشاء الغرفة الآمنة...', 'info');
      const result = await window.alwahaInvokeEdgeFunction('game-actions',{action:'create_room',game_id:gameId});
      const created = normalizeRoom(result?.room);
      if (!created?.id || created.game_id !== gameId || created.player1_id !== user.id) {
        throw new Error('لم يؤكد الخادم إنشاء غرفة صحيحة لهذا الحساب واللعبة.');
      }
      SESSION.user = user; openRoom(created,user);
      toast('تم إنشاء الغرفة. أرسل الكود للاعب الآخر.', 'success');
    } catch(error) {
      toast(error?.message || 'تعذر إنشاء الغرفة.', 'error');
    } finally {
      releaseAction();
    }
  }
  function parseGameQrPayload(value) {
    const match = String(value || '').trim().match(/^ALWAHA-GAME\|1\|(chess|ludo|war)\|([A-HJ-NP-Z2-9]{6})$/);
    return match ? { gameId: match[1], code: match[2] } : null;
  }
  function showJoinCodeForm(gameId, button) {
    if (!GAME_INFO[gameId] || !button) return;
    const card = button.closest('.mp-game-card');
    if (!card) return;
    let form = card.querySelector('.mp-join-code-form');
    if (form) {
      form.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      form.querySelector('input')?.focus();
      return;
    }
    form = document.createElement('form');
    form.className = 'mp-join-code-form';
    form.dataset.mpJoinForm = gameId;
    const inputId = 'mp-join-code-' + gameId;
    const helpId = 'mp-join-code-help-' + gameId;
    form.innerHTML =
      '<label for="' + inputId + '">كود غرفة ' + esc(GAME_INFO[gameId].title) + '</label>' +
      '<input id="' + inputId + '" name="roomCode" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="6" minlength="6" pattern="[A-HJ-NP-Z2-9]{6}" placeholder="ABC123" aria-describedby="' + helpId + '" required>' +
      '<p class="mp-join-code-help" id="' + helpId + '">اكتب الكود المكوّن من 6 أحرف أو أرقام، أو امسح QR بكاميرا الجهاز.</p>' +
      '<div class="mp-join-code-actions">' +
      '<button type="submit" class="mp-action mp-create" aria-label="تأكيد الانضمام إلى غرفة ' + esc(GAME_INFO[gameId].title) + '">انضمام</button>' +
      '<button type="button" class="mp-action mp-muted" data-mp-scan="' + gameId + '" aria-label="مسح QR للانضمام إلى ' + esc(GAME_INFO[gameId].title) + '">مسح QR بالكاميرا</button>' +
      '<button type="button" class="mp-action mp-muted" data-mp-cancel-join>إلغاء</button></div>';
    card.appendChild(form);
    button.setAttribute('aria-expanded', 'true');
    form.querySelector('input')?.focus();
  }
  function stopQrScanner() {
    const scan = SESSION.qrScanner;
    if (!scan) return;
    scan.closed = true;
    SESSION.qrScanner = null;
    if (scan.frame) cancelAnimationFrame(scan.frame);
    if (scan.stream) scan.stream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
    if (scan.video) {
      try { scan.video.pause(); } catch (_) {}
      scan.video.srcObject = null;
    }
    if (scan.onKeyDown) document.removeEventListener('keydown', scan.onKeyDown, true);
    if (scan.onVisibility) document.removeEventListener('visibilitychange', scan.onVisibility);
    if (scan.overlay) scan.overlay.remove();
    document.body.classList.remove('modal-active');
    window.AlwahaModalShell?.sync?.();
    scan.previousFocus?.focus?.();
  }
  function setQrScannerStatus(scan, message) {
    if (SESSION.qrScanner !== scan || scan.closed) return;
    const status = scan.overlay.querySelector('#mp-qr-scan-status');
    if (status) status.textContent = message;
  }
  function scanQrFrame(scan) {
    if (SESSION.qrScanner !== scan || scan.closed) return;
    scan.frame = requestAnimationFrame(() => scanQrFrame(scan));
    const video = scan.video;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    const now = Date.now();
    if (now - scan.lastFrameAt < 140) return;
    scan.lastFrameAt = now;
    const scale = Math.min(1, 720 / video.videoWidth);
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    scan.canvas.width = width;
    scan.canvas.height = height;
    const context = scan.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    try {
      context.drawImage(video, 0, 0, width, height);
      const frame = context.getImageData(0, 0, width, height);
      const result = window.jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
      if (!result?.data) return;
      const decoded = parseGameQrPayload(result.data);
      if (!decoded) {
        if (now - scan.lastInvalidAt > 1400) {
          scan.lastInvalidAt = now;
          setQrScannerStatus(scan, 'هذا الرمز ليس دعوة غرفة صالحة من Alwaha-Pro. وجّه الكاميرا إلى QR الخاص بالغرفة.');
        }
        return;
      }
      scan.detected = true;
      const title = GAME_INFO[decoded.gameId]?.title || 'اللعبة';
      stopQrScanner();
      toast('تم التعرف على دعوة ' + title + '، جارٍ التحقق من الغرفة...', 'success');
      void joinRoom(decoded.gameId, null, decoded.code);
    } catch (error) {
      if (now - scan.lastErrorAt > 2000) {
        scan.lastErrorAt = now;
        setQrScannerStatus(scan, 'تعذرت قراءة الصورة الآن. ثبّت الكاميرا وحاول مرة أخرى.');
      }
    }
  }
  async function connectQrCamera(scan) {
    setQrScannerStatus(scan, 'بانتظار إذن الكاميرا...');
    const retry = scan.overlay.querySelector('#mp-qr-retry');
    if (retry) retry.hidden = true;
    try {
      if (!window.isSecureContext && location.hostname !== 'localhost') {
        throw new Error('SECURE_CONTEXT_REQUIRED');
      }
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('CAMERA_UNAVAILABLE');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (scan.closed || SESSION.qrScanner !== scan) {
        stream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
        return;
      }
      scan.stream = stream;
      scan.video.srcObject = stream;
      await scan.video.play();
      if (SESSION.qrScanner !== scan || scan.closed) return;
      setQrScannerStatus(scan, 'وجّه كاميرا الجهاز إلى QR الخاص بالغرفة. سيتم الانضمام بعد التحقق من الرمز والخادم.');
      scan.frame = requestAnimationFrame(() => scanQrFrame(scan));
    } catch (error) {
      if (SESSION.qrScanner !== scan || scan.closed) return;
      let message = 'تعذر فتح الكاميرا. راجع إذن الكاميرا ثم حاول مرة أخرى.';
      if (error?.message === 'SECURE_CONTEXT_REQUIRED') message = 'مسح QR يحتاج اتصالًا آمنًا HTTPS أو تشغيل التطبيق الأصلي.';
      else if (error?.message === 'CAMERA_UNAVAILABLE') message = 'ميزة الكاميرا غير متاحة في هذا المتصفح. يمكنك إغلاق هذه الصفحة وإدخال كود الغرفة يدويًا.';
      else if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') message = 'لم يُسمح باستخدام الكاميرا. فعّل إذن الكاميرا للتطبيق ثم أعد المحاولة.';
      else if (error?.name === 'NotFoundError') message = 'لم يتم العثور على كاميرا متاحة على هذا الجهاز.';
      setQrScannerStatus(scan, message);
      if (retry) retry.hidden = false;
    }
  }
  async function startQrScan() {
    const user = await requireUser();
    if (!user) return;
    if (SESSION.qrScanner) return;
    if (typeof window.jsQR !== 'function') {
      toast('قارئ QR المحلي غير جاهز. أغلق التطبيق وافتحه بعد اكتمال تحديثه.', 'error');
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'alwaha-game-qr-scanner';
    overlay.className = 'game-modal-overlay alwaha-fullscreen-layer alwaha-game-page alwaha-game-qr-scanner';
    overlay.innerHTML =
      '<div class="game-modal-card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<h2 id="mp-qr-scanner-title" style="margin:0;font:900 17px Cairo,sans-serif;color:#eaf7ff">مسح QR للانضمام إلى لعبة</h2>' +
      '<button type="button" id="mp-qr-close" class="mp-action mp-muted" aria-label="إغلاق ماسح QR">إغلاق ×</button></div>' +
      '<div class="mp-status" id="mp-qr-scan-status" role="status" aria-live="polite">جارٍ تجهيز الكاميرا...</div>' +
      '<div class="mp-qr-camera-shell"><video id="mp-qr-video" autoplay muted playsinline></video><div class="mp-qr-scan-frame" aria-hidden="true"></div></div>' +
      '<div class="mp-qr-scanner-actions"><button type="button" id="mp-qr-retry" class="mp-action mp-create" hidden>إعادة تشغيل الكاميرا</button>' +
      '<button type="button" id="mp-qr-cancel" class="mp-action mp-muted">إلغاء المسح</button></div>' +
      '<p class="mp-help">استخدم كاميرا الجهاز الخلفية. لا يتم حفظ صورة الكاميرا أو إرسالها؛ تتم قراءة QR محليًا على الهاتف فقط.</p>' +
      '</div>';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mp-qr-scanner-title');
    overlay.setAttribute('tabindex', '-1');
    const scan = {
      overlay,
      video: overlay.querySelector('#mp-qr-video'),
      canvas: document.createElement('canvas'),
      stream: null,
      frame: 0,
      lastFrameAt: 0,
      lastInvalidAt: 0,
      lastErrorAt: 0,
      closed: false,
      detected: false,
      previousFocus: document.activeElement,
      onKeyDown: null,
      onVisibility: null
    };
    SESSION.qrScanner = scan;
    document.body.appendChild(overlay);
    overlay.classList.add('is-open');
    document.body.classList.add('modal-active');
    window.AlwahaModalShell?.sync?.();
    overlay.querySelector('#mp-qr-close').onclick = stopQrScanner;
    overlay.querySelector('#mp-qr-cancel').onclick = stopQrScanner;
    overlay.querySelector('#mp-qr-retry').onclick = () => void connectQrCamera(scan);
    scan.onKeyDown = event => { if (event.key === 'Escape') { event.preventDefault(); stopQrScanner(); } };
    scan.onVisibility = () => { if (document.hidden) stopQrScanner(); };
    document.addEventListener('keydown', scan.onKeyDown, true);
    document.addEventListener('visibilitychange', scan.onVisibility);
    overlay.focus();
    await connectQrCamera(scan);
  }
  async function joinRoom(gameId, button = null, suppliedCode = '') {
    if (!GAME_INFO[gameId]) return toast('نوع اللعبة غير معروف.', 'error');
    const code = String(suppliedCode || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      toast('كود الغرفة غير صحيح. أدخل 6 أحرف أو أرقام أو امسح رمز QR.', 'error');
      return;
    }
    const releaseAction = beginRoomAction(button, 'جارٍ الانضمام…');
    if (!releaseAction) return;
    try {
      const user = await requireUser(); if (!user) return;
      if (typeof window.supabaseFetch !== 'function') throw new Error('خدمة الانضمام إلى الغرف غير متاحة في هذه النسخة.');
      const response = await window.supabaseFetch('rpc/join_game_room', {
        method: 'POST',
        body: JSON.stringify({ p_room_code: code, p_expected_game_id: gameId }),
        prefer: 'return=representation'
      });
      const joined = normalizeRoom(response);
      if (!joined?.id || joined.game_id !== gameId || ![joined.player1_id, joined.player2_id].includes(user.id)) {
        throw new Error('تعذر الانضمام. تحقق من الكود، ونوع اللعبة، وأن الغرفة تنتظر لاعباً.');
      }
      button?.closest('.mp-join-code-form')?.remove();
      SESSION.user = user;
      openRoom(joined, user);
      toast('تم الانضمام إلى الغرفة.', 'success');
    } catch(error) {
      toast(error?.message || 'تعذر الانضمام إلى الغرفة.', 'error');
    } finally {
      releaseAction();
    }
  }
  function stopPolling() {
    if (SESSION.timer) clearInterval(SESSION.timer);
    SESSION.pollGeneration += 1;
    SESSION.timer = null; SESSION.loading = false; SESSION.syncFailed = false; SESSION.room = null; SESSION.lastRenderKey = ''; SESSION.selectedSquare = null; SESSION.legalTargets = []; SESSION.game = null; SESSION.busy = false;
  }
  function closeRoom() {
    stopPolling();
    const modal = $('alwaha-multiplayer-room'); if (modal) modal.remove();
    document.body.classList.remove('modal-active');
    window.AlwahaModalShell?.sync?.();
  }
  function openRoom(room, user) {
    stopPolling(); SESSION.room = room; SESSION.user = user;
    addStyles();
    let modal = $('alwaha-multiplayer-room');
    if (modal) modal.remove();
    modal = document.createElement('div'); modal.id = 'alwaha-multiplayer-room'; modal.className = 'game-modal-overlay alwaha-fullscreen-layer alwaha-game-page';
    modal.innerHTML = `<div class="game-modal-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 id="mp-room-title" style="color:#70d6ff;font-size:16px;margin:0">${esc(GAME_INFO[room.game_id]?.title || 'لعبة جماعية')}</h3><button type="button" class="mp-action mp-muted" id="mp-room-close" aria-label="إغلاق غرفة اللعبة">إغلاق ×</button></div><div id="mp-room-meta" class="mp-room-meta"></div><div id="mp-sync-status" class="mp-status" hidden></div><div id="mp-room-stage"><div class="mp-status">جاري تحميل الغرفة…</div></div><div class="mp-help">تتم مزامنة الغرفة عبر الإنترنت كل ثانيتين. يجب بقاء التطبيق مفتوحاً والاتصال بالإنترنت لدى اللاعبين.</div></div>`;
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'mp-room-title'); modal.setAttribute('tabindex', '-1');
    document.body.appendChild(modal); modal.classList.add('is-open'); document.body.classList.add('modal-active');
    window.AlwahaModalShell?.sync?.();
    $('mp-room-close').onclick = closeRoom;
    modal.addEventListener('click', ev => { if (ev.target === modal) closeRoom(); });
    renderRoom(room);
    SESSION.timer = setInterval(pollRoom, 1900);
  }
  async function pollRoom() {
    const activeRoomId = SESSION.room?.id ? String(SESSION.room.id) : '';
    if (!activeRoomId || SESSION.loading) return;
    if (typeof window.supabaseFetch !== 'function') {
      if (!SESSION.syncFailed) toast('خدمة مزامنة الألعاب غير متاحة؛ تحقق من الاتصال.', 'error');
      SESSION.syncFailed = true;
      const syncStatus = $('mp-sync-status');
      if (syncStatus) { syncStatus.textContent = 'تعذر الاتصال بخدمة المزامنة. أعد الاتصال بالإنترنت للمواصلة.'; syncStatus.hidden = false; }
      return;
    }
    const generation = SESSION.pollGeneration;
    SESSION.loading = true;
    try {
      const rows = await window.supabaseFetch(roomEndpoint(activeRoomId), { method: 'GET', prefer: 'return=representation' });
      if (generation !== SESSION.pollGeneration || String(SESSION.room?.id || '') !== activeRoomId) return;
      const fresh = Array.isArray(rows) ? rows[0] : null;
      if (!fresh || String(fresh.id) !== activeRoomId) throw new Error('لم تصل حالة الغرفة الحالية من الخادم.');
      const key = `${fresh.move_no}|${fresh.status}|${fresh.player2_id || ''}|${fresh.current_turn || ''}|${fresh.updated_at || ''}`;
      SESSION.room = fresh;
      if (SESSION.syncFailed) {
        SESSION.syncFailed = false;
        const syncStatus = $('mp-sync-status');
        if (syncStatus) syncStatus.hidden = true;
        toast('عادت مزامنة اللعبة.', 'success');
      }
      if (key !== SESSION.lastRenderKey) renderRoom(fresh);
    } catch(error) {
      if (generation === SESSION.pollGeneration && String(SESSION.room?.id || '') === activeRoomId) {
        if (!SESSION.syncFailed) toast('تعذر تحديث حالة اللعبة. تحقق من الاتصال؛ سنعيد المحاولة تلقائياً.', 'error');
        SESSION.syncFailed = true;
        const syncStatus = $('mp-sync-status');
        if (syncStatus) { syncStatus.textContent = 'المزامنة متوقفة مؤقتاً بسبب الاتصال. أعد الاتصال للمتابعة؛ ستتم إعادة المحاولة تلقائياً.'; syncStatus.hidden = false; }
      }
    } finally {
      if (generation === SESSION.pollGeneration && String(SESSION.room?.id || '') === activeRoomId) SESSION.loading = false;
    }
  }
  function mySeat(room = SESSION.room) { return room && room.player1_id === SESSION.user?.id ? 0 : 1; }
  function opponentId(room = SESSION.room) { return mySeat(room) === 0 ? room?.player2_id : room?.player1_id; }
  function isMyTurn(room = SESSION.room) { return !!room && room.status === 'playing' && room.current_turn === SESSION.user?.id; }
  function setRoomMeta(room) {
    const box = $('mp-room-meta'); if (!box) return;
    const seat = mySeat(room);
    const status = room.status === 'waiting' ? 'بانتظار اللاعب الثاني' : room.status === 'finished' ? 'انتهت المباراة' : (isMyTurn(room) ? 'دورك الآن' : 'دور الخصم');
    box.innerHTML = '<div>كود الغرفة</div><input id="mp-room-code-value" class="mp-room-code" type="text" readonly spellcheck="false" aria-label="كود غرفة اللعبة" value="' + esc(room.room_code) + '"><div style="text-align:center"><button type="button" id="mp-copy-code" class="mp-action mp-muted" aria-label="نسخ كود غرفة اللعبة">نسخ الكود</button><button type="button" id="mp-show-qr" class="mp-action mp-create" aria-label="عرض رمز QR لدعوة لاعب">عرض QR</button></div><div id="mp-room-qr-panel" class="mp-room-qr-panel" hidden><img id="mp-room-qr-image" alt="رمز QR للانضمام إلى غرفة اللعبة"><p>امسح هذا الرمز من جهاز اللاعب الآخر للانضمام مباشرة إلى هذه الغرفة.</p></div><div class="mp-status">' + esc(status) + '</div><div>أنت: اللاعب ' + (seat === 0 ? 'الأول' : 'الثاني') + ' · الخصم: ' + (room.player2_id ? 'انضم' : 'لم ينضم بعد') + '</div><div>رقم الحركة: ' + (Number(room.move_no) || 0) + '</div>';
    const copy = $('mp-copy-code');
    if (copy) copy.onclick = async () => {
      const input = $('mp-room-code-value');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(room.room_code);
          toast('تم نسخ كود الغرفة.', 'success');
          return;
        }
      } catch (_) {}
      if (input) {
        input.focus(); input.select();
        let copied = false;
        try { copied = !!document.execCommand?.('copy'); } catch (_) {}
        toast(copied ? 'تم نسخ كود الغرفة.' : 'تم تحديد الكود؛ انسخه باستخدام أمر النسخ في جهازك.', copied ? 'success' : 'info');
      }
    };
    const showQr = $('mp-show-qr');
    if (showQr) showQr.onclick = () => {
      const panel = $('mp-room-qr-panel');
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      showQr.textContent = open ? 'إخفاء QR' : 'عرض QR';
      showQr.setAttribute('aria-expanded', String(open));
      if (!open || panel.dataset.ready === 'true') return;
      try {
        if (typeof window.qrcode !== 'function') throw new Error('QR encoder is unavailable.');
        const code = window.qrcode(0, 'M');
        code.addData('ALWAHA-GAME|1|' + room.game_id + '|' + room.room_code);
        code.make();
        $('mp-room-qr-image').src = code.createDataURL(6, 8);
        panel.dataset.ready = 'true';
      } catch (error) {
        panel.innerHTML = '<p>تعذر تجهيز رمز QR. يمكنك مشاركة كود الغرفة المكتوب أعلاه.</p>';
        toast('تعذر إنشاء QR على هذا الجهاز؛ استخدم كود الغرفة.', 'error');
      }
    };
  }
  function renderRoom(room) {
    if (!$('mp-room-stage')) return;
    SESSION.lastRenderKey = `${room.move_no}|${room.status}|${room.player2_id || ''}|${room.current_turn || ''}|${room.updated_at || ''}`;
    setRoomMeta(room);
    if (room.status === 'waiting') {
      $('mp-room-stage').innerHTML = `<div class="mp-status">تم إنشاء الغرفة بنجاح. شارك الكود مع شخص آخر؛ ستبدأ اللعبة تلقائياً عند انضمامه.</div>`;
      return;
    }
    if (room.status === 'finished') {
      const winner = room.winner_id ? (room.winner_id === room.player1_id ? 'اللاعب الأول' : 'اللاعب الثاني') : 'تعادل';
      $('mp-room-stage').innerHTML = `<div class="mp-status" style="font-size:16px;color:#00e0a4">${winner === 'تعادل' ? 'انتهت المباراة بالتعادل.' : `الفائز: ${winner} 🎉`}</div><div class="mp-help">${esc(room.state?.result || room.state?.message || '')}</div>`;
      return;
    }
    if (!room.player2_id) { $('mp-room-stage').innerHTML = '<div class="mp-status">بانتظار اللاعب الثاني…</div>'; return; }
    if (room.game_id === 'chess') renderChess(room);
    else if (room.game_id === 'ludo') renderLudo(room);
    else if (room.game_id === 'war') renderWar(room);
    else $('mp-room-stage').innerHTML = '<div class="mp-status">نوع اللعبة غير معروف.</div>';
  }
  async function submitGameAction(move) {
    const room = SESSION.room;
    const roomId = room?.id ? String(room.id) : '';
    const generation = SESSION.pollGeneration;
    if (!roomId || SESSION.busy || !isMyTurn(room)) return toast('انتظر دورك أو اكتمال المزامنة.', 'info');
    if (typeof window.alwahaInvokeEdgeFunction !== 'function') return toast('خدمة الألعاب الآمنة غير متاحة.', 'error');
    SESSION.busy = true;
    try {
      const result = await window.alwahaInvokeEdgeFunction('game-actions',{action:'move',room_id:roomId,expected_move_no:room.move_no,move});
      if (generation !== SESSION.pollGeneration || String(SESSION.room?.id || '') !== roomId) return;
      const updated = normalizeRoom(result?.room);
      if (!updated?.id || String(updated.id) !== roomId) throw new Error('لم يؤكد الخادم حفظ الحركة في الغرفة الحالية.');
      SESSION.room = updated; SESSION.selectedSquare = null; SESSION.legalTargets = []; SESSION.game = null;
    } catch(error) {
      if (generation === SESSION.pollGeneration && String(SESSION.room?.id || '') === roomId) {
        toast(error?.message || 'لم يتم حفظ الحركة؛ ستتم مزامنة الغرفة.', 'error');
        await pollRoom();
      }
    } finally {
      if (generation === SESSION.pollGeneration && String(SESSION.room?.id || '') === roomId) {
        SESSION.busy = false;
        if (SESSION.room) renderRoom(SESSION.room);
      }
    }
  }
  function otherTurn(room = SESSION.room) { return room.current_turn === room.player1_id ? room.player2_id : room.player1_id; }

  // Chess uses the pinned chess.js 0.13.4 browser build, including legal-move and draw/checkmate validation.
  function createChess(state) {
    if (typeof window.Chess !== 'function') return null;
    try { return new window.Chess(state?.fen || undefined); } catch (_) { return null; }
  }
  function gameOver(game) { return !!(game && ((typeof game.isGameOver === 'function' && game.isGameOver()) || (typeof game.game_over === 'function' && game.game_over()))); }
  function checkmate(game) { return !!(game && ((typeof game.isCheckmate === 'function' && game.isCheckmate()) || (typeof game.in_checkmate === 'function' && game.in_checkmate()))); }
  function chessDraw(game) { return !!(game && ((typeof game.isDraw === 'function' && game.isDraw()) || (typeof game.in_draw === 'function' && game.in_draw()))); }
  function renderChess(room) {
    const game = createChess(room.state); SESSION.game = game;
    if (!game) { $('mp-room-stage').innerHTML = '<div class="mp-status">تعذّر تحميل مكتبة قواعد الشطرنج. أغلق التطبيق وافتحه مع اتصال بالإنترنت.</div>'; return; }
    const seat = mySeat(room), localColor = seat === 0 ? 'w' : 'b';
    const files = 'abcdefgh'; let board = '';
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      let rank = 8 - row, file = files[col];
      if (seat === 1) { rank = row + 1; file = files[7 - col]; }
      const square = `${file}${rank}`; const piece = game.get(square);
      const selected = SESSION.selectedSquare === square;
      const target = SESSION.legalTargets.includes(square);
      const glyphs = { wp:'♙', wn:'♘', wb:'♗', wr:'♖', wq:'♕', wk:'♔', bp:'♟', bn:'♞', bb:'♝', br:'♜', bq:'♛', bk:'♚' };
      const glyph = piece ? glyphs[piece.color + piece.type] : '';
      board += `<button type="button" class="mp-chess-square ${(rank + files.indexOf(file)) % 2 ? 'mp-chess-dark' : 'mp-chess-light'}${selected ? ' mp-selected' : ''}${target ? ' mp-target' : ''}" data-chess-square="${square}" aria-label="${square}" ${!isMyTurn(room) || room.status !== 'playing' ? 'disabled' : ''}><span class="${piece?.color === 'w' ? 'mp-chess-piece-white' : 'mp-chess-piece-black'}">${glyph}</span></button>`;
    }
    const whose = isMyTurn(room) ? 'دورك — اختر قطعة ثم مربع الوجهة.' : `انتظر دور ${room.current_turn === room.player1_id ? 'الأبيض' : 'الأسود'}.`;
    const fenTurn = game.turn() === 'w' ? 'الأبيض' : 'الأسود';
    const checks = gameOver(game) ? 'انتهت المباراة.' : (typeof game.isCheck === 'function' ? (game.isCheck() ? 'كش!' : '') : (typeof game.in_check === 'function' && game.in_check() ? 'كش!' : ''));
    $('mp-room-stage').innerHTML = `<div class="mp-status">${esc(whose)} · الدور في الرقعة: ${fenTurn} ${checks}</div><div class="mp-board-wrap"><div class="mp-chess-board">${board}</div></div><div class="mp-help">أنت تلعب بالقطع ${localColor === 'w' ? 'البيضاء' : 'السوداء'}. الترقية التلقائية للبيدق إلى وزير.</div>${room.state?.lastMove ? `<div class="mp-status">آخر نقلة: ${esc(room.state.lastMove)}</div>` : ''}`;
    $('mp-room-stage').onclick = async (event) => {
      const button = event.target.closest('[data-chess-square]'); if (!button) return;
      const square = button.dataset.chessSquare;
      if (!isMyTurn(SESSION.room)) return toast('ليس دورك الآن.', 'info');
      const current = createChess(SESSION.room.state); if (!current) return;
      if (SESSION.selectedSquare) {
        try {
          const moved = current.move({ from: SESSION.selectedSquare, to: square, promotion: 'q' });
          if (moved) {
            await submitGameAction({type:'chess_move',from:SESSION.selectedSquare,to:square}); return;
          }
        } catch (_) { /* keep selection so the player can pick a legal destination */ }
      }
      const piece = current.get(square);
      if (piece && piece.color === localColor) {
        SESSION.selectedSquare = square;
        SESSION.legalTargets = current.moves({ square, verbose: true }).map(move => move.to);
        renderChess(SESSION.room);
      } else {
        SESSION.selectedSquare = null; SESSION.legalTargets = []; renderChess(SESSION.room);
      }
    };
  }

  // Two-player Ludo variant: 4 tokens each, roll six to enter, capture on non-safe squares, exact finish required.
  function ludoLegalPawns(room, die) {
    const pawns = room.state?.pawns?.[mySeat(room)] || [];
    return pawns.map((pos, index) => ({ pos, index })).filter(x => (x.pos === -1 && die === 6) || (x.pos >= 0 && x.pos + die <= 57)).map(x => x.index);
  }
  function ludoPoint(globalIndex) {
    const angle = (-90 + globalIndex * (360 / 52)) * Math.PI / 180;
    return { x: 50 + Math.cos(angle) * 39, y: 50 + Math.sin(angle) * 39 };
  }
  function ludoPawnPoint(position, seat, pawnIndex) {
    if (position === -1) {
      const coords = seat === 0 ? [[30,34],[38,34],[30,42],[38,42]] : [[62,58],[70,58],[62,66],[70,66]];
      return { x: coords[pawnIndex][0], y: coords[pawnIndex][1] };
    }
    if (position >= 57) return { x: 50, y: 50 };
    if (position >= 52) return { x: 50, y: 50 + (seat === 0 ? -1 : 1) * (57 - position) * 4.4 };
    return ludoPoint(((seat === 0 ? 0 : 26) + position) % 52);
  }
  function renderLudo(room) {
    const state = room.state || initialState('ludo');
    const legal = state.dice ? ludoLegalPawns(room, state.dice) : [];
    let cells = '';
    const safe = new Set([0,8,13,21,26,34,39,47]);
    for (let i = 0; i < 52; i++) { const p = ludoPoint(i); cells += `<span class="mp-ludo-cell ${safe.has(i) ? 'safe' : ''}" style="left:${p.x}%;top:${p.y}%"></span>`; }
    let pieces = '';
    (state.pawns || [[],[]]).forEach((array, seat) => array.forEach((pos, index) => {
      const p = ludoPawnPoint(Number(pos), seat, index); const clickable = seat === mySeat(room) && isMyTurn(room) && legal.includes(index) && !SESSION.busy;
      pieces += '<button type="button" class="mp-ludo-piece p' + seat + '" style="left:' + p.x + '%;top:' + p.y + '%" data-ludo-pawn="' + index + '" data-ludo-seat="' + seat + '" aria-label="تحريك القطعة ' + (index + 1) + ' في ليدو" ' + (clickable ? '' : 'disabled') + ' title="القطعة ' + (index + 1) + '">' + (index + 1) + '</button>';
    }));
    const diceHtml = state.dice ? `النرد: 🎲 ${state.dice} — اختر قطعة مضيئة.` : 'اضغط رمي النرد عند حلول دورك.';
    const btn = isMyTurn(room) && state.dice === null ? '<button type="button" class="mp-action mp-create" id="mp-ludo-roll" aria-label="رمي النرد في ليدو">🎲 رمي النرد</button>' : '';
    const pass = isMyTurn(room) && state.dice !== null && legal.length === 0 ? '<button type="button" class="mp-action mp-join" id="mp-ludo-pass" aria-label="إنهاء دورك في ليدو لعدم وجود حركة">لا توجد حركة — إنهاء الدور</button>' : '';
    $('mp-room-stage').innerHTML = `<div class="mp-status">${esc(isMyTurn(room) ? 'دورك.' : 'انتظر دور الخصم.')} ${esc(diceHtml)}</div><div class="mp-ludo-board">${cells}<span class="mp-ludo-center">🏁</span><span class="mp-ludo-yard" style="left:25%;top:24%">الأحمر</span><span class="mp-ludo-yard" style="left:62%;top:69%">الأزرق</span>${pieces}</div><div style="text-align:center;margin:10px">${btn}${pass}</div><div class="mp-help">تحتاج إلى 6 لإخراج القطعة. الحركة النهائية تتطلب رقماً دقيقاً. الأكل يعيد قطعة الخصم إلى قاعدتها.</div>`;
    const roll = $('mp-ludo-roll');
    if (roll) roll.onclick = async () => {
      if (!isMyTurn(room) || SESSION.busy || SESSION.room.state.dice !== null) return;
      await submitGameAction({type:'ludo_roll'});
    };
    const passBtn = $('mp-ludo-pass');
    if (passBtn) passBtn.onclick = async () => { await submitGameAction({type:'ludo_pass'}); };
    $('mp-room-stage').onclick = async (event) => {
      const btn = event.target.closest('[data-ludo-pawn]'); if (!btn || SESSION.busy) return;
      const seat = Number(btn.dataset.ludoSeat), index = Number(btn.dataset.ludoPawn);
      const currentRoom = SESSION.room, currentState = currentRoom?.state;
      if (!currentRoom || seat !== mySeat(currentRoom) || !isMyTurn(currentRoom) || currentState?.dice == null) return;
      const legalNow = ludoLegalPawns(currentRoom, currentState.dice); if (!legalNow.includes(index)) return;
      await submitGameAction({type:'ludo_move',pawn_index:index});
    };
  }

  // Card game: a 52-card War deck. A tie burns up to three cards, then compares again.
  function rankLabel(value) { return ({11:'J',12:'Q',13:'K',14:'A'})[Number(value)] || String(value); }
  function shuffledDeck() { const d=[]; for(let r=2;r<=14;r++) for(let s=0;s<4;s++) d.push(r); for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];} return d; }
  function renderWar(room) {
    const s = room.state || initialState('war'); const seat = mySeat(room);
    const cards = s.lastCards || [null,null];
    const card = (value, name) => value == null ? `<div class="mp-playing-card back"><span>?</span><span class="big">🂠</span><span>?</span></div>` : `<div class="mp-playing-card ${Number(value) < 11 ? 'red' : ''}"><span>${esc(rankLabel(value))}</span><span class="big">${esc(rankLabel(value))}</span><span style="text-align:right">${esc(name)}</span></div>`;
    const myDeck = seat === 0 ? s.deck1 : s.deck2, oppDeck = seat === 0 ? s.deck2 : s.deck1;
    $('mp-room-stage').innerHTML = `<div class="mp-status">${esc(isMyTurn(room) ? 'دورك: اسحب الورقتين.' : 'انتظر خصمك حتى يسحب الورقتين.')} · الجولة ${Number(s.rounds)||0}</div><div class="mp-war-cards"><div style="text-align:center"><div class="mp-help">أنت · ${myDeck.length} ورقة</div>${card(cards[seat], 'ورقتك')}</div><div style="text-align:center"><div class="mp-help">الخصم · ${oppDeck.length} ورقة</div>${card(cards[1-seat], 'ورقة الخصم')}</div></div><div class="mp-status">${esc(s.message || 'أعلى قيمة تفوز بالجولة. A أعلى ورقة.')}</div><div style="text-align:center">${isMyTurn(room) ? '<button type="button" class="mp-action mp-create" id="mp-war-draw" aria-label="سحب ورقتي الحرب">🂠 اسحب الورقتين</button>' : ''}</div><div class="mp-help">قيم الأوراق: 2 إلى 10 ثم J وQ وK وA. عند التعادل تحدث حرب تلقائية بثلاث أوراق مخفية ثم ورقة مقارنة.</div>`;
    const draw = $('mp-war-draw');
    if (draw) draw.onclick = async () => {
      if (!isMyTurn(room) || SESSION.busy) return;
      await submitGameAction({type:'war_draw'});
    };
  }

  function renderGamesSection() {
    addStyles();
    const container = $('games-list-container');
    if (!container) return;
    const cards = Object.entries(GAME_INFO).map(([id, game]) => '<article class="mp-game-card" style="border-color:' + game.color + '55"><div class="mp-game-icon" aria-hidden="true">' + game.icon + '</div><div class="mp-game-title">' + esc(game.title) + '</div><div class="mp-game-desc" id="mp-desc-' + id + '">' + esc(game.description) + '</div><button type="button" class="mp-action mp-create" data-mp-create="' + id + '" aria-label="إنشاء غرفة ' + esc(game.title) + '" aria-describedby="mp-desc-' + id + '">إنشاء غرفة</button><button type="button" class="mp-action mp-join" data-mp-join="' + id + '" aria-label="الانضمام إلى غرفة ' + esc(game.title) + ' بكود" aria-expanded="false" aria-describedby="mp-desc-' + id + '">الانضمام بكود</button></article>').join('');
    container.innerHTML = `<div class="mp-help" style="font-size:12px">الألعاب الجماعية أونلاين — أنشئ غرفة وشارك كودها مع صديق على جهاز آخر. يجب أن يكون اللاعبان مسجلين الدخول.</div><div class="mp-game-cards">${cards}</div><div class="mp-status">لا توجد غرف عامة معروضة؛ الانضمام يتم بكود الغرفة لمنع كشف الغرف الخاصة.</div>`;
    container.onclick = (event) => {
      const create = event.target.closest('[data-mp-create]');
      if (create) { void createRoom(create.dataset.mpCreate, create); return; }
      const scan = event.target.closest('[data-mp-scan]');
      if (scan) { void startQrScan(); return; }
      const cancelJoin = event.target.closest('[data-mp-cancel-join]');
      if (cancelJoin) { cancelJoin.closest('.mp-join-code-form')?.remove(); return; }
      const join = event.target.closest('[data-mp-join]');
      if (join) { showJoinCodeForm(join.dataset.mpJoin, join); return; }
    };
    container.onsubmit = (event) => {
      const form = event.target.closest('[data-mp-join-form]');
      if (!form) return;
      event.preventDefault();
      const input = form.querySelector('input[name="roomCode"]');
      void joinRoom(form.dataset.mpJoinForm, form.querySelector('button[type="submit"]'), input?.value || '');
    };
  }
  window.renderGamesSection = renderGamesSection;
  // Only multiplayer games are exposed in this release candidate.
  window.launchGameEngine = function(gameTitle) {
    const id = Object.keys(GAME_INFO).find(key => GAME_INFO[key].title === gameTitle);
    if (id) return createRoom(id);
    return toast('اختر لعبة جماعية من قسم الألعاب.', 'info');
  };
  window.closeAlwahaGameRoom = closeRoom;
  document.addEventListener('DOMContentLoaded', () => {
    const section = $('games-section');
    if (section && section.classList.contains('active-section')) renderGamesSection();
  });
})();
