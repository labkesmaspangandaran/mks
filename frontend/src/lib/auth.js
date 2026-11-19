import { reactive } from 'vue'
import { post, DEMO } from './api'

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
const KEY = 'mks_id_token'

export const auth = reactive({
  idToken: '',
  email: '',
  name: '',
  me: null, // data dari server: nama, pemateriDi, files, absenHariIni
  meError: '',
  loadingMe: false
})

export const loginAvailable = !!CLIENT_ID && !DEMO

function decodeJwt(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

function setToken(token) {
  let payload
  try {
    payload = decodeJwt(token)
  } catch {
    return logout()
  }
  if (!payload.exp || payload.exp * 1000 < Date.now() + 60_000) return logout()
  auth.idToken = token
  auth.email = payload.email || ''
  auth.name = payload.name || ''
  try {
    localStorage.setItem(KEY, token)
  } catch { /* penyimpanan diblokir; tetap jalan selama tab terbuka */ }
  refreshMe()
}

export function initAuth() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) setToken(saved)
  } catch { /* abaikan */ }
}

export function logout() {
  auth.idToken = ''
  auth.email = ''
  auth.name = ''
  auth.me = null
  auth.meError = ''
  try {
    localStorage.removeItem(KEY)
  } catch { /* abaikan */ }
  try {
    window.google?.accounts?.id?.disableAutoSelect()
  } catch { /* abaikan */ }
}

/** Panggil API yang butuh login; jika token habis, keluar otomatis. */
export async function authed(action, body = {}) {
  try {
    return await post(action, { ...body, idToken: auth.idToken })
  } catch (e) {
    if (e.code === 401) logout()
    throw e
  }
}

export async function refreshMe() {
  if (!auth.idToken) return
  auth.loadingMe = true
  try {
    auth.me = await authed('me')
    auth.meError = ''
  } catch (e) {
    auth.me = null
    auth.meError = e.message
  } finally {
    auth.loadingMe = false
  }
}

let initialized = false

function waitForGis(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (window.google?.accounts?.id) return resolve(window.google.accounts.id)
      if (Date.now() - started > timeout) return reject(new Error('Layanan login Google tidak termuat.'))
      setTimeout(tick, 100)
    }
    tick()
  })
}

export async function renderGoogleButton(el) {
  const gis = await waitForGis()
  if (!initialized) {
    gis.initialize({
      client_id: CLIENT_ID,
      callback: (resp) => setToken(resp.credential),
      auto_select: true,
      use_fedcm_for_prompt: true
    })
    initialized = true
  }
  gis.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    locale: 'id',
    width: Math.min(320, el.clientWidth || 300)
  })
}
