/* Kamin — structured intake answers and form file uploads (2026-10-01).
 *
 * Every submitted service_requests row carries `intake`: one JSON object with
 * EVERY answer the form collected (migration 19), so the owner sees exactly
 * what the client filled in. Files the form asks for (the CV) go to the
 * private `client-files` bucket (migration 20) under "<client_id>/<uuid>.<ext>".
 * The path is declared in intake.files BEFORE the upload: the bucket only
 * accepts a path a just-submitted request of that client declared.
 *
 *   var plan = kaminIntakePlanFiles(form, clientId);   // {files, error}
 *   row.intake = kaminIntakeRecord(form, 'new-client', plan.files);
 *   ... insert the rows ...
 *   var failed = await kaminIntakeUpload(db, plan.files); // [] when all uploaded
 *
 * Limits (the bucket enforces them too): PDF / Word, 10 MB each, 3 files.
 */
(function (){
  var MAX_BYTES = 10 * 1024 * 1024;
  var MAX_FILES = 3;
  var TYPES = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  // Never stored: the bot-guard honeypot.
  var SKIP = { kx_hp: true };

  function isFile(v){ return typeof File !== 'undefined' && v instanceof File; }

  // Every non-file answer, keyed by the field's name; repeated names (checkbox
  // groups) become arrays. Empty answers are left out.
  window.kaminIntakeAnswers = function (form){
    var answers = {};
    new FormData(form).forEach(function (value, key){
      if (SKIP[key] || isFile(value)) return;
      var v = String(value).trim();
      if (!v) return;
      if (!(key in answers)) answers[key] = v;
      else if (Array.isArray(answers[key])) answers[key].push(v);
      else answers[key] = [answers[key], v];
    });
    return answers;
  };

  // Chooses a storage path for every chosen file. error: 'type' | 'size' |
  // 'count' (with the field name) when a file breaks a limit; nothing is
  // uploaded or saved in that case.
  window.kaminIntakePlanFiles = function (form, clientId){
    var files = [];
    // The payment proof (data-not-intake) has its own bucket and rules.
    var inputs = form.querySelectorAll('input[type="file"]:not([data-not-intake])');
    for (var i = 0; i < inputs.length; i++){
      var input = inputs[i];
      var list = input.files || [];
      for (var j = 0; j < list.length; j++){
        var f = list[j];
        var ext = (f.name.split('.').pop() || '').toLowerCase();
        if (!TYPES[ext]) return { files: [], error: 'type', field: input.name };
        if (f.size > MAX_BYTES) return { files: [], error: 'size', field: input.name };
        files.push({
          field: input.name,
          path: clientId + '/' + window.kaminUuid() + '.' + ext,
          name: f.name.slice(0, 200),
          size: f.size,
          type: TYPES[ext],
          file: f
        });
      }
    }
    if (files.length > MAX_FILES) return { files: [], error: 'count', field: files[0].field };
    return { files: files, error: null };
  };

  window.kaminIntakeRecord = function (form, formName, plannedFiles){
    return {
      form: formName,
      version: 1,
      answers: window.kaminIntakeAnswers(form),
      files: (plannedFiles || []).map(function (p){
        return { field: p.field, path: p.path, name: p.name, size: p.size, type: p.type };
      })
    };
  };

  // Uploads the planned files; never overwrites. Returns the ones that failed
  // (each reported through kaminReportError, without the file name).
  window.kaminIntakeUpload = async function (db, plannedFiles){
    var failed = [];
    for (var i = 0; i < (plannedFiles || []).length; i++){
      var p = plannedFiles[i];
      var res;
      try {
        res = await db.storage.from('client-files').upload(p.path, p.file, { contentType: p.type, upsert: false });
      } catch (e){ res = { error: e }; }
      if (res && res.error){
        failed.push(p);
        if (window.kaminReportError) window.kaminReportError('intake-file-upload', res.error);
      }
    }
    return failed;
  };
})();
