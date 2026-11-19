/**
 * MKS — upload materi tanpa batas ukuran.
 *
 * Alur:
 * 1. uploadStart  : cek login + benar pemateri sesi itu + upload dibuka,
 *                   lalu buka sesi "resumable upload" Google Drive di folder sesi.
 * 2a. Mode langsung: browser mengirim potongan file langsung ke URL sesi Drive,
 *                   lalu memanggil uploadFinish dengan ID file.
 * 2b. Mode cadangan: jika browser tidak bisa mengirim langsung (CORS), potongan file
 *                   (base64) dikirim ke uploadChunk dan diteruskan Apps Script ke Drive.
 * 3. Selesai      : file dibagikan "siapa saja yang punya link: lihat", dicatat di sheet Materi.
 */

const UPLOAD_CHUNK = 8 * 1024 * 1024; // kelipatan 256 KB, sesuai aturan Drive

function apiUploadStart_(body) {
  const peg = currentPegawai_(body.idToken);
  const tanggal = String(body.tanggal || '');
  const size = Number(body.size);
  const mime = String(body.mimeType || 'application/octet-stream').slice(0, 200);
  const name = cleanFileName_(body.fileName);

  if (!name) throw userError_('Nama file kosong.', 400);
  if (!size || size < 1) throw userError_('File kosong.', 400);

  const today = today_();
  const sesiList = getJadwal_();
  const sesi = sesiList.filter(function (s) { return s.tanggal === tanggal; })[0];
  if (!sesi) throw userError_('Sesi tidak ditemukan.', 404);
  if (!sesi.pemateri.some(function (p) { return p.nip === peg.nip; })) {
    throw userError_('Anda tidak terjadwal sebagai pemateri pada sesi ini.', 403);
  }
  if (!isUploadOpen_(tanggal, sesiList, today)) {
    throw userError_('Upload untuk sesi ini belum dibuka.', 403);
  }

  const folderId = getSessionFolderId_(tanggal, 'Materi');
  const headers = {
    Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    'X-Upload-Content-Type': mime,
    'X-Upload-Content-Length': String(size)
  };
  const origin = getSetting_('FRONTEND_ORIGIN', '');
  if (origin) headers.Origin = origin; // agar browser boleh mengirim langsung ke Drive

  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,parents',
    {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      payload: JSON.stringify({ name: name, parents: [folderId], mimeType: mime, description: 'MKS ' + tanggal + ' · ' + peg.nama }),
      headers: headers,
      muteHttpExceptions: true
    }
  );
  const sessionUrl = headerOf_(res, 'Location');
  if (res.getResponseCode() !== 200 || !sessionUrl) {
    log_('UPLOAD', 'Gagal membuka sesi: ' + res.getResponseCode() + ' ' + res.getContentText());
    throw userError_('Gagal menyiapkan upload. Coba lagi.', 500);
  }

  const uploadId = Utilities.getUuid();
  const job = { url: sessionUrl, nip: peg.nip, nama: peg.nama, tanggal: tanggal, folderId: folderId, fileName: name, size: size, mime: mime };
  CacheService.getScriptCache().put('up_' + uploadId, JSON.stringify(job), 21600);

  return { uploadId: uploadId, sessionUrl: sessionUrl, chunkSize: UPLOAD_CHUNK };
}

/** Mode cadangan: terima potongan base64 dan teruskan ke Drive. */
function apiUploadChunk_(body) {
  const peg = currentPegawai_(body.idToken);
  const job = loadUploadJob_(body.uploadId, peg);
  const offset = Number(body.offset);
  const bytes = Utilities.base64Decode(String(body.data || ''));
  if (!bytes.length) throw userError_('Potongan file kosong.', 400);
  const end = offset + bytes.length - 1;

  const res = UrlFetchApp.fetch(job.url, {
    method: 'put',
    contentType: 'application/octet-stream',
    payload: bytes,
    headers: { 'Content-Range': 'bytes ' + offset + '-' + end + '/' + job.size },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 308) {
    const range = headerOf_(res, 'Range'); // contoh: bytes=0-8388607
    const next = range ? Number(range.split('-')[1]) + 1 : end + 1;
    return { done: false, next: next };
  }
  if (code === 200 || code === 201) {
    const file = JSON.parse(res.getContentText());
    return { done: true, file: finalizeMateri_(job, file.id, body.uploadId) };
  }
  log_('UPLOAD', 'Chunk gagal ' + code + ' ' + res.getContentText().slice(0, 500));
  throw userError_('Upload terputus. Coba unggah ulang file ini.', 500);
}

/** Mode langsung: browser sudah selesai mengirim ke Drive, tinggal dicatat. */
function apiUploadFinish_(body) {
  const peg = currentPegawai_(body.idToken);
  const job = loadUploadJob_(body.uploadId, peg);
  const fileId = String(body.fileId || '');
  if (!fileId) throw userError_('ID file tidak ada.', 400);

  const file = DriveApp.getFileById(fileId);
  const parents = file.getParents();
  let inFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === job.folderId) inFolder = true;
  }
  if (!inFolder || file.getName() !== job.fileName) throw userError_('File tidak cocok dengan sesi upload.', 400);

  return finalizeMateri_(job, fileId, body.uploadId);
}

function apiHapusMateri_(body) {
  const peg = currentPegawai_(body.idToken);
  const fileId = String(body.fileId || '');
  const row = getMateriAktif_().filter(function (m) { return m.id === fileId; })[0];
  if (!row) throw userError_('File tidak ditemukan.', 404);
  if (row.nip !== peg.nip) throw userError_('Anda hanya bisa menghapus file milik sendiri.', 403);

  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    log_('HAPUS', e);
  }
  sheet_(SHEETS.MATERI).getRange(row._row, colIndex_('Materi', 'Status')).setValue('DIHAPUS');
  invalidateCache_();
  return { id: fileId };
}

/* ----------------------------- helper ----------------------------- */

function loadUploadJob_(uploadId, peg) {
  const raw = CacheService.getScriptCache().get('up_' + String(uploadId || ''));
  if (!raw) throw userError_('Sesi upload kedaluwarsa. Silakan unggah ulang.', 410);
  const job = JSON.parse(raw);
  if (job.nip !== peg.nip) throw userError_('Sesi upload bukan milik Anda.', 403);
  return job;
}

function finalizeMateri_(job, fileId, uploadId) {
  const file = DriveApp.getFileById(fileId);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    log_('SHARING', 'Tidak bisa membagikan file ' + fileId + ': ' + e);
  }
  const link = file.getUrl();
  sheet_(SHEETS.MATERI).appendRow([job.tanggal, job.nip, job.nama, job.fileName, job.size, fileId, link, new Date(), 'AKTIF']);
  CacheService.getScriptCache().remove('up_' + uploadId);
  invalidateCache_();
  return { id: fileId, nama: job.fileName, ukuran: job.size, link: link, tanggal: job.tanggal };
}

function cleanFileName_(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 180);
}

/** Folder: DRIVE_FOLDER_ID / yyyy-MM-dd / (Materi|Rekaman). ID disimpan agar tidak dicari ulang. */
function getSessionFolderId_(tanggal, jenis) {
  const key = 'folder_' + tanggal + '_' + jenis;
  const known = props_().getProperty(key);
  if (known) {
    try {
      if (!DriveApp.getFolderById(known).isTrashed()) return known;
    } catch (e) { /* folder dihapus; buat ulang */ }
  }
  const rootId = getSetting_('DRIVE_FOLDER_ID', '');
  if (!rootId) throw new Error('DRIVE_FOLDER_ID di sheet Pengaturan belum diisi.');
  const root = DriveApp.getFolderById(rootId);
  const day = getOrCreateFolder_(root, tanggal);
  const sub = getOrCreateFolder_(day, jenis);
  props_().setProperty(key, sub.getId());
  return sub.getId();
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
