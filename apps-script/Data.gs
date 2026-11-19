/**
 * MKS — membaca data dari sheet dan API publik jadwal.
 */

function getPegawai_() {
  const byNip = {};
  const byEmail = {};
  readTable_(SHEETS.PEGAWAI).forEach(function (r) {
    const nip = String(r['NIP'] || '').trim();
    if (!nip) return;
    if (String(r['Aktif'] || 'YA').trim().toUpperCase() === 'TIDAK') return;
    const p = {
      _row: r._row,
      nip: nip,
      nama: String(r['Nama'] || '').trim(),
      jabatan: String(r['Jabatan'] || '').trim(),
      email: String(r['Email Google'] || '').trim().toLowerCase()
    };
    byNip[nip] = p;
    if (p.email) byEmail[p.email] = p;
  });
  return { byNip: byNip, byEmail: byEmail };
}

function findPegawaiByEmail_(email) {
  return getPegawai_().byEmail[String(email).toLowerCase()] || null;
}

/** Semua sesi, urut tanggal naik. */
function getJadwal_() {
  const peg = getPegawai_().byNip;
  return readTable_(SHEETS.JADWAL)
    .map(function (r) {
      const tanggal = cellDate_(r['Tanggal']);
      const pemateri = [];
      for (let i = 1; i <= 3; i++) {
        const nip = String(r['NIP Pemateri ' + i] || '').trim();
        const judul = String(r['Judul ' + i] || '').trim();
        if (!nip && !judul) continue;
        pemateri.push({ no: i, nip: nip, nama: (peg[nip] && peg[nip].nama) || nip || '-', judul: judul });
      }
      const nipMod = String(r['NIP Moderator'] || '').trim();
      return {
        _row: r._row,
        tanggal: tanggal,
        pemateri: pemateri,
        moderator: nipMod ? ((peg[nipMod] && peg[nipMod].nama) || nipMod) : '',
        linkRekaman: String(r['Link Rekaman'] || '').trim(),
        durasi: String(r['Durasi Rekaman'] || '').trim()
      };
    })
    .filter(function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s.tanggal); })
    .sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0; });
}

function getMateriAktif_() {
  return readTable_(SHEETS.MATERI)
    .filter(function (r) { return String(r['Status'] || '').toUpperCase() !== 'DIHAPUS'; })
    .map(function (r) {
      return {
        _row: r._row,
        tanggal: cellDate_(r['Tanggal']),
        nip: String(r['NIP'] || '').trim(),
        nama: String(r['Nama File'] || ''),
        ukuran: Number(r['Ukuran (byte)']) || 0,
        id: String(r['File ID'] || ''),
        link: String(r['Link'] || ''),
        waktu: r['Waktu Upload'] instanceof Date ? r['Waktu Upload'].toISOString() : ''
      };
    });
}

/**
 * Upload materi dibuka untuk:
 *  - sesi terdekat yang belum lewat (dibuka sejak sehari setelah sesi sebelumnya), dan
 *  - sesi yang sudah lewat (untuk revisi).
 */
function isUploadOpen_(tanggal, sesiList, today) {
  if (tanggal < today) return true;
  const upcoming = sesiList.filter(function (s) { return s.tanggal >= today; })[0];
  return !!upcoming && upcoming.tanggal === tanggal;
}

/* --------------------------- API publik --------------------------- */

function apiJadwal_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('jadwal_v1');
  if (hit) {
    const cached = JSON.parse(hit);
    cached.server.today = today_();
    cached.server.now = nowHM_();
    return cached;
  }

  const today = today_();
  const sesi = getJadwal_();
  const materi = getMateriAktif_();

  const data = {
    server: {
      today: today,
      now: nowHM_(),
      jamMulai: getSetting_('JAM_MULAI', '08:30'),
      absenBuka: getSetting_('ABSEN_BUKA', '09:00'),
      absenTutup: getSetting_('ABSEN_TUTUP', '14:00'),
      zoomLink: getSetting_('ZOOM_LINK', '')
    },
    sesi: sesi.map(function (s) {
      return {
        tanggal: s.tanggal,
        uploadOpen: isUploadOpen_(s.tanggal, sesi, today),
        rekaman: s.linkRekaman ? { link: s.linkRekaman, durasi: s.durasi } : null,
        moderator: s.moderator,
        // NIP tidak dikirim ke publik; hanya nama, judul, dan file.
        pemateri: s.pemateri.map(function (p) {
          return {
            no: p.no,
            nama: p.nama,
            judul: p.judul,
            files: materi
              .filter(function (m) { return m.tanggal === s.tanggal && m.nip === p.nip; })
              .map(function (m) { return { id: m.id, nama: m.nama, ukuran: m.ukuran, link: m.link }; })
          };
        })
      };
    })
  };

  cache.put('jadwal_v1', JSON.stringify(data), 60);
  return data;
}

/* ------------------------ API pengguna login ------------------------ */

function apiMe_(body) {
  const user = verifyIdToken_(body.idToken);
  const peg = findPegawaiByEmail_(user.email);
  if (!peg) return belumTerhubung_(user);
  return profil_(peg);
}

function profil_(peg) {
  const today = today_();
  const sesi = getJadwal_();
  const pemateriDi = sesi
    .filter(function (s) {
      return s.pemateri.some(function (p) { return p.nip === peg.nip; }) && isUploadOpen_(s.tanggal, sesi, today);
    })
    .map(function (s) { return s.tanggal; });
  const myFiles = getMateriAktif_()
    .filter(function (m) { return m.nip === peg.nip; })
    .map(function (m) { return { id: m.id, tanggal: m.tanggal, nama: m.nama, ukuran: m.ukuran, link: m.link, waktu: m.waktu }; });

  return {
    terhubung: true,
    nama: peg.nama,
    jabatan: peg.jabatan,
    email: peg.email,
    pemateriDi: pemateriDi,
    files: myFiles,
    absenHariIni: findAbsen_(today, peg.nip)
  };
}
