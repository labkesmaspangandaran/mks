<script setup>
import { computed } from 'vue'
import { store, nextSesi, statusOf } from '../lib/store'
import { shortDate } from '../lib/date'

const text = computed(() => {
  const data = store.data
  const s = nextSesi(data)
  if (!s) return '★ MKS · MANAGEMENT KNOWLEDGE SHARING ★ SETIAP JUMAT VIA ZOOM ★'
  const st = statusOf(s, data.server.today)
  const label = st === 'hariini' ? 'HARI INI' : st === 'besok' ? 'BESOK' : 'BERIKUTNYA'
  const siap = s.pemateri.filter((p) => p.files.length).length
  return `★ ${label} · ${shortDate(s.tanggal)} · ${data.server.jamMulai || '08:30'} WIB ★ ABSEN ${data.server.absenBuka}–${data.server.absenTutup} WIB ★ MATERI ${siap}/${s.pemateri.length} SIAP ★ MKS ★`
})
</script>

<template>
  <div class="ticker" aria-hidden="true">
    <span class="ticker-track">{{ text }}&nbsp;&nbsp;&nbsp;{{ text }}</span>
  </div>
</template>
