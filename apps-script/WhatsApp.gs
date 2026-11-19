/**
 * MKS — pengumuman ke grup WhatsApp setiap Kamis 09.00 (OPSIONAL).
 *
 * Nonaktif secara bawaan (Pengaturan WA_AKTIF = TIDAK). Memakai gateway tidak resmi
 * (contoh: Fonnte) karena API resmi WhatsApp tidak bisa mengirim ke grup yang sudah ada.
 * Script Property: FONNTE_TOKEN. Pengaturan: WA_GROUP_ID.
 * Teks pengumuman bisa diganti nanti di fungsi teksPengumuman_().
 */

function kirimPengumumanWA() {
  if (getSetting_('WA_AKTIF', 'TIDAK').toUpperCase() !== 'YA') return;

  const besok = addDays_(today_(), 1);
  const sesi = getJadwal_().filter(function (s) { return s.tanggal === besok; })[0];
  if (!sesi) return;

  const target = getSetting_('WA_GROUP_ID', '');
  const token = secret_('FONNTE_TOKEN', true);
  if (!target) throw new Error('WA_GROUP_ID belum diisi.');

  const res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
    method: 'post',
    headers: { Authorization: token },
    payload: { target: target, message: teksPengumuman_(sesi) },
    muteHttpExceptions: true
  });
  log_('WA', res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
}

function teksPengumuman_(sesi) {
  const materi = getMateriAktif_().filter(function (m) { return m.tanggal === sesi.tanggal; });
  const tgl = Utilities.formatDate(new Date(sesi.tanggal + 'T12:00:00+07:00'), TZ, 'd MMMM yyyy');
  const baris = sesi.pemateri.map(function (p) {
    const ada = materi.some(function (m) { return m.nip === p.nip; });
    return p.no + '. ' + p.nama + ' — ' + p.judul + (ada ? '' : ' (materi belum diunggah)');
  });
  return [
    '*MKS besok, Jumat ' + tgl + ' pukul ' + getSetting_('JAM_MULAI', '08:30') + ' WIB*',
    '',
    baris.join('\n'),
    sesi.moderator ? 'Moderator: ' + sesi.moderator : '',
    '',
    'Zoom: ' + getSetting_('ZOOM_LINK', '-'),
    'Absen ' + getSetting_('ABSEN_BUKA', '09:00') + '–' + getSetting_('ABSEN_TUTUP', '14:00') + ' WIB: ' + getSetting_('URL_WEB', '-') + '#/absen'
  ].join('\n');
}
