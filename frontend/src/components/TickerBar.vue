<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { store, nextSesi, statusOf } from '../lib/store'
import { shortDate } from '../lib/date'

// Kecepatan teks berjalan dalam piksel per detik. Naikkan untuk lebih cepat, turunkan untuk lebih lambat.
const SPEED = 38

const text = computed(() => {
  const data = store.data
  const s = nextSesi(data)
  if (!s) return '★ MKS · MANAGEMENT KNOWLEDGE SHARING ★ SETIAP JUMAT VIA ZOOM ★'
  const st = statusOf(s, data.server.today)
  const label = st === 'hariini' ? 'HARI INI' : st === 'besok' ? 'BESOK' : 'BERIKUTNYA'
  const siap = s.pemateri.filter((p) => p.files.length).length
  return `★ ${label} · ${shortDate(s.tanggal)} · ${data.server.jamMulai || '08:30'} WIB ★ ABSEN ${data.server.absenBuka}–${data.server.absenTutup} WIB ★ MATERI ${siap}/${s.pemateri.length} SIAP ★ MKS ★`
})

// Durasi dihitung dari lebar teks agar kecepatannya sama di HP maupun desktop.
const first = ref(null)
const duration = ref(40)
function measure() {
  const w = first.value?.offsetWidth || 0
  if (w) duration.value = Math.max(10, w / SPEED)
}
watch(text, () => nextTick(measure))
onMounted(() => {
  measure()
  document.fonts?.ready?.then(measure)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
</script>

<template>
  <div class="ticker" aria-hidden="true">
    <div class="ticker-track" :style="{ animationDuration: duration + 's' }">
      <span ref="first">{{ text }}</span><span>{{ text }}</span><span>{{ text }}</span><span>{{ text }}</span>
    </div>
  </div>
</template>
