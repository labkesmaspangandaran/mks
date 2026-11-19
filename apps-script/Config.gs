/**
 * MKS — konfigurasi dan utilitas umum.
 *
 * Pengaturan biasa (link Zoom, jam absen, ID folder Drive, dll.) ada di sheet "Pengaturan".
 * Rahasia (Client ID Google, kredensial Zoom, token WhatsApp) disimpan di
 * Project Settings > Script Properties, BUKAN di sheet.
 */

const TZ = 'Asia/Jakarta';

const SHEETS = {
  PENGATURAN: 'Pengaturan',
  PEGAWAI: 'Pegawai',
  JADWAL: 'Jadwal',
  KEHADIRAN: 'Kehadiran',
  MATERI: 'Materi',
  REKAMAN: 'Rekaman',
  LOG: 'Log'
};

const HEADERS = {
  Pengaturan: ['Kunci', 'Nilai', 'Keterangan'],
  // Kolom NIP juga dipakai untuk ID non-ASN (mis. OS-01 untuk outsourcing).
  Pegawai: ['NIP', 'Nama', 'Jabatan', 'Email Google', 'Aktif'],
  Jadwal: ['Tanggal', 'NIP Pemateri 1', 'Judul 1', 'NIP Pemateri 2', 'Judul 2', 'NIP Pemateri 3', 'Judul 3', 'NIP Moderator', 'Link Rekaman', 'Durasi Rekaman'],
  Kehadiran: ['Tanggal', 'NIP', 'Nama', 'Email', 'Waktu Absen'],
  Materi: ['Tanggal', 'NIP', 'Nama', 'Nama File', 'Ukuran (byte)', 'File ID', 'Link', 'Waktu Upload', 'Status'],
  Rekaman: ['Tanggal', 'Meeting UUID', 'Jumlah File', 'Link', 'Ukuran (byte)', 'Waktu Selesai', 'Status'],
  Log: ['Waktu', 'Jenis', 'Pesan']
};

/** Nilai awal sheet Pengaturan: [kunci, nilai, keterangan]. */
const DEFAULT_SETTINGS = [
  ['ZOOM_LINK', '', 'Link Zoom MKS (satu link untuk tiap minggu)'],
  ['ZOOM_MEETING_ID', '', 'Meeting ID Zoom, angka saja tanpa spasi'],
  ['ZOOM_HOST_EMAIL', '', 'Email akun Zoom host yang merekam'],
  ['HAPUS_REKAMAN_DI_ZOOM', 'YA', 'YA = rekaman dipindah ke Trash Zoom setelah tersalin ke Drive'],
  ['JAM_MULAI', '08:30', 'Jam mulai acara (HH:mm), ditampilkan di web'],
  ['ABSEN_BUKA', '09:00', 'Jam absen dibuka (HH:mm)'],
  ['ABSEN_TUTUP', '14:00', 'Jam absen ditutup (HH:mm)'],
  ['DRIVE_FOLDER_ID', '', 'ID folder Drive induk untuk materi & rekaman'],
  ['FRONTEND_ORIGIN', '', 'Alamat web, mis. https://namaanda.github.io (tanpa garis miring di akhir)'],
  ['URL_WEB', '', 'Alamat lengkap web, dipakai di pengumuman WA'],
  ['WA_AKTIF', 'TIDAK', 'YA = kirim pengumuman ke grup WA tiap Kamis 09.00'],
  ['WA_GROUP_ID', '', 'ID grup WhatsApp dari layanan gateway (mis. Fonnte)']
];

/* ------------------------------------------------------------------ */

function props_() {
  return PropertiesService.getScriptProperties();
}

function ss_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const id = props_().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Script tidak terhubung ke spreadsheet. Isi Script Property SPREADSHEET_ID.');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" tidak ditemukan. Jalankan menu MKS > Setup.');
  return sh;
}

let SETTINGS_MEMO_ = null;

function getSetting_(key, fallback) {
  if (!SETTINGS_MEMO_) {
    SETTINGS_MEMO_ = {};
    const values = sheet_(SHEETS.PENGATURAN).getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const k = String(values[i][0] || '').trim();
      let v = values[i][1];
      if (v instanceof Date) v = Utilities.formatDate(v, TZ, 'HH:mm');
      if (k) SETTINGS_MEMO_[k] = String(v === null || v === undefined ? '' : v).trim();
    }
  }
  const val = SETTINGS_MEMO_[key];
  return val === undefined || val === '' ? (fallback === undefined ? '' : fallback) : val;
}

function secret_(key, required) {
  const v = props_().getProperty(key);
  if (!v && required) throw new Error('Script Property "' + key + '" belum diisi.');
  return v || '';
}

/* ---------------------------- tanggal ---------------------------- */

function fmtDate_(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function today_() {
  return fmtDate_(new Date());
}

function nowHM_() {
  return Utilities.formatDate(new Date(), TZ, 'HH:mm');
}

/** Ubah isi sel tanggal (Date atau teks) menjadi 'yyyy-MM-dd'. */
function cellDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return fmtDate_(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); // dd/mm/yyyy
  if (m) return m[3] + '-' + pad2_(m[2]) + '-' + pad2_(m[1]);
  return s;
}

function addDays_(ymd, n) {
  const p = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n, 12));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function pad2_(n) {
  return ('0' + n).slice(-2);
}

/* ----------------------------- sheet ----------------------------- */

/** Baca sheet menjadi array objek, kunci = judul kolom. Menyertakan _row (nomor baris, 1-based). */
function readTable_(name) {
  const values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  const head = values[0].map(function (h) { return String(h).trim(); });
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    const obj = { _row: i + 1 };
    head.forEach(function (h, j) { obj[h] = row[j]; });
    out.push(obj);
  }
  return out;
}

function colIndex_(name, header) {
  const idx = HEADERS[name].indexOf(header);
  if (idx < 0) throw new Error('Kolom ' + header + ' tidak ada di ' + name);
  return idx + 1;
}

/* ------------------------------ log ------------------------------ */

function log_(jenis, pesan) {
  try {
    sheet_(SHEETS.LOG).appendRow([new Date(), jenis, String(pesan).slice(0, 2000)]);
  } catch (e) {
    console.error(jenis, pesan);
  }
}

/* --------------------------- kesalahan --------------------------- */

/** Kesalahan yang pesannya aman ditampilkan ke pengguna. */
function userError_(message, code) {
  const e = new Error(message);
  e.userMessage = message;
  e.code = code || 400;
  return e;
}

function headerOf_(response, name) {
  const all = response.getAllHeaders();
  const want = name.toLowerCase();
  for (const k in all) {
    if (k.toLowerCase() === want) {
      const v = all[k];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return '';
}

function invalidateCache_() {
  CacheService.getScriptCache().remove('jadwal_v1');
}
