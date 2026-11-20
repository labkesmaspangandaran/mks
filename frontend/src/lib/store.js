import { reactive } from 'vue'
import { getJadwal, DEMO } from './api'
import { addDays, todayJakarta } from './date'

const CACHE_KEY = 'mks_jadwal_cache_v1'

/** Data terakhir disimpan di perangkat, jadi web langsung tampil sambil data baru dimuat. */
function readCache() {
  if (DEMO) return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    data.server.today = todayJakarta() // status sesi dihitung ulang untuk hari ini
    return data
  } catch {
    return null
  }
}

export const store = reactive({
  data: readCache(),
  loading: false,
  error: ''
})

export async function loadJadwal() {
  store.loading = true
  try {
    const fresh = await getJadwal()
    store.data = fresh
    store.error = ''
    try {
      if (!DEMO) localStorage.setItem(CACHE_KEY, JSON.stringify(fresh))
    } catch { /* penyimpanan penuh/diblokir */ }
  } catch (e) {
    // Jika masih ada data tersimpan, tetap tampilkan dan beri tahu dengan halus.
    store.error = store.data ? 'Tidak bisa memperbarui data. Yang tampil adalah data terakhir.' : e.message || 'Gagal memuat jadwal.'
  } finally {
    store.loading = false
  }
}

export const TAGS = {
  rekaman: { label: 'REKAMAN', bg: 'var(--lilac)' },
  selesai: { label: 'SELESAI', bg: '#ffffff' },
  hariini: { label: 'HARI INI', bg: 'var(--pink)' },
  besok: { label: 'BESOK', bg: 'var(--yellow)' },
  nanti: { label: 'NANTI', bg: '#ffffff' }
}

export function statusOf(sesi, today) {
  if (sesi.tanggal < today) return sesi.rekaman ? 'rekaman' : 'selesai'
  if (sesi.tanggal === today) return 'hariini'
  if (sesi.tanggal === addDays(today, 1)) return 'besok'
  return 'nanti'
}

/** Sesi terdekat yang belum lewat (termasuk hari ini). */
export function nextSesi(data) {
  if (!data) return null
  return data.sesi.find((s) => s.tanggal >= data.server.today) || null
}
