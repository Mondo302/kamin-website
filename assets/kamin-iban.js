/* Kamin: Saudi IBAN check (admin Settings, bank-transfer details).
 * A Saudi IBAN is "SA" + 22 digits (24 characters) and passes the ISO 13616
 * mod-97 test. The database enforces the same rule (admin_settings check);
 * this copy only gives the owner a plain message before saving.
 * Returns { ok: true, value } with the normalised IBAN, or { ok: false, message }. */
(function (root) {
  function checkSaudiIban(input) {
    var v = String(input == null ? '' : input).replace(/\s+/g, '').toUpperCase();
    if (!v) return { ok: false, message: 'Enter the IBAN.' };
    if (v.slice(0, 2) !== 'SA') return { ok: false, message: 'A Saudi IBAN starts with SA.' };
    if (v.length !== 24) return { ok: false, message: 'A Saudi IBAN has 24 characters (SA + 22 digits). This one has ' + v.length + '.' };
    if (!/^SA[0-9]{22}$/.test(v)) return { ok: false, message: 'After SA, a Saudi IBAN has digits only.' };
    // Move the first four characters to the end, S=28 A=10, then mod 97 in chunks.
    var digits = v.slice(4) + '2810' + v.slice(2, 4);
    var rem = 0;
    for (var i = 0; i < digits.length; i += 7) rem = Number(String(rem) + digits.slice(i, i + 7)) % 97;
    if (rem !== 1) return { ok: false, message: 'This IBAN fails its check digits. Check it for a typo.' };
    return { ok: true, value: v };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { checkSaudiIban: checkSaudiIban };
  else root.kaminCheckSaudiIban = checkSaudiIban;
})(this);
