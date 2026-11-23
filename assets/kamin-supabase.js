// Kamin Dashboard — shared Supabase client
// Wired 2026-09-13. Uses the anon/publishable key, safe to ship client-side
// (RLS on every table enforces real access control server-side).
// Load order required in each page: supabase-js UMD build, then this file.
(function () {
  var KAMIN_SUPABASE_URL = "https://rarusrmvxmcsthqwnjwn.supabase.co";
  var KAMIN_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcnVzcm12eG1jc3RocXduanduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMzQwNDgsImV4cCI6MjEwNDgxMDA0OH0.8wdO9fFykr4HhFMySJnNglCX3vHD4k-Cs2g3PqJGdOE";
  // Read by assets/kamin-errors.js (error log) so the key lives in one file.
  window.KAMIN_SUPABASE = { url: KAMIN_SUPABASE_URL, anonKey: KAMIN_SUPABASE_ANON_KEY };
  window.kaminSupabase = supabase.createClient(KAMIN_SUPABASE_URL, KAMIN_SUPABASE_ANON_KEY);

  // A session-less client for public submissions (e.g. a gift purchase)
  // that must go through the anon RLS policies even when the visitor
  // happens to be signed in. Created on first use only.
  // v4 uuid for client-generated row ids. crypto.randomUUID only exists from
  // Safari 15.4 on, and older iPhones hit the error banner on submit (bug
  // list 2026-09-23, item 7); getRandomValues is available everywhere.
  window.kaminUuid = function () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 0x100).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  var publicClient = null;
  window.kaminPublicSupabase = function () {
    if (!publicClient) {
      publicClient = supabase.createClient(KAMIN_SUPABASE_URL, KAMIN_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'kamin-public-anon' }
      });
    }
    return publicClient;
  };
})();
