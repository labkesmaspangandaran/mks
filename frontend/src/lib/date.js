export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const BLN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export const pad = (n) => String(n).padStart(2, '0')

export function parts(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d }
}

export function toYmd(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function addDays(ymd, n) {
  const { y, m, d } = parts(ymd)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function weekday(ymd) {
  const { y, m, d } = parts(ymd)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** 20.11 */
export function dm(ymd) {
  const { m, d } = parts(ymd)
  return `${pad(d)}.${pad(m)}`
}

/** Jumat, 20 November 2026 */
export function longDate(ymd) {
  const { y, m, d } = parts(ymd)
  return `${HARI[weekday(ymd)]}, ${d} ${BULAN[m - 1]} ${y}`
}

/** JUM 20 NOV */
export function shortDate(ymd) {
  const { m, d } = parts(ymd)
  return `${HARI[weekday(ymd)].slice(0, 3).toUpperCase()} ${d} ${BLN[m - 1]}`
}

/** Tanggal hari ini menurut zona waktu Jakarta, format yyyy-MM-dd. */
export function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export function nowJakartaHM() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

export function fmtSize(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}
