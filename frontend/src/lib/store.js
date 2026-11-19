import { reactive } from 'vue'
import { getJadwal } from './api'
import { addDays } from './date'

export const store = reactive({
  data: null,
  loading: false,
  error: ''
})

export async function loadJadwal() {
  store.loading = true
  try {
    store.data = await getJadwal()
    store.error = ''
  } catch (e) {
    store.error = e.message || 'Gagal memuat jadwal.'
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
