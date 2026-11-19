<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { store, loadJadwal } from './lib/store'
import { initAuth } from './lib/auth'
import { DEMO } from './lib/api'
import TickerBar from './components/TickerBar.vue'
import AppHeader from './components/AppHeader.vue'
import BottomNav from './components/BottomNav.vue'
import JadwalView from './views/JadwalView.vue'
import AbsenView from './views/AbsenView.vue'
import MateriView from './views/MateriView.vue'

const tabs = [
  { key: 'jadwal', label: 'JADWAL', num: '01', color: 'var(--yellow)' },
  { key: 'absen', label: 'ABSEN', num: '02', color: 'var(--pink)' },
  { key: 'upload', label: 'UPLOAD', num: '03', color: 'var(--green)' }
]

const parse = () => {
  const h = location.hash.replace(/^#\/?/, '')
  return tabs.some((t) => t.key === h) ? h : 'jadwal'
}
const route = ref(parse())
const scroller = ref(null)

function onHash() {
  route.value = parse()
  scroller.value?.scrollTo(0, 0)
}
function go(key) {
  location.hash = '#/' + key
}

let timer
onMounted(() => {
  window.addEventListener('hashchange', onHash)
  initAuth()
  loadJadwal()
  timer = setInterval(loadJadwal, 5 * 60 * 1000) // segarkan tiap 5 menit
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHash)
  clearInterval(timer)
})
</script>

<template>
  <div class="app">
    <TickerBar />
    <AppHeader :tabs="tabs" :route="route" @go="go" />
    <div ref="scroller" class="scroll">
      <main class="main">
        <p v-if="DEMO" class="alert">MODE DEMO · data contoh. Isi VITE_API_URL untuk memakai data asli.</p>
        <p v-if="store.error" class="alert alert-err" role="alert">
          {{ store.error }}
          <button class="btn btn-sm" style="margin-left: 8px" @click="loadJadwal">COBA LAGI</button>
        </p>
        <p v-if="!store.data && store.loading" class="kicker">MEMUAT JADWAL…</p>
        <template v-if="store.data">
          <JadwalView v-if="route === 'jadwal'" @go="go" />
          <AbsenView v-else-if="route === 'absen'" @go="go" />
          <MateriView v-else @go="go" />
        </template>
      </main>
    </div>
    <BottomNav :tabs="tabs" :route="route" @go="go" />
  </div>
</template>
