// /drive-assets/earn-toast.js
// Shared helper used by Drive quizzes & exams.
// - Posts progress to /api/drive/progress for logged-in AND anonymous players.
// - Surfaces MP earned (logged-in, response.earnedCents > 0) or a friendly
//   "log in to earn" banner (anonymous, server returns 404).
//
// Usage from a quiz/exam:
//   window.driveEarnToast.postProgressAndShow();
//
// The helper reads all the same localStorage keys the old DL_SYNC_BLOCK did,
// so callers don't need to pass anything.
(function () {
  if (window.driveEarnToast) return;

  var STYLE_ID = 'drive-earn-toast-style';
  var CONTAINER_ID = 'drive-earn-toast-container';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '#' + CONTAINER_ID + '{position:fixed;top:1rem;right:1rem;z-index:99999;display:flex;flex-direction:column;gap:.6rem;max-width:340px;font:14px/1.45 -apple-system,"Segoe UI",Roboto,system-ui,sans-serif}' +
      '.de-toast{background:#fff;color:#1f1235;border:1px solid #e5dcf2;border-left:6px solid #facc15;border-radius:10px;padding:.85rem 1rem .85rem 1.1rem;box-shadow:0 10px 28px rgba(88,28,135,.22);position:relative;animation:de-pop .25s ease-out}' +
      '.de-toast.de-earned{border-left-color:#16a34a}' +
      '.de-toast.de-anon{border-left-color:#facc15}' +
      '.de-toast .de-title{font-weight:700;color:#581c87;margin:0 0 .15rem;font-size:.95rem}' +
      '.de-toast .de-body{margin:0;color:#1f1235}' +
      '.de-toast .de-body small{display:block;color:#6b5b85;margin-top:.2rem;font-size:.78rem}' +
      '.de-toast a{color:#581c87;font-weight:700;text-decoration:underline}' +
      '.de-toast .de-close{position:absolute;top:.35rem;right:.5rem;background:none;border:none;color:#6b5b85;font-size:1.1rem;cursor:pointer;line-height:1;padding:.2rem .4rem}' +
      '.de-toast .de-close:hover{color:#1f1235}' +
      '@keyframes de-pop{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(s);
  }

  function ensureContainer() {
    var c = document.getElementById(CONTAINER_ID);
    if (c) return c;
    c = document.createElement('div');
    c.id = CONTAINER_ID;
    document.body.appendChild(c);
    return c;
  }

  function showToast(opts) {
    ensureStyles();
    var container = ensureContainer();
    var el = document.createElement('div');
    el.className = 'de-toast ' + (opts.variant === 'anon' ? 'de-anon' : 'de-earned');
    var title = document.createElement('p');
    title.className = 'de-title';
    title.textContent = opts.title || '';
    var body = document.createElement('p');
    body.className = 'de-body';
    body.innerHTML = opts.html || '';
    var close = document.createElement('button');
    close.className = 'de-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    var dismiss = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    close.addEventListener('click', dismiss);
    el.appendChild(title);
    el.appendChild(body);
    el.appendChild(close);
    container.appendChild(el);
    setTimeout(dismiss, opts.duration || 9000);
  }

  function formatMp(cents) {
    var dollars = cents / 100;
    return dollars.toFixed(2) + ' MP';
  }

  function readUser() {
    try {
      var raw = localStorage.getItem('dl_user');
      if (!raw || raw === '__anon__') return null;
      return raw.replace(/^"|"$/g, '');
    } catch (e) {
      return null;
    }
  }

  function buildPayload(user) {
    var body = { user: user };
    try { body.attempts = JSON.parse(localStorage.getItem('dl_attempts') || '[]'); } catch (e) { body.attempts = []; }
    try { body.misses = JSON.parse(localStorage.getItem('dl_misses') || '[]'); } catch (e) { body.misses = []; }
    try { body.unitScores = JSON.parse(localStorage.getItem('dl_unit_scores') || '{}'); } catch (e) { body.unitScores = {}; }
    try { body.sr = JSON.parse(localStorage.getItem('dl_sr') || '{}'); } catch (e) { body.sr = {}; }
    try {
      var dc = JSON.parse(localStorage.getItem('dl_deck_completions') || '{}');
      if (dc && typeof dc === 'object') body.deckCompletions = dc;
    } catch (e) {}
    return body;
  }

  function showAnonBanner() {
    showToast({
      variant: 'anon',
      title: 'Great round!',
      html: 'Log in or register at <a href="/drive">the Drive home page</a> to start earning MP for your work.'
    });
  }

  function showEarnedBanner(cents, reasons) {
    var reasonText = '';
    if (Array.isArray(reasons) && reasons.length) {
      reasonText = '<small>' + reasons.map(function (r) { return String(r).replace(/[<>&]/g, ''); }).join(' &middot; ') + '</small>';
    }
    showToast({
      variant: 'earned',
      title: '+' + formatMp(cents) + ' earned',
      html: 'Nice work! Added to your wallet.' + reasonText
    });
  }

  function postProgressAndShow() {
    var user = readUser();
    if (!user) {
      // Anonymous: server would 404 even if we POSTed. Just show the friendly
      // banner directly so we don't waste a request.
      try { showAnonBanner(); } catch (e) {}
      return;
    }
    var payload = buildPayload(user);
    try {
      fetch('/api/drive/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      })
        .then(function (res) {
          if (res.status === 404) {
            // Logged-in cookie says one thing, server has no record — treat
            // as anonymous for surfacing purposes.
            showAnonBanner();
            return null;
          }
          if (!res.ok) return null;
          return res.json().catch(function () { return null; });
        })
        .then(function (data) {
          if (data && typeof data.earnedCents === 'number' && data.earnedCents > 0) {
            showEarnedBanner(data.earnedCents, data.earnReasons);
          }
        })
        .catch(function () { /* network fail — silent */ });
    } catch (e) { /* ignore */ }
  }

  window.driveEarnToast = {
    postProgressAndShow: postProgressAndShow,
    showAnonBanner: showAnonBanner,
    showEarnedBanner: showEarnedBanner
  };
})();
