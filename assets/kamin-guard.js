// Kamin — abuse protection for public forms (build-standards layer 9).
// Added 2026-09-26. No third-party captcha: two cheap signals that stop
// the bulk of form-spam bots without asking real people to do anything.
//
//   1. Honeypot: an off-screen text field named kx_hp (not "website", so
//      browser autofill leaves it alone). People never see or reach it;
//      bots that fill every field do. Verdict 'bot'.
//   2. Minimum time to submit: a submit less than MIN_MS after the page
//      loaded is faster than a person can fill any of these forms.
//      Verdict 'too-fast'.
//
// What each form does with the verdict:
//   'bot'      -> show the normal thank-you and save nothing, so the bot
//                 learns nothing.
//   'too-fast' -> save nothing and show #tooFastError ("please submit
//                 again"). Never a fake success: if a real person ever is
//                 that fast, they are told and their second press saves.
//   'ok'       -> save as normal.
//
// This is a speed bump, not a wall: Supabase's anon insert policies are
// still open to anyone holding the public key. Server-side rate limiting
// is backend work (see the release note).
//
// Usage: var guard = kaminFormGuard(formElement); ... guard.verdict()
(function () {
  var MIN_MS = 3000;

  window.kaminFormGuard = function (form, opts) {
    opts = opts || {};
    var minMs = typeof opts.minMs === 'number' ? opts.minMs : MIN_MS;
    var started = Date.now();
    var hp = form.querySelector('input[name="kx_hp"]');
    if (!hp) {
      var wrap = document.createElement('div');
      wrap.setAttribute('aria-hidden', 'true');
      // Clipped to 1px in place, not pushed off-screen: a left:-10000px
      // box makes Arabic (RTL) pages scroll sideways.
      wrap.style.cssText = 'position:absolute; width:1px; height:1px; margin:0; padding:0; border:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap; opacity:0; pointer-events:none;';
      hp = document.createElement('input');
      hp.type = 'text';
      hp.name = 'kx_hp';
      hp.tabIndex = -1;
      hp.setAttribute('autocomplete', 'off');
      wrap.appendChild(hp);
      form.appendChild(wrap);
    }
    return {
      verdict: function () {
        if (hp.value) return 'bot';
        if (Date.now() - started < minMs) return 'too-fast';
        return 'ok';
      }
    };
  };
})();
