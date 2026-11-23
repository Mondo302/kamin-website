/* One price list for the public forms (2026-10-15).
   Reads public.price_list (pending 26: anyone may read, only the owner
   writes) and returns it shaped for the forms:
     { services: { resumeWriting: { early: 1199, ... }, ... },
       flat: { ats: 399, ... }, membership: 499,
       bundles: [ { item, name, minServices, percent } ] (by minServices),
       speed: { priority: { name, percent, appliesTo }, ... } }
   load() rejects on any failure or an incomplete list. There is no
   fallback price list on purpose: a form must never quote stale prices. */
(function () {
  var REQUIRED = ['resumeWriting', 'linkedinOpt', 'portfolioDev'];

  function shape(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error('price list is empty');
    var out = { services: {}, flat: {}, membership: null, bundles: [], speed: {} };
    rows.forEach(function (r) {
      if (r.category === 'service') {
        (out.services[r.item] = out.services[r.item] || {})[r.level] = Number(r.amount_sar);
      } else if (r.category === 'flat') {
        out.flat[r.item] = Number(r.amount_sar);
      } else if (r.category === 'membership') {
        out.membership = Number(r.amount_sar);
      } else if (r.category === 'bundle') {
        out.bundles.push({ item: r.item, name: r.name, minServices: Number(r.min_services), percent: Number(r.percent) });
      } else if (r.category === 'speed') {
        out.speed[r.item] = { name: r.name, percent: Number(r.percent), appliesTo: r.applies_to };
      }
    });
    out.bundles.sort(function (a, b) { return a.minServices - b.minServices; });
    REQUIRED.forEach(function (k) { if (!out.services[k]) throw new Error('price list has no ' + k); });
    if (!(out.membership > 0)) throw new Error('price list has no membership');
    if (!out.speed.priority || !out.speed.express) throw new Error('price list has no delivery speeds');
    return out;
  }

  function load() {
    var cfg = window.KAMIN_SUPABASE;
    if (!cfg || !window.fetch) return Promise.reject(new Error('no database config'));
    return fetch(cfg.url + '/rest/v1/price_list?select=category,item,level,amount_sar,percent,name,min_services,applies_to', {
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }
    }).then(function (res) {
      if (!res.ok) throw new Error('price list HTTP ' + res.status);
      return res.json();
    }).then(shape);
  }

  window.kaminPrices = { load: load, shape: shape };
})();
