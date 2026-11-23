/* Which language a public form opens in (2026-10-02).
   The marketing site links to the forms with ?lang=en|ar; that wins. Without
   it, the visitor's last choice (localStorage 'kamin-lang', written by the
   site's and the forms' language buttons) is used, then the page's default.
   Storage can be missing or blocked (private mode), so every access is
   guarded and the page still opens in its default. */
(function () {
  var KEY = 'kamin-lang';
  function valid(l) { return l === 'en' || l === 'ar' ? l : null; }
  function remember(l) {
    if (!valid(l)) return;
    try { localStorage.setItem(KEY, l); } catch (e) {}
  }
  window.kaminRememberLang = remember;
  // One language at a time in text a toggle span cannot hold (2026-10-18): placeholders carry
  // data-placeholder-en/-ar; options of a select[data-lang-only] are written "Arabic | English"
  // in the markup, split once, and show one side. Values never change, so a choice stays chosen.
  window.kaminLangOnly = function (lang) {
    var ar = lang === 'ar';
    document.querySelectorAll('[data-placeholder-en][data-placeholder-ar]').forEach(function (el) {
      el.placeholder = el.getAttribute(ar ? 'data-placeholder-ar' : 'data-placeholder-en');
    });
    document.querySelectorAll('select[data-lang-only] option').forEach(function (o) {
      if (!o.value) return;
      if (!o.hasAttribute('data-t-en')) {
        var parts = o.textContent.split(' | ');
        o.setAttribute('data-t-ar', parts[0].trim());
        o.setAttribute('data-t-en', (parts[1] || parts[0]).trim());
      }
      o.textContent = o.getAttribute(ar ? 'data-t-ar' : 'data-t-en');
    });
  };
  window.kaminStartLang = function (fallback) {
    var fromLink = null, stored = null;
    try { fromLink = valid(new URLSearchParams(location.search).get('lang')); } catch (e) {}
    if (fromLink) { remember(fromLink); return fromLink; }
    try { stored = valid(localStorage.getItem(KEY)); } catch (e) {}
    return stored || fallback;
  };
})();
