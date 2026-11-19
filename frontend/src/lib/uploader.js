import { authed } from './auth'

const MODE_KEY = 'mks_upload_mode'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function preferredMode() {
  try {
    return localStorage.getItem(MODE_KEY) || 'direct'
  } catch {
    return 'direct'
  }
}

function rememberProxy() {
  try {
    localStorage.setItem(MODE_KEY, 'proxy')
  } catch { /* abaikan */ }
}

async function start(file, tanggal) {
  return authed('uploadStart', {
    tanggal,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size
  })
}

/**
 * Upload satu file ke Google Drive lewat sesi resumable.
 * Mode "direct": potongan dikirim langsung dari browser ke Drive (cepat).
 * Mode "proxy" : potongan dikirim lewat Apps Script (cadangan bila browser diblokir CORS).
 */
export async function uploadFile(file, tanggal, onProgress = () => {}) {
  let session = await start(file, tanggal)
  let mode = preferredMode()
  let offset = 0
  onProgress(0)

  while (offset < file.size) {
    const end = Math.min(offset + session.chunkSize, file.size)
    const blob = file.slice(offset, end)

    if (mode === 'direct') {
      let res
      try {
        res = await fetch(session.sessionUrl, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${file.size}` },
          body: blob
        })
      } catch (e) {
        if (offset === 0) {
          // Browser menolak (biasanya CORS). Pindah ke mode cadangan dengan sesi baru.
          mode = 'proxy'
          rememberProxy()
          session = await start(file, tanggal)
          continue
        }
        throw new Error('Koneksi terputus saat mengunggah. Coba lagi.')
      }
      if (res.status === 308) {
        const range = res.headers.get('Range')
        offset = range ? Number(range.split('-')[1]) + 1 : end
        onProgress(offset / file.size)
        continue
      }
      if (res.ok) {
        const meta = await res.json()
        const saved = await authed('uploadFinish', { uploadId: session.uploadId, fileId: meta.id })
        onProgress(1)
        return saved
      }
      throw new Error(`Google Drive menolak upload (HTTP ${res.status}).`)
    }

    const data = await blobToBase64(blob)
    const r = await authed('uploadChunk', { uploadId: session.uploadId, offset, data })
    if (r.done) {
      onProgress(1)
      return r.file
    }
    offset = r.next
    onProgress(offset / file.size)
  }
  throw new Error('Upload berhenti sebelum selesai.')
}
