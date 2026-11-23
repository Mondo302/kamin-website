// Kamin — frontend error reporting (build-standards layer 12).
// Added 2026-09-26. Forms and dashboards call kaminReportError() where a
// save fails; uncaught errors and unhandled promise rejections are reported
// automatically. Rows go to a Supabase table through the public anon key,
// the same way the public forms save.
//
// Load order: after assets/kamin-supabase.js (which sets
// window.KAMIN_SUPABASE = { url, anonKey }). A page without it (the
// marketing site) sets window.KAMIN_SUPABASE itself.
//
// TABLE NAME is configurable, because the backend agent creates the table
// on branch backend-wiring and may name it differently. Default
// 'app_errors'; override before this file loads with
//   <script>window.KAMIN_ERROR_LOG = { table: 'some_other_name' };</script>
// or change DEFAULT_TABLE below (one place).
//
// Row shape = the backend's table, db/pending-2026-09-26-04-app-errors.sql
// on branch backend-wiring (a column the table lacks makes PostgREST reject
// the whole row, so the shape is pinned by tests):
//   source text  (1-80)    'web.' + what was being done, e.g. web.gift-submit
//   message text (1-2000)  the error message
//   page text    (<=500)   origin + path only (no query string: claim links
//                          carry ids)
//   user_agent text (<=400)
//   detail jsonb (<=8000 bytes)  { code, details, hint, name, stack, lang, extra }
// id, created_at, severity ('error'), reported_by (auth.uid(), null here:
// the insert uses the anon key) and resolved_at come from table defaults.
// That migration's policy lets anon insert, only the owner read. No form
// field values are ever sent. The only definition of window.kaminReportError:
// the unwired duplicate assets/kamin-report-error.js was deleted 2026-10-24.
//
// NO-OP UNTIL THE TABLE EXISTS: the first rejection (404 table not found,
// 400 unknown column, 401/403 no insert policy) switches reporting off for
// the rest of the browser session, so a missing table costs one failed
// request per session, never a loop and never an exception. A network
// failure does not switch it off. At most 5 reports per page load.
(function () {
  var DEFAULT_TABLE = 'app_errors';
  var MAX_PER_PAGE = 5;
  var OFF_KEY = 'kamin-errlog-off';

  var sent = 0;
  var off = false;
  try { off = window.sessionStorage.getItem(OFF_KEY) === '1'; } catch (e) {}

  function cut(s, n) { return s == null ? null : String(s).slice(0, n); }

  window.kaminReportError = function (context, err, extra) {
    try {
      var sb = window.KAMIN_SUPABASE;
      if (off || !sb || !sb.url || !sb.anonKey || sent >= MAX_PER_PAGE || typeof fetch !== 'function') return Promise.resolve(false);
      sent++;
      var cfg = window.KAMIN_ERROR_LOG || {};
      var table = cfg.table || DEFAULT_TABLE;
      err = err || {};
      var message = err.message || (typeof err === 'string' ? err : '');
      var row = {
        source: cut('web.' + (context || 'unknown'), 80),
        message: cut(message, 2000) || 'unknown error',
        page: cut(location.origin + location.pathname, 500),
        user_agent: cut(navigator.userAgent, 400),
        detail: {
          code: cut(err.code, 40), details: cut(err.details, 1000), hint: cut(err.hint, 500),
          name: cut(err.name, 80), stack: cut(err.stack, 1500),
          lang: cut(document.documentElement.lang, 8),
          extra: extra ? cut(JSON.stringify(extra), 2000) : null
        }
      };
      return fetch(sb.url + '/rest/v1/' + encodeURIComponent(table), {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: sb.anonKey,
          Authorization: 'Bearer ' + sb.anonKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(row)
      }).then(function (res) {
        if (!res.ok) {
          off = true;
          try { window.sessionStorage.setItem(OFF_KEY, '1'); } catch (e) {}
        }
        return res.ok;
      }, function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  };

  window.addEventListener('error', function (ev) {
    // Resource load failures (a broken image) arrive here without ev.error;
    // only script errors are reported.
    if (!ev || (!ev.error && !ev.message)) return;
    window.kaminReportError('uncaught', ev.error || { message: ev.message }, { file: cut(ev.filename, 200), line: ev.lineno, col: ev.colno });
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    window.kaminReportError('unhandled-rejection', r instanceof Error ? r : { message: cut(typeof r === 'string' ? r : JSON.stringify(r), 1000) });
  });
})();
