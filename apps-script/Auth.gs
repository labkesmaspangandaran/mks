/**
 * MKS — verifikasi login Google.
 *
 * Frontend memakai Google Identity Services dan mengirim ID token (JWT).
 * Di sini token dicek ke endpoint resmi Google: harus untuk Client ID kita,
 * email sudah terverifikasi, dan belum kedaluwarsa. Hasilnya di-cache sebentar.
 */

function verifyIdToken_(idToken) {
  if (!idToken) throw userError_('Silakan masuk dengan Google terlebih dahulu.', 401);

  const cache = CacheService.getScriptCache();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken);
  const key = 'tok_' + Utilities.base64EncodeWebSafe(digest).slice(0, 43);
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) {
    throw userError_('Sesi login sudah habis. Silakan masuk lagi.', 401);
  }
  const info = JSON.parse(res.getContentText());
  const clientId = secret_('GOOGLE_CLIENT_ID', true);
  const issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  const verified = info.email_verified === true || info.email_verified === 'true';
  const exp = Number(info.exp) * 1000;

  if (info.aud !== clientId || !issuerOk) throw userError_('Login tidak valid untuk aplikasi ini.', 401);
  if (!verified || !info.email) throw userError_('Email akun Google belum terverifikasi.', 401);
  if (!exp || exp < Date.now()) throw userError_('Sesi login sudah habis. Silakan masuk lagi.', 401);

  const user = { email: String(info.email).toLowerCase(), name: info.name || '' };
  const ttl = Math.min(600, Math.floor((exp - Date.now()) / 1000));
  if (ttl > 30) cache.put(key, JSON.stringify(user), ttl);
  return user;
}

/** Login + cocokkan dengan sheet Pegawai (kolom Email Google terisi saat pertama masuk). */
function currentPegawai_(idToken) {
  const user = verifyIdToken_(idToken);
  const peg = findPegawaiByEmail_(user.email);
  if (!peg) {
    throw userError_('Akun ' + user.email + ' belum terhubung ke nama pegawai. Pilih nama Anda terlebih dahulu.', 403);
  }
  return peg;
}
