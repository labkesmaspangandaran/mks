/**
 * MKS — absen.
 * Syarat: login Google + email terdaftar, hari ini ada jadwal MKS,
 * jam sekarang di antara ABSEN_BUKA dan ABSEN_TUTUP, dan belum absen.
 */

function findAbsen_(tanggal, nip) {
  const rows = readTable_(SHEETS.KEHADIRAN);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (cellDate_(r['Tanggal']) === tanggal && String(r['NIP']).trim() === nip) {
      const w = r['Waktu Absen'];
      return { waktu: w instanceof Date ? Utilities.formatDate(w, TZ, 'HH:mm') : String(w) };
    }
  }
  return null;
}

function apiAbsen_(body) {
  const peg = currentPegawai_(body.idToken);
  const today = today_();

  const sesi = getJadwal_().filter(function (s) { return s.tanggal === today; })[0];
  if (!sesi) throw userError_('Hari ini tidak ada jadwal MKS.', 400);

  const buka = getSetting_('ABSEN_BUKA', '09:00');
  const tutup = getSetting_('ABSEN_TUTUP', '14:00');
  const now = nowHM_();
  if (now < buka || now > tutup) {
    throw userError_('Absen hanya dibuka pukul ' + buka + '–' + tutup + ' WIB.', 400);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sudah = findAbsen_(today, peg.nip);
    if (sudah) return { nama: peg.nama, waktu: sudah.waktu, sudahSebelumnya: true };

    const sh = sheet_(SHEETS.KEHADIRAN);
    const waktu = new Date();
    sh.appendRow([today, peg.nip, peg.nama, peg.email, waktu]);
    return { nama: peg.nama, waktu: Utilities.formatDate(waktu, TZ, 'HH:mm'), sudahSebelumnya: false };
  } finally {
    lock.releaseLock();
  }
}
