/**
 * MKS — memindahkan rekaman cloud Zoom ke Google Drive.
 *
 * Dijalankan trigger berkala (default tiap 30 menit). Tiap run:
 *  1. Lanjutkan pekerjaan yang belum selesai, atau cari rekaman baru meeting MKS (7 hari terakhir).
 *  2. Unduh MP4 per potongan 24 MB (Range request) lalu kirim ke sesi resumable Drive.
 *     Batas UrlFetchApp ±50 MB per permintaan dan 6 menit per eksekusi, jadi file besar
 *     diselesaikan bertahap di beberapa run. Posisi terakhir disimpan di Script Properties.
 *  3. Setelah lengkap: file dibagikan via link, link + durasi ditulis ke sheet Jadwal,
 *     dicatat di sheet Rekaman, lalu (opsional) rekaman di Zoom dipindah ke Trash.
 *
 * Kebutuhan: app Zoom "Server-to-Server OAuth" dengan izin membaca & menghapus cloud recording.
 * Script Properties: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.
 */

const REC_CHUNK = 24 * 1024 * 1024; // kelipatan 256 KB
const REC_BUDGET_MS = 4.5 * 60 * 1000;
const REC_JOB_KEY = 'REKAMAN_JOB';
const REC_TYPE_PRIORITY = [
  'shared_screen_with_speaker_view',
  'shared_screen_with_speaker_view(CC)',
  'shared_screen_with_gallery_view',
  'speaker_view',
  'active_speaker',
  'gallery_view',
  'shared_screen'
];

function prosesRekaman() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return; // run sebelumnya masih berjalan
  const started = Date.now();
  try {
    let job = loadRecJob_();
    if (!job) job = cariRekamanBaru_();
    if (!job) return;

    while (Date.now() - started < REC_BUDGET_MS) {
      const f = job.files.filter(function (x) { return !x.done; })[0];
      if (!f) {
        selesaikanRekaman_(job);
        props_().deleteProperty(REC_JOB_KEY);
        return;
      }
      transferChunk_(job, f);
      saveRecJob_(job);
    }
  } catch (e) {
    log_('REKAMAN', (e && e.stack) || e);
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------ Zoom ------------------------------ */

function zoomToken_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('zoom_token');
  if (hit) return hit;
  const accountId = secret_('ZOOM_ACCOUNT_ID', true);
  const basic = Utilities.base64Encode(secret_('ZOOM_CLIENT_ID', true) + ':' + secret_('ZOOM_CLIENT_SECRET', true));
  const url = 'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + encodeURIComponent(accountId);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Basic ' + basic },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Token Zoom gagal: ' + res.getContentText());
  const data = JSON.parse(res.getContentText());
  cache.put('zoom_token', data.access_token, Math.max(60, (data.expires_in || 3600) - 300));
  return data.access_token;
}

function zoomApi_(method, path) {
  const res = UrlFetchApp.fetch('https://api.zoom.us/v2' + path, {
    method: method,
    headers: { Authorization: 'Bearer ' + zoomToken_() },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error('Zoom API ' + method + ' ' + path + ' → ' + code + ' ' + res.getContentText());
  const text = res.getContentText();
  return text ? JSON.parse(text) : {};
}

/** UUID meeting perlu di-encode dua kali jika diawali "/" atau mengandung "//". */
function encodeUuid_(uuid) {
  const once = encodeURIComponent(uuid);
  return uuid.charAt(0) === '/' || uuid.indexOf('//') >= 0 ? encodeURIComponent(once) : once;
}

function listRekamanZoom_(hariKeBelakang) {
  const host = getSetting_('ZOOM_HOST_EMAIL', '');
  if (!host) throw new Error('ZOOM_HOST_EMAIL di sheet Pengaturan belum diisi.');
  const to = today_();
  const from = addDays_(to, -(hariKeBelakang || 7));
  const data = zoomApi_('get', '/users/' + encodeURIComponent(host) + '/recordings?page_size=50&from=' + from + '&to=' + to);
  const meetingId = getSetting_('ZOOM_MEETING_ID', '').replace(/\D/g, '');
  return (data.meetings || []).filter(function (m) {
    return !meetingId || String(m.id) === meetingId;
  });
}

function cariRekamanBaru_() {
  const selesai = {};
  readTable_(SHEETS.REKAMAN).forEach(function (r) {
    if (String(r['Status']).toUpperCase() === 'SELESAI') selesai[String(r['Meeting UUID'])] = true;
  });

  const meetings = listRekamanZoom_(7).sort(function (a, b) {
    return a.start_time < b.start_time ? -1 : 1;
  });

  for (let i = 0; i < meetings.length; i++) {
    const m = meetings[i];
    if (selesai[m.uuid]) continue;
    const all = m.recording_files || [];
    if (all.some(function (f) { return f.status && f.status !== 'completed'; })) continue; // masih diproses Zoom

    const mp4 = all.filter(function (f) { return f.file_type === 'MP4'; });
    if (!mp4.length) continue;
    let tipe = null;
    for (let k = 0; k < REC_TYPE_PRIORITY.length && !tipe; k++) {
      if (mp4.some(function (f) { return f.recording_type === REC_TYPE_PRIORITY[k]; })) tipe = REC_TYPE_PRIORITY[k];
    }
    const dipilih = mp4
      .filter(function (f) { return !tipe || f.recording_type === tipe; })
      .sort(function (a, b) { return a.recording_start < b.recording_start ? -1 : 1; });

    const tanggal = fmtDate_(new Date(m.start_time));
    return {
      uuid: m.uuid,
      tanggal: tanggal,
      durasiMenit: m.duration || 0,
      files: dipilih.map(function (f, idx) {
        return {
          zoomId: f.id,
          downloadUrl: f.download_url,
          size: Number(f.file_size),
          name: 'MKS ' + tanggal + ' - Rekaman' + (dipilih.length > 1 ? ' bagian ' + (idx + 1) : '') + '.mp4',
          offset: 0,
          sessionUrl: '',
          driveId: '',
          done: false
        };
      })
    };
  }
  return null;
}

/* --------------------------- transfer --------------------------- */

function transferChunk_(job, f) {
  if (!f.sessionUrl) {
    f.sessionUrl = bukaSesiDrive_(getSessionFolderId_(job.tanggal, 'Rekaman'), f.name, f.size, 'video/mp4');
    f.offset = 0;
  }
  if (!f._src) f._src = resolveZoomDownload_(f.downloadUrl);

  const end = Math.min(f.offset + REC_CHUNK, f.size) - 1;
  const opt = { headers: { Range: 'bytes=' + f.offset + '-' + end }, muteHttpExceptions: true };
  if (f._src.auth) opt.headers.Authorization = 'Bearer ' + zoomToken_();
  const dl = UrlFetchApp.fetch(f._src.url, opt);
  const dlCode = dl.getResponseCode();
  if (dlCode === 403 || dlCode === 401) {
    f._retry = (f._retry || 0) + 1;
    if (f._retry > 3) throw new Error('Zoom menolak unduhan (' + dlCode + ') untuk ' + f.name);
    f._src = null; // tautan CDN kedaluwarsa; ambil ulang
    return;
  }
  if (dlCode !== 206 && !(dlCode === 200 && f.offset === 0 && f.size <= REC_CHUNK)) {
    throw new Error('Unduh Zoom gagal (' + dlCode + ') untuk ' + f.name);
  }
  const bytes = dl.getContent();

  const put = UrlFetchApp.fetch(f.sessionUrl, {
    method: 'put',
    contentType: 'application/octet-stream',
    payload: bytes,
    headers: { 'Content-Range': 'bytes ' + f.offset + '-' + (f.offset + bytes.length - 1) + '/' + f.size },
    muteHttpExceptions: true
  });
  const code = put.getResponseCode();
  if (code === 308) {
    const range = headerOf_(put, 'Range');
    f.offset = range ? Number(range.split('-')[1]) + 1 : f.offset + bytes.length;
  } else if (code === 200 || code === 201) {
    f.driveId = JSON.parse(put.getContentText()).id;
    f.done = true;
  } else if (code === 404 || code === 410) {
    f.sessionUrl = ''; // sesi Drive kedaluwarsa (±1 minggu); mulai ulang file ini
    f.offset = 0;
  } else {
    throw new Error('Kirim ke Drive gagal (' + code + '): ' + put.getContentText().slice(0, 300));
  }
}

/** download_url Zoom biasanya mengarahkan (302) ke tautan CDN bertanda tangan yang mendukung Range. */
function resolveZoomDownload_(downloadUrl) {
  const res = UrlFetchApp.fetch(downloadUrl, {
    headers: { Authorization: 'Bearer ' + zoomToken_(), Range: 'bytes=0-0' },
    followRedirects: false,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code >= 300 && code < 400) return { url: headerOf_(res, 'Location'), auth: false };
  if (code === 206 || code === 200) return { url: downloadUrl, auth: true };
  throw new Error('Tautan unduh Zoom ditolak (' + code + '): ' + res.getContentText().slice(0, 300));
}

function bukaSesiDrive_(folderId, name, size, mime) {
  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id',
    {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      payload: JSON.stringify({ name: name, parents: [folderId], mimeType: mime }),
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(size)
      },
      muteHttpExceptions: true
    }
  );
  const url = headerOf_(res, 'Location');
  if (res.getResponseCode() !== 200 || !url) throw new Error('Sesi Drive gagal: ' + res.getContentText());
  return url;
}

/* ---------------------------- selesai ---------------------------- */

function selesaikanRekaman_(job) {
  let total = 0;
  job.files.forEach(function (f) {
    total += f.size;
    try {
      DriveApp.getFileById(f.driveId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      log_('SHARING', e);
    }
  });

  let link;
  if (job.files.length === 1) {
    link = DriveApp.getFileById(job.files[0].driveId).getUrl();
  } else {
    const folder = DriveApp.getFolderById(getSessionFolderId_(job.tanggal, 'Rekaman'));
    try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { log_('SHARING', e); }
    link = folder.getUrl();
  }

  const jam = Math.floor(job.durasiMenit / 60);
  const menit = job.durasiMenit % 60;
  const durasi = (jam ? jam + ' j ' : '') + menit + ' m';

  const sesi = getJadwal_().filter(function (s) { return s.tanggal === job.tanggal; })[0];
  if (sesi) {
    const sh = sheet_(SHEETS.JADWAL);
    sh.getRange(sesi._row, colIndex_('Jadwal', 'Link Rekaman')).setValue(link);
    sh.getRange(sesi._row, colIndex_('Jadwal', 'Durasi Rekaman')).setValue(durasi);
  } else {
    log_('REKAMAN', 'Tidak ada baris Jadwal untuk ' + job.tanggal + '; link tetap dicatat di sheet Rekaman.');
  }

  sheet_(SHEETS.REKAMAN).appendRow([job.tanggal, job.uuid, job.files.length, link, total, new Date(), 'SELESAI']);
  invalidateCache_();

  if (getSetting_('HAPUS_REKAMAN_DI_ZOOM', 'YA').toUpperCase() === 'YA') {
    try {
      zoomApi_('delete', '/meetings/' + encodeUuid_(job.uuid) + '/recordings?action=trash');
    } catch (e) {
      log_('REKAMAN', 'Gagal memindahkan rekaman Zoom ke Trash: ' + e);
    }
  }
}

function loadRecJob_() {
  const raw = props_().getProperty(REC_JOB_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveRecJob_(job) {
  const copy = JSON.parse(JSON.stringify(job));
  copy.files.forEach(function (f) { delete f._src; delete f._retry; });
  props_().setProperty(REC_JOB_KEY, JSON.stringify(copy));
}

/** Batalkan pekerjaan rekaman yang macet (jalankan manual bila perlu). */
function resetPekerjaanRekaman() {
  props_().deleteProperty(REC_JOB_KEY);
}
