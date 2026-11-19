<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { store, nextSesi, loadJadwal } from '../lib/store'
import { auth, authed, logout, refreshMe } from '../lib/auth'
import { dm, fmtSize, shortDate } from '../lib/date'
import { uploadFile } from '../lib/uploader'
import GoogleLogin from '../components/GoogleLogin.vue'
import LinkAccount from '../components/LinkAccount.vue'

defineEmits(['go'])

onMounted(() => {
  if (auth.idToken && !auth.me && !auth.loadingMe) refreshMe()
})

const berikut = computed(() => nextSesi(store.data))
const pilihan = computed(() => [...(auth.me?.pemateriDi || [])].sort())

const selT = ref('')
watch(
  pilihan,
  (list) => {
    if (list.includes(selT.value)) return
    selT.value = berikut.value && list.includes(berikut.value.tanggal) ? berikut.value.tanggal : list[list.length - 1] || ''
  },
  { immediate: true }
)

const sesiDipilih = computed(() => store.data.sesi.find((s) => s.tanggal === selT.value) || null)
const judulSaya = computed(() => {
  const p = sesiDipilih.value?.pemateri.find((x) => x.nama === auth.me?.nama)
  return p?.judul || ''
})
const fileSaya = computed(() => (auth.me?.files || []).filter((f) => f.tanggal === selT.value))

/* ------------------------------ upload ------------------------------ */
const queue = ref([])
const over = ref(false)
const inputEl = ref(null)
const uploading = computed(() => queue.value.some((q) => q.state === 'up'))

async function handleFiles(list) {
  const files = Array.from(list || [])
  if (!files.length || !selT.value) return
  for (const file of files) {
    queue.value.push({ key: `${file.name}-${Date.now()}`, name: file.name, size: file.size, progress: 0, state: 'up', error: '' })
    const item = queue.value[queue.value.length - 1]
    try {
      await uploadFile(file, selT.value, (p) => (item.progress = p))
      item.state = 'ok'
    } catch (e) {
      item.state = 'err'
      item.error = e.message
    }
  }
  if (inputEl.value) inputEl.value.value = ''
  await refreshMe()
  loadJadwal()
  queue.value = queue.value.filter((q) => q.state !== 'ok')
}

function onDrop(e) {
  over.value = false
  handleFiles(e.dataTransfer?.files)
}

/* ------------------------------ hapus ------------------------------ */
const confirmId = ref('')
const hapusErr = ref('')
async function hapus(id) {
  if (confirmId.value !== id) {
    confirmId.value = id
    return
  }
  hapusErr.value = ''
  try {
    await authed('hapusMateri', { fileId: id })
    confirmId.value = ''
    await refreshMe()
    loadJadwal()
  } catch (e) {
    hapusErr.value = e.message
  }
}
</script>

<template>
  <div class="narrow narrow-wide">
    <h1 class="page-title" style="background: var(--green)">UPLOAD</h1>
    <div style="display: flex; flex-wrap: wrap; gap: 8px">
      <span class="tag" style="background: #fff">FORMAT &amp; UKURAN BEBAS</span>
      <span class="tag" style="background: #fff">REVISI TETAP BISA SETELAH ACARA</span>
    </div>

    <GoogleLogin v-if="!auth.idToken" title="KHUSUS PEMATERI." text="Masuk dulu. Sistem mengecek apakah nama Anda ada di jadwal sesi ini." />

    <p v-else-if="auth.loadingMe && !auth.me" class="kicker">MEMERIKSA AKUN…</p>

    <div v-else-if="auth.meError" class="alert alert-err" role="alert">
      {{ auth.meError }}
      <div style="margin-top: 10px"><button class="btn btn-sm" @click="logout">GANTI AKUN</button></div>
    </div>

    <LinkAccount v-else-if="auth.me && !auth.me.terhubung" />

    <div v-else-if="auth.me && !pilihan.length" class="box" style="background: var(--yellow); padding: 16px; display: flex; flex-direction: column; gap: 6px">
      <span class="display" style="font-size: 24px; line-height: 1">BUKAN PEMATERI ✕</span>
      <span class="small" style="font-size: 13px">Masuk sebagai {{ auth.me.nama }}. Upload hanya untuk pemateri sesi terdekat, atau sesi yang sudah lewat untuk revisi.</span>
    </div>

    <template v-else-if="auth.me">
      <div v-if="pilihan.length > 1" role="group" aria-label="Pilih sesi" style="display: flex; flex-wrap: wrap; gap: 10px">
        <button
          v-for="t in pilihan"
          :key="t"
          class="btn btn-sm"
          :class="{ pressed: t === selT }"
          :aria-pressed="t === selT"
          :style="t === selT ? { background: 'var(--ink)', color: 'var(--green)' } : null"
          @click="selT = t"
        >
          {{ dm(t) }}
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 2px">
        <span class="kicker">MATERI ANDA · {{ shortDate(selT) }}</span>
        <span v-if="judulSaya" style="font-size: 15px; font-weight: 700">{{ judulSaya }}</span>
      </div>

      <div v-for="f in fileSaya" :key="f.id" class="box" style="padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px">
        <a :href="f.link" target="_blank" rel="noopener" style="display: flex; flex-direction: column; gap: 2px; min-width: 0; text-decoration: none">
          <span style="font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ f.nama }}</span>
          <span class="small">{{ fmtSize(f.ukuran) }} · DI DRIVE ↗</span>
        </a>
        <button class="btn btn-sm" :style="confirmId === f.id ? { background: 'var(--pink)' } : null" :aria-label="`Hapus ${f.nama}`" @click="hapus(f.id)">
          {{ confirmId === f.id ? 'HAPUS?' : '✕' }}
        </button>
      </div>
      <p v-if="hapusErr" class="alert alert-err" role="alert">{{ hapusErr }}</p>

      <div v-for="q in queue" :key="q.key" class="box" style="padding: 10px 12px; display: flex; flex-direction: column; gap: 8px">
        <span style="font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ q.name }}</span>
        <span class="small">
          {{ q.state === 'err' ? 'GAGAL · ' + q.error : 'MENGUNGGAH ' + Math.round(q.progress * 100) + '% · ' + fmtSize(q.size) }}
        </span>
        <span
          v-if="q.state === 'up'"
          class="progress"
          role="progressbar"
          aria-label="Progres upload"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(q.progress * 100)"
        ><span :style="{ width: q.progress * 100 + '%' }"></span></span>
      </div>

      <label
        class="dropzone"
        :class="{ over }"
        @dragover.prevent="over = true"
        @dragleave="over = false"
        @drop.prevent="onDrop"
      >
        <input ref="inputEl" class="visually-hidden" type="file" multiple :disabled="uploading" @change="handleFiles($event.target.files)" />
        <span class="big">{{ uploading ? 'SEDANG MENGUNGGAH…' : '+ LEMPAR FILE KE SINI' }}</span>
        <span class="small">atau ketuk untuk memilih file · langsung tersimpan di Google Drive</span>
      </label>
    </template>

    <template v-if="berikut">
      <span class="kicker" style="margin-top: 8px">STATUS PEMATERI · {{ shortDate(berikut.tanggal) }}</span>
      <div class="box">
        <div v-for="p in berikut.pemateri" :key="p.no" class="status-row">
          <span style="font-size: 13px; font-weight: 700">{{ p.nama.toUpperCase() }}</span>
          <span class="tag" :style="{ background: p.files.length ? 'var(--green)' : 'var(--yellow)' }">
            {{ p.files.length ? `SUDAH · ${p.files.length}` : 'BELUM' }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
