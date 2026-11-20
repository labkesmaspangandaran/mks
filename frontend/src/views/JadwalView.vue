<script setup>
import { ref, computed, watch } from 'vue'
import { store, statusOf, TAGS, nextSesi } from '../lib/store'
import { addDays, BULAN, dm, fmtSize, monthYear, parts, shortDate, toYmd, weekday } from '../lib/date'

defineEmits(['go'])

const data = computed(() => store.data)
const today = computed(() => data.value.server.today)
const sesiList = computed(() => data.value.sesi)
const byDate = computed(() => Object.fromEntries(sesiList.value.map((s) => [s.tanggal, s])))

const defaultSel = () => (nextSesi(data.value) || sesiList.value[sesiList.value.length - 1] || {}).tanggal || ''
const sel = ref(defaultSel())
watch(sesiList, () => {
  if (!byDate.value[sel.value]) sel.value = defaultSel()
})

const initial = parts(sel.value || today.value)
const view = ref({ y: initial.y, m: initial.m })
const monthOpen = ref(false)

function shiftMonth(n) {
  let { y, m } = view.value
  m += n
  if (m < 1) { m = 12; y-- }
  if (m > 12) { m = 1; y++ }
  view.value = { y, m }
}

function pick(t) {
  sel.value = t
  const p = parts(t)
  view.value = { y: p.y, m: p.m }
}

const tagOf = (s) => TAGS[statusOf(s, today.value)]
const monthLabel = computed(() => `${BULAN[view.value.m - 1].slice(0, 3).toUpperCase()} ${view.value.y}`)

const monthSesi = computed(() =>
  sesiList.value.filter((s) => {
    const p = parts(s.tanggal)
    return p.y === view.value.y && p.m === view.value.m
  })
)

const cells = computed(() => {
  const { y, m } = view.value
  const first = toYmd(y, m, 1)
  const lead = (weekday(first) + 6) % 7 // minggu dimulai Senin
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const total = Math.ceil((lead + daysInMonth) / 7) * 7
  const start = addDays(first, -lead)
  return Array.from({ length: total }, (_, i) => {
    const t = addDays(start, i)
    const p = parts(t)
    return { t, d: p.d, out: p.m !== m, today: t === today.value, sesi: p.m === m ? byDate.value[t] : null }
  })
})

const detail = computed(() => byDate.value[sel.value] || null)
const detailStatus = computed(() => (detail.value ? statusOf(detail.value, today.value) : ''))

const uploadNote = computed(() => {
  const s = detail.value
  if (!s) return ''
  if (s.uploadOpen) return 'UPLOAD MATERI SUDAH DIBUKA'
  const prev = sesiList.value.filter((x) => x.tanggal < s.tanggal).pop()
  return prev ? `UPLOAD MATERI DIBUKA ${shortDate(addDays(prev.tanggal, 1))}` : 'UPLOAD MATERI BELUM DIBUKA'
})

const firstNames = (s) => s.pemateri.map((p) => p.nama.split(' ')[0]).join(' · ')
const zoomLink = computed(() => data.value.server.zoomLink)
</script>

<template>
  <div class="layout">
    <div class="col">
      <h1 class="display big-title" style="font-size: 44px">Jadwal<br />MKS</h1>

      <div class="shortcuts m-only">
        <button class="btn btn-pink" @click="$emit('go', 'absen')">
          <span class="kicker">02 →</span><span class="big">ABSEN</span>
        </button>
        <button class="btn btn-green" @click="$emit('go', 'upload')">
          <span class="kicker">03 →</span><span class="big">UPLOAD</span>
        </button>
      </div>

      <div class="m-only" style="display: flex; justify-content: space-between; align-items: center; gap: 10px">
        <span class="kicker">PILIH JUMAT ↓</span>
        <button class="btn btn-sm" :aria-expanded="monthOpen" @click="monthOpen = !monthOpen">
          {{ monthOpen ? 'TUTUP BULAN ✕' : 'LIHAT BULAN ▦' }}
        </button>
      </div>

      <div class="strip m-only" role="group" aria-label="Pilih Jumat">
        <button
          v-for="s in monthSesi"
          :key="s.tanggal"
          class="btn"
          :class="{ pressed: s.tanggal === sel }"
          :aria-pressed="s.tanggal === sel"
          :aria-label="`${shortDate(s.tanggal)}, ${tagOf(s).label}`"
          :style="s.tanggal === sel ? { background: 'var(--ink)', color: 'var(--yellow)' } : null"
          @click="pick(s.tanggal)"
        >
          <span style="font-size: 11px; font-weight: 700">JUM</span>
          <span class="day">{{ parts(s.tanggal).d }}</span>
          <span style="font-size: 10px; font-weight: 700">{{ monthYear(s.tanggal) }}</span>
          <span class="tag" style="font-size: 10px; padding: 1px 4px; color: var(--ink)" :style="{ background: tagOf(s).bg }">{{ tagOf(s).label }}</span>
        </button>
        <span v-if="!monthSesi.length" class="kicker">BELUM ADA JADWAL BULAN INI.</span>
      </div>

      <div class="card month" :class="{ collapsed: !monthOpen }">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px">
          <span class="display" style="font-size: 20px">{{ monthLabel }}</span>
          <div style="display: flex; gap: 6px">
            <button class="btn btn-sm" aria-label="Bulan sebelumnya" style="width: 44px; padding: 0" @click="shiftMonth(-1)">←</button>
            <button class="btn btn-sm" aria-label="Bulan berikutnya" style="width: 44px; padding: 0" @click="shiftMonth(1)">→</button>
          </div>
        </div>
        <div class="month-grid">
          <span v-for="w in ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN']" :key="w" class="wd">{{ w }}</span>
          <template v-for="c in cells" :key="c.t">
            <button
              v-if="c.sesi"
              class="cell"
              :aria-pressed="c.t === sel"
              :aria-label="shortDate(c.t)"
              :style="c.t === sel ? { background: 'var(--ink)', color: 'var(--yellow)' } : { background: tagOf(c.sesi).bg }"
              @click="pick(c.t)"
            >
              {{ c.d }}
            </button>
            <span v-else class="cell" :class="{ out: c.out, today: c.today }">{{ c.d }}</span>
          </template>
        </div>
        <div class="legend">
          <span><i style="background: var(--lilac)"></i>REKAMAN</span>
          <span><i style="background: var(--yellow)"></i>BESOK</span>
          <span><i style="background: var(--pink)"></i>HARI INI</span>
          <span><i style="background: #fff"></i>NANTI</span>
        </div>
      </div>

      <div class="d-only" style="flex-direction: column; gap: 10px">
        <span class="kicker" style="margin-top: 4px">SESI BULAN INI ↓</span>
        <button
          v-for="s in monthSesi"
          :key="s.tanggal"
          class="btn session-row"
          :class="{ pressed: s.tanggal === sel }"
          :aria-pressed="s.tanggal === sel"
          :style="{ background: s.tanggal === sel ? 'var(--cream)' : '#fff' }"
          @click="pick(s.tanggal)"
        >
          <span style="display: flex; flex-direction: column; align-items: center; width: 52px">
            <span class="day" style="width: auto">{{ parts(s.tanggal).d }}</span>
            <span style="font-size: 10px; font-weight: 700">{{ monthYear(s.tanggal) }}</span>
          </span>
          <span class="names">{{ firstNames(s) }}</span>
          <span class="tag" :style="{ background: tagOf(s).bg }">{{ tagOf(s).label }}</span>
        </button>
        <span v-if="!monthSesi.length" class="kicker">BELUM ADA JADWAL BULAN INI.</span>
      </div>
    </div>

    <section v-if="detail" class="card" aria-labelledby="det-title" style="display: flex; flex-direction: column; gap: 16px; min-width: 0">
      <div style="display: flex; flex-direction: column; gap: 6px">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px">
          <span class="kicker">{{ shortDate(detail.tanggal) }} · {{ data.server.jamMulai || '08:30' }} WIB · ZOOM</span>
          <span class="sticker" :style="{ background: tagOf(detail).bg }">{{ tagOf(detail).label }}</span>
        </div>
        <h2 id="det-title" class="detail-date">{{ dm(detail.tanggal) }}</h2>
      </div>

      <a v-if="detail.rekaman" class="btn btn-black" style="color: #fff; justify-content: space-between" :href="detail.rekaman.link" target="_blank" rel="noopener">
        <span>▶ TONTON REKAMAN</span><span style="color: var(--lilac)">{{ detail.rekaman.durasi }}</span>
      </a>

      <template v-else-if="detailStatus === 'hariini' || detailStatus === 'besok'">
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
          <a class="btn btn-black" :href="zoomLink || '#'" target="_blank" rel="noopener">ZOOM ↗</a>
          <button class="btn btn-pink" @click="$emit('go', 'absen')">ABSEN →</button>
        </div>
        <span class="small">Absen {{ data.server.absenBuka }}–{{ data.server.absenTutup }} WIB. Rapat direkam otomatis; rekaman muncul di sini setelah acara.</span>
      </template>

      <div v-else-if="detailStatus === 'selesai'" class="box" style="border-style: dashed; padding: 12px; font-weight: 700; background: var(--cream)">
        {{ detail.tanggal >= addDays(today, -3) ? 'REKAMAN SEDANG DIPROSES' : 'REKAMAN TIDAK TERSEDIA' }}
      </div>

      <div v-else class="box" style="border-style: dashed; padding: 12px; font-weight: 700; background: var(--cream)">{{ uploadNote }}</div>

      <div>
        <div v-for="p in detail.pemateri" :key="p.no" class="speaker">
          <span class="no">0{{ p.no }}</span>
          <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0">
            <span v-if="p.judul" style="display: flex; flex-direction: column; gap: 2px">
              <span style="font-size: 15px; font-weight: 700; line-height: 1.35">{{ p.judul }}</span>
              <span class="small">{{ p.nama }}</span>
            </span>
            <span v-else style="display: flex; flex-direction: column; gap: 2px">
              <span style="font-size: 15px; font-weight: 700; line-height: 1.35">{{ p.nama }}</span>
              <span class="small" style="color: var(--muted)">Judul materi belum diisi</span>
            </span>
            <div class="files">
              <a v-for="f in p.files" :key="f.id" class="file-chip" :href="f.link" target="_blank" rel="noopener">
                ↓ <span>{{ f.nama }}</span> <small style="font-weight: 400">{{ fmtSize(f.ukuran) }}</small>
              </a>
              <span v-if="!p.files.length" class="tag" :style="{ background: detailStatus === 'nanti' && !detail.uploadOpen ? '#fff' : 'var(--yellow)' }">
                {{ detailStatus === 'nanti' && !detail.uploadOpen ? 'UPLOAD BELUM DIBUKA' : 'BELUM UPLOAD' }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="detail.moderator" class="speaker" style="align-items: center">
          <span class="tag" style="background: var(--cream)">MODERATOR</span>
          <span style="font-size: 14px; font-weight: 700">{{ detail.moderator }}</span>
        </div>
      </div>
      <span class="small" style="border-top: var(--line); padding-top: 10px">Pemateri @ 45 menit. Jadwal, materi &amp; rekaman bisa dilihat tanpa login.</span>
    </section>

    <section v-else class="card">
      <span class="display" style="font-size: 26px">BELUM ADA JADWAL.</span>
      <p class="small">Admin dapat menambahkan jadwal di Google Sheet (sheet "Jadwal").</p>
    </section>
  </div>
</template>
