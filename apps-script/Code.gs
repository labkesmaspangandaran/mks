/**
 * MKS — titik masuk Web App.
 *
 * GET  ?action=jadwal          → data publik (jadwal, pemateri, materi, rekaman). Tanpa login.
 * POST {action, idToken, ...}  → aksi yang butuh login Google.
 *
 * Frontend mengirim POST dengan Content-Type text/plain agar tidak memicu preflight CORS.
 */

function doGet(e) {
  return respond_(function () {
    const action = (e && e.parameter && e.parameter.action) || 'jadwal';
    if (action === 'jadwal') return apiJadwal_();
    if (action === 'ping') return { waktu: new Date().toISOString() };
    throw userError_('Aksi tidak dikenal.', 400);
  });
}

function doPost(e) {
  return respond_(function () {
    let body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
      throw userError_('Format permintaan tidak valid.', 400);
    }
    const routes = {
      me: apiMe_,
      hubungkan: apiHubungkan_,
      absen: apiAbsen_,
      uploadStart: apiUploadStart_,
      uploadChunk: apiUploadChunk_,
      uploadFinish: apiUploadFinish_,
      hapusMateri: apiHapusMateri_
    };
    const fn = routes[body.action];
    if (!fn) throw userError_('Aksi tidak dikenal.', 400);
    return fn(body);
  });
}

function respond_(fn) {
  let payload;
  try {
    payload = { ok: true, data: fn() };
  } catch (err) {
    if (!err.userMessage) log_('ERROR', (err && err.stack) || err);
    payload = {
      ok: false,
      code: err.code || 500,
      error: err.userMessage || 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.'
    };
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
