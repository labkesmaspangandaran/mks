/**
 * MKS — menghubungkan akun Google ke nama pegawai saat pertama kali masuk.
 *
 * Alur: pegawai login → email belum ada di sheet Pegawai → pilih nama sendiri dari
 * daftar nama yang BELUM terhubung → email tersimpan otomatis di kolom "Email Google".
 * Berikutnya email itu langsung dikenali.
 *
 * Pengaman:
 *  - satu email hanya untuk satu nama, dan satu nama hanya untuk satu email;
 *  - nama yang sudah terhubung tidak muncul lagi di daftar dan tidak bisa diambil alih;
 *  - setiap penautan dicatat di sheet Log (jenis TAUTAN);
 *  - NIP tidak pernah dikirim ke browser (yang dikirim kode acak dari NIP).
 * Reset oleh admin: kosongkan sel "Email Google" pegawai tersebut.
 */

function kunciPegawai_(nip) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'mks:' + nip);
  return Utilities.base64EncodeWebSafe(digest).slice(0, 16);
}

function belumTerhubung_(user) {
  const byNip = getPegawai_().byNip;
  const pilihan = Object.keys(byNip)
    .map(function (nip) { return byNip[nip]; })
    .filter(function (p) { return !p.email; })
    .map(function (p) { return { key: kunciPegawai_(p.nip), nama: p.nama, jabatan: p.jabatan }; })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });
  return { terhubung: false, email: user.email, namaGoogle: user.name, pilihan: pilihan };
}

function apiHubungkan_(body) {
  const user = verifyIdToken_(body.idToken);
  const key = String(body.key || '');
  if (!key) throw userError_('Pilih nama Anda terlebih dahulu.', 400);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = getPegawai_();
    if (data.byEmail[user.email]) {
      return profil_(data.byEmail[user.email]); // sudah terhubung (mis. klik dua kali)
    }
    let target = null;
    Object.keys(data.byNip).forEach(function (nip) {
      if (kunciPegawai_(nip) === key) target = data.byNip[nip];
    });
    if (!target) throw userError_('Nama tidak ditemukan. Muat ulang halaman.', 404);
    if (target.email) {
      throw userError_('Nama ini sudah terhubung ke akun lain. Jika ini nama Anda, hubungi admin MKS.', 409);
    }

    sheet_(SHEETS.PEGAWAI).getRange(target._row, colIndex_('Pegawai', 'Email Google')).setValue(user.email);
    log_('TAUTAN', user.email + ' → ' + target.nama + ' (' + target.nip + ')');
    target.email = user.email;
    return profil_(target);
  } finally {
    lock.releaseLock();
  }
}
