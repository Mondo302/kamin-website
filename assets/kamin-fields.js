/* Kamin form fields: when to show an error, and what counts as valid.
 *
 * Shared by the four client forms (intake, returning, gift, service review).
 * Added 2026-09-26 after Mohannad's pass on the intake:
 *   - error lines stay hidden on load and while typing; they appear only for
 *     the current step when Next/Submit is pressed (validatePanel), and each
 *     one clears as soon as its field is fixed (watch);
 *   - a filled-in field must match its own format, and says which format.
 *
 * Markup it reads (all already in the forms):
 *   .field[data-required]            the field must be answered when visible
 *   .field[data-group="name"]        at least one checkbox of that name
 *   .err-msg[data-ar] / [data-en]    the field's message pair (created if missing)
 *   input[data-kind="linkedin|amount"], input[data-min="today"]
 *   input[data-required-if="radioName=value"]   required only when that radio is picked
 *   input[data-match="otherName"]    must equal that input (a "confirm" field);
 *                                    both empty counts as a match
 *
 * It never touches what a form submits beyond tidying two values in place
 * (Arabic-Indic digits in a mobile number or amount become 0-9; thousands
 * separators are dropped from an amount), so the saved value is the one the
 * person sees.
 */
(function () {
  'use strict';

  var MESSAGES = {
    email: {
      en: 'Enter an email address like name@example.com',
      ar: 'أدخل بريدًا إلكترونيًا صحيحًا، مثل <bdi dir="ltr">name@example.com</bdi>'
    },
    mobile: {
      en: 'Enter a mobile number of 8 to 15 digits, using only digits, spaces and a leading +',
      ar: 'أدخل رقم جوال من 8 إلى 15 رقمًا، بالأرقام والمسافات فقط، ويمكن أن يبدأ بعلامة +'
    },
    'mobile-sa': {
      en: 'A Saudi mobile number is 05 and 8 more digits, or +966 5 and 8 more digits',
      ar: 'رقم الجوال السعودي يبدأ بـ <bdi dir="ltr">05</bdi> ثم 8 أرقام، أو <bdi dir="ltr">+966 5</bdi> ثم 8 أرقام'
    },
    linkedin: {
      en: 'Enter your LinkedIn profile link, like linkedin.com/in/your-name',
      ar: 'أدخل رابط ملفك في لينكدإن، مثل <bdi dir="ltr">linkedin.com/in/your-name</bdi>'
    },
    url: {
      en: 'Enter a web address, like example.com',
      ar: 'أدخل رابطًا صحيحًا، مثل <bdi dir="ltr">example.com</bdi>'
    },
    date: {
      en: 'Enter a full date',
      ar: 'أدخل تاريخًا كاملًا'
    },
    'date-past': {
      en: 'Choose today or a later date',
      ar: 'اختر تاريخ اليوم أو تاريخًا لاحقًا'
    },
    amount: {
      en: 'Enter the amount in riyals, using numbers only',
      ar: 'أدخل المبلغ بالريال، بالأرقام فقط'
    },
    'match-email': {
      en: "This doesn't match the email above. Type the same address in both fields",
      ar: 'البريد لا يطابق البريد المُدخل أعلاه. اكتب العنوان نفسه في الحقلين'
    },
    'match-mobile': {
      en: "This doesn't match the mobile number above. Type the same number in both fields",
      ar: 'الرقم لا يطابق رقم الجوال المُدخل أعلاه. اكتب الرقم نفسه في الحقلين'
    }
  };

  var AR_DIGITS = /[٠-٩۰-۹]/g;
  function normalizeDigits(s) {
    return String(s == null ? '' : s).replace(AR_DIGITS, function (d) {
      var c = d.charCodeAt(0);
      return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660);
    });
  }

  function kindOf(el) {
    var k = el.getAttribute('data-kind');
    if (k) return k;
    var t = (el.getAttribute('type') || el.type || '').toLowerCase();
    if (t === 'email') return 'email';
    if (t === 'tel') return 'mobile';
    if (t === 'url') return 'url';
    if (t === 'date') return 'date';
    if (t === 'number') return 'amount';
    return null;
  }

  var EMAIL = /^[^\s@]+@([^\s@.]+\.)+[^\s@.]{2,}$/;

  function checkMobile(v) {
    if (!/^\+?[0-9][0-9 -]*$/.test(v)) return 'mobile';
    var digits = v.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return 'mobile';
    var intl = v.charAt(0) === '+' || digits.indexOf('00') === 0;
    var national = null;
    if (intl) {
      var cc = digits.replace(/^00/, '');
      if (cc.indexOf('966') === 0) national = cc.slice(3).replace(/^0/, '');
    } else if (/^9665/.test(digits) && digits.length === 12) {
      national = digits.slice(3);
    } else if (digits.indexOf('05') === 0) {
      national = digits.slice(1);
    }
    if (national !== null && !/^5[0-9]{8}$/.test(national)) return 'mobile-sa';
    return null;
  }

  function checkUrl(v, linkedin) {
    if (/\s/.test(v)) return linkedin ? 'linkedin' : 'url';
    var u;
    try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : 'https://' + v); } catch (e) { return linkedin ? 'linkedin' : 'url'; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return linkedin ? 'linkedin' : 'url';
    var host = u.hostname.toLowerCase();
    if (host.indexOf('.') < 1) return linkedin ? 'linkedin' : 'url';
    if (linkedin) {
      if (host !== 'linkedin.com' && !/\.linkedin\.com$/.test(host)) return 'linkedin';
      if (u.pathname.replace(/\/+$/, '').length < 2) return 'linkedin';
    }
    return null;
  }

  function todayStr() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /** Tidies a value in place where the tidy form is unambiguous. */
  function tidy(el) {
    var k = kindOf(el);
    if (k !== 'mobile' && k !== 'amount') return;
    var v = normalizeDigits(el.value);
    if (k === 'amount') v = v.replace(/[\s,٬]/g, '');
    if (v !== el.value) el.value = v;
  }

  /**
   * Format check for one filled-in control. Returns null when fine, or
   * { reason: 'format', kind: <message key> }. Empty values are the
   * caller's concern (required or not).
   */
  function checkFormat(el) {
    var k = kindOf(el);
    if (!k) return null;
    var v = String(el.value || '').trim();
    if (k === 'mobile' || k === 'amount') v = normalizeDigits(v);
    var bad = null;
    if (k === 'email') bad = EMAIL.test(v) ? null : 'email';
    else if (k === 'mobile') bad = checkMobile(v);
    else if (k === 'linkedin') bad = checkUrl(v, true);
    else if (k === 'url') bad = checkUrl(v, false);
    else if (k === 'amount') {
      var n = v.replace(/[\s,٬]/g, '');
      bad = (/^[0-9]+(\.[0-9]{1,2})?$/.test(n) && parseFloat(n) > 0) ? null : 'amount';
    } else if (k === 'date') {
      if ((el.validity && el.validity.badInput) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) bad = 'date';
      else if (el.getAttribute('data-min') === 'today' && v < todayStr()) bad = 'date-past';
    }
    return bad ? { reason: 'format', kind: bad } : null;
  }

  /** Public single-control check: null, {reason:'required'} or {reason:'format', kind}. */
  function check(el) {
    var empty = String(el.value || '').trim() === '';
    if (empty) return el.required ? { reason: 'required' } : null;
    return checkFormat(el);
  }

  /** A value as compared by data-match: trimmed; emails case-blind; mobiles digits and + only. */
  function comparable(el) {
    var v = String(el.value || '').trim();
    var k = kindOf(el);
    if (k === 'email') return v.toLowerCase();
    if (k === 'mobile') return normalizeDigits(v).replace(/[^0-9+]/g, '');
    return v;
  }

  function isShown(el) { return !!el && el.getClientRects().length > 0; }
  var TEXTY = 'input:not([type=radio]):not([type=checkbox]):not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]), textarea';

  function requiredIfMet(el, scope) {
    var cond = el.getAttribute('data-required-if');
    if (!cond) return false;
    var parts = cond.split('=');
    return !!scope.querySelector('input[name="' + parts[0] + '"][value="' + parts[1] + '"]:checked');
  }

  /**
   * Works out whether one .field is answered correctly. Returns
   * { ok, reason, kind, control } without touching the page.
   */
  function evaluate(field, scope) {
    scope = scope || field.closest('form') || document;
    var required = field.hasAttribute('data-required');
    var group = field.getAttribute('data-group');
    if (group) {
      var boxes = field.querySelectorAll('input[name="' + group + '"]');
      var any = scope.querySelectorAll('input[name="' + group + '"]:checked').length > 0;
      if (required && !any) return { ok: false, reason: 'required', control: boxes[0] || null };
    } else if (required) {
      var primary = field.querySelector('input[required], select[required], textarea[required]') ||
        field.querySelector('input[type=radio]') || field.querySelector('select, ' + TEXTY) ||
        field.querySelector('input[type=hidden]');
      if (primary) {
        var answered;
        if (primary.type === 'radio') answered = scope.querySelectorAll('input[name="' + primary.name + '"]:checked').length > 0;
        else if (primary.type === 'checkbox') answered = primary.checked;
        else answered = String(primary.value || '').trim() !== '';
        if (!answered) {
          var focusTarget = primary.type === 'hidden' ? (field.querySelector('[tabindex="0"], .combo-input') || primary) : primary;
          return { ok: false, reason: 'required', control: focusTarget };
        }
        if (primary.type !== 'radio' && primary.type !== 'checkbox' && primary.type !== 'hidden') {
          var f = checkFormat(primary);
          if (f) return { ok: false, reason: 'format', kind: f.kind, control: primary };
        }
      }
    }
    // Any other filled-in text control in the field must match its format,
    // and a conditionally required one must be filled when its condition holds.
    var others = field.querySelectorAll(TEXTY);
    for (var i = 0; i < others.length; i++) {
      var el = others[i];
      if (!isShown(el)) continue;
      var empty = String(el.value || '').trim() === '';
      if (empty) {
        if (requiredIfMet(el, scope)) return { ok: false, reason: 'format', kind: kindOf(el) || 'required', control: el };
        continue;
      }
      if (el.hasAttribute('data-required-if') && !requiredIfMet(el, scope)) continue;
      var bad = checkFormat(el);
      if (bad) return { ok: false, reason: 'format', kind: bad.kind, control: el };
    }
    // A confirm field must repeat the value it names (checked even when
    // empty, so a typed original with a blank confirm is caught).
    for (var j = 0; j < others.length; j++) {
      var m = others[j];
      var target = m.getAttribute('data-match');
      if (!target || !isShown(m)) continue;
      var orig = scope.querySelector('[name="' + target + '"]');
      if (orig && comparable(m) !== comparable(orig)) {
        return { ok: false, reason: 'format', kind: kindOf(m) === 'email' ? 'match-email' : 'match-mobile', control: m };
      }
    }
    return { ok: true };
  }

  var uid = 0;
  function messagePair(field) {
    var ar = field.querySelector(':scope > .err-msg[data-ar]');
    var en = field.querySelector(':scope > .err-msg[data-en]');
    if (!ar || !en) {
      ar = document.createElement('div'); ar.className = 'err-msg'; ar.setAttribute('data-ar', '');
      en = document.createElement('div'); en.className = 'err-msg'; en.setAttribute('data-en', '');
      field.appendChild(ar); field.appendChild(en);
    }
    [ar, en].forEach(function (m) {
      if (!m.id) m.id = 'kf-msg-' + (++uid);
      if (!m.hasAttribute('data-default')) m.setAttribute('data-default', m.innerHTML);
    });
    return { ar: ar, en: en };
  }

  function controlsOf(field) {
    return field.querySelectorAll('input:not([type=hidden]), select, textarea, .combo-input');
  }

  /** Shows or clears one field's error, per the result of evaluate(). */
  function render(field, res) {
    var pair = messagePair(field);
    var lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
    field.classList.toggle('invalid', !res.ok);
    ['ar', 'en'].forEach(function (l) {
      var m = pair[l];
      var html = (!res.ok && res.reason === 'format' && MESSAGES[res.kind]) ? MESSAGES[res.kind][l] : m.getAttribute('data-default');
      if (m.innerHTML !== html) m.innerHTML = html;
    });
    controlsOf(field).forEach(function (c) {
      if (!res.ok && (c === res.control || !res.control)) {
        c.setAttribute('aria-invalid', 'true');
        c.setAttribute('aria-describedby', pair[lang].id);
      } else {
        c.removeAttribute('aria-invalid');
        if (c.getAttribute('aria-describedby') === pair.ar.id || c.getAttribute('aria-describedby') === pair.en.id) c.removeAttribute('aria-describedby');
      }
    });
    return res.ok;
  }

  function validateField(field, scope) {
    field.querySelectorAll(TEXTY).forEach(tidy);
    return render(field, evaluate(field, scope));
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Puts a field's label just below the sticky .nav. scrollIntoView 'center' (before 2026-10-18)
   * pushed any field taller than the screen, like the gift form's 9-item service list, up under
   * the header. A short field still ends fully on screen: the gap shrinks to make it fit.
   */
  function scrollBelowHeader(field) {
    var nav = document.querySelector('.nav');
    var pos = nav ? getComputedStyle(nav).position : '';
    var navBottom = nav && (pos === 'sticky' || pos === 'fixed') ? nav.getBoundingClientRect().height : 0;
    var label = (field.querySelector && field.querySelector('.flabel')) || field;
    var r = field.getBoundingClientRect();
    var top = Math.min(label.getBoundingClientRect().top, r.top);
    var gap = Math.max(0, Math.min(12, window.innerHeight - navBottom - r.height));
    window.scrollTo({ top: Math.max(0, window.scrollY + top - navBottom - gap), behavior: reducedMotion() ? 'auto' : 'smooth' });
    // The header can change height once the page scrolls (new-client form at 360px), so check once
    // the scroll has settled and close any gap under the header.
    var settled = false;
    function settle() {
      if (settled) return; settled = true;
      var nb = nav && (pos === 'sticky' || pos === 'fixed') ? nav.getBoundingClientRect().bottom : 0;
      var t = Math.min(label.getBoundingClientRect().top, field.getBoundingClientRect().top);
      if (t < nb) window.scrollBy({ top: t - nb - gap, behavior: 'auto' });
    }
    window.addEventListener('scrollend', settle, { once: true });
    setTimeout(settle, 900);
  }

  /**
   * Validates every visible .field in a step (or a whole single-page form),
   * shows the errors, and moves focus to the first one. Returns true when
   * the step can be left.
   */
  function validatePanel(panel) {
    var ok = true;
    var first = null;
    var seen = {};
    panel.querySelectorAll('.field').forEach(function (field) {
      if (!isShown(field) || field.hasAttribute('data-no-validate')) return;
      var g = field.getAttribute('data-group');
      if (g) { if (seen[g]) return; seen[g] = true; }
      var res = evaluate(field, panel);
      field.querySelectorAll(TEXTY).forEach(tidy);
      if (!render(field, res)) {
        ok = false;
        if (!first) first = res.control || field;
      }
    });
    if (first) {
      // After the caller's own scroll-to-top (the review form does one), so
      // the person lands on the first thing to fix.
      setTimeout(function () {
        try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
        scrollBelowHeader(first.closest('.field') || first);
      }, 0);
    }
    return ok;
  }

  /** Clears (or updates) an error as soon as the person changes a flagged field. */
  function watch(form) {
    if (!form || form.__kaminFieldsWatched) return;
    form.__kaminFieldsWatched = true;
    var onChange = function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var field = t.closest('.field');
      var scope = t.closest('.panel') || form;
      // A checkbox group's name can be flagged on its own field only.
      if (field && field.classList.contains('invalid')) {
        render(field, evaluate(field, scope));
      }
      // Editing an original re-checks a flagged confirm field that names it.
      if (t.name) {
        scope.querySelectorAll('.field.invalid [data-match="' + t.name + '"]').forEach(function (c) {
          var f = c.closest('.field');
          if (f !== field) render(f, evaluate(f, scope));
        });
      }
      // A radio can make a sibling's conditional input required or not.
      if (t.type === 'radio') {
        scope.querySelectorAll('.field.invalid').forEach(function (f) { if (f !== field) render(f, evaluate(f, scope)); });
      }
    };
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    form.addEventListener('blur', function (e) { if (e.target && e.target.matches && e.target.matches(TEXTY)) tidy(e.target); }, true);
  }

  window.KaminFields = {
    MESSAGES: MESSAGES,
    normalizeDigits: normalizeDigits,
    check: check,
    evaluate: evaluate,
    validateField: validateField,
    validatePanel: validatePanel,
    watch: watch
  };
})();
