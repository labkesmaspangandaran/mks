import { addDays, todayJakarta, weekday } from './date'

const API_URL = (import.meta.env.VITE_API_URL || '').trim()
export const DEMO = !API_URL

export class ApiError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

async function readJson(res) {
  let json
  try {
    json = await res.json()
  } catch {
    throw new ApiError('Server tidak merespons dengan benar. Coba lagi.', 502)
  }
  if (!json.ok) throw new ApiError(json.error || 'Terjadi kesalahan.', json.code)
  return json.data
}

export async function getJadwal() {
  if (DEMO) return demoJadwal()
  const res = await fetch(`${API_URL}?action=jadwal`, { redirect: 'follow' })
  return readJson(res)
}

/** POST memakai text/plain agar tidak memicu preflight CORS ke Apps Script. */
export async function post(action, body = {}) {
  if (DEMO) throw new ApiError('Mode demo: backend belum diatur (VITE_API_URL kosong).', 503)
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body })
    })
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server. Periksa koneksi internet.', 0)
  }
  return readJson(res)
}

/* ------------------------- data contoh (demo) ------------------------- */

function demoJadwal() {
  const today = todayJakarta()
  const back = (weekday(today) - 5 + 7) % 7
  const lastFri = addDays(today, -back)
  const fri = (k) => addDays(lastFri, 7 * k)
  const P = (no, nama, judul, files = []) => ({ no, nama, judul, files })
  const F = (nama, ukuran) => ({ id: nama, nama, ukuran, link: '#' })
  const MB = 1024 * 1024
  // Jika hari ini Jumat: dua sesi lalu = -2,-1; jika bukan: Jumat lalu (0) dan sebelumnya (-1).
  const p1 = back === 0 ? -2 : -1
  const p2 = back === 0 ? -1 : 0
  const sesi = [
    { tanggal: fri(p1), rekaman: { link: '#', durasi: '1 j 36 m' }, pemateri: [P(1, 'Yusuf Hakim', 'Keamanan Akun dan Kata Sandi', [F('Keamanan-Akun.pptx', 18 * MB)]), P(2, 'Maya Sari', 'Menulis Nota Dinas yang Efektif', [F('Nota-Dinas.pdf', 4 * MB)]), P(3, 'Teguh Santoso', 'Manajemen Waktu untuk Tim', [F('Manajemen-Waktu.pptx', 62 * MB)])] },
    { tanggal: fri(p2), rekaman: { link: '#', durasi: '1 j 42 m' }, pemateri: [P(1, 'Ahmad Fauzi', 'Etika Komunikasi di Grup Kerja', [F('Etika-Komunikasi.pptx', 24 * MB)]), P(2, 'Sri Wahyuni', 'Pengelolaan Arsip Digital', [F('Arsip-Digital.pptx', 96 * MB), F('Klasifikasi.xlsx', MB)]), P(3, 'Hendra Gunawan', 'Dasar Analisis Data dengan Pivot', [F('Pivot-Table.pptx', 31 * MB)])] },
    { tanggal: fri(back === 0 ? 0 : 1), rekaman: null, pemateri: [P(1, 'Rina Andriani', 'Manajemen Risiko pada Pengadaan Barang/Jasa', [F('Risiko-Pengadaan.pptx', 48 * MB), F('Daftar-Risiko.xlsx', 2 * MB)]), P(2, 'Bagus Prasetyo', 'Menyusun Laporan Kinerja yang Ringkas', [F('Laporan-Kinerja.pptx', 27 * MB)]), P(3, 'Dewi Lestari', 'Google Sheets untuk Monitoring Anggaran')] },
    { tanggal: fri(back === 0 ? 1 : 2), rekaman: null, pemateri: [P(1, 'Fitri Handayani', 'Pelayanan Prima kepada Pemangku Kepentingan'), P(2, 'Rudi Hartono', 'Penyusunan SOP Sederhana'), P(3, 'Lina Marlina', 'Presentasi yang Menarik dengan Data')] }
  ]
  const upcoming = sesi.find((s) => s.tanggal >= today)
  return {
    server: { today, now: '09:14', jamMulai: '08:30', absenBuka: '09:00', absenTutup: '14:00', zoomLink: '#' },
    sesi: sesi.map((s, i) => ({
      ...s,
      moderator: ['Andi Saputra', 'Lina Marlina', 'Yusuf Hakim', 'Maya Sari'][i],
      uploadOpen: s.tanggal < today || s === upcoming
    }))
  }
}
