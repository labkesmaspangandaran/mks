<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { store, nextSesi } from '../lib/store'
import { auth, authed, logout, refreshMe } from '../lib/auth'
import { longDate, nowJakartaHM, shortDate } from '../lib/date'
import GoogleLogin from '../components/GoogleLogin.vue'
import LinkAccount from '../components/LinkAccount.vue'

defineEmits(['go'])

const server = computed(() => store.data.server)
const sesiHariIni = computed(() => store.data.sesi.find((s) => s.tanggal === server.value.today) || null)
const berikut = computed(() => nextSesi(store.data))

const now = ref(nowJakartaHM())
let timer
onMounted(() => {
  timer = setInterval(() => (now.value = nowJakartaHM()), 10_000)
  // Selalu cek ulang status absen ke server (di latar) setiap halaman ini dibuka.
  if (auth.idToken && !auth.loadingMe) refreshMe()
})
onBeforeUnmount(() => clearInterval(timer))

const belumBuka = computed(() => now.value < server.value.absenBuka)
const sudahTutup = computed(() => now.value > server.value.absenTutup)

const result = ref(null)
const busy = ref(false)
const err = ref('')
const sudah = computed(() => result.value || auth.me?.absenHariIni || null)

async function hadir() {
  busy.value = true
  err.value = ''
  try {
    result.value = await authed('absen')
    // Simpan juga di data profil bersama, agar tetap "TERCATAT" saat pindah halaman lalu kembali.
    if (auth.me) auth.me.absenHariIni = { waktu: result.value.waktu }
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="narrow">
    <h1 class="page-title" style="background: var(--pink)">ABSEN</h1>
    <span class="kicker">
      <template v-if="sesiHariIni">HARI INI · {{ shortDate(sesiHariIni.tanggal) }} · {{ server.absenBuka }}–{{ server.absenTutup }} WIB</template>
      <template v-else-if="berikut">BERIKUTNYA · {{ shortDate(berikut.tanggal) }} · {{ server.absenBuka }}–{{ server.absenTutup }} WIB</template>
      <template v-else>BELUM ADA JADWAL</template>
    </span>

    <GoogleLogin
      v-if="!auth.idToken"
      title="MASUK DULU."
      text="Pakai akun Google pribadi. Pertama kali masuk, pilih nama Anda; setelah itu akun terkunci ke nama Anda, jadi tidak bisa titip absen."
    />

    <p v-else-if="auth.loadingMe && !auth.me" class="kicker">MEMERIKSA AKUN…</p>

    <div v-else-if="auth.meError" class="alert alert-err" role="alert">
      {{ auth.meError }}
      <div style="margin-top: 10px"><button class="btn btn-sm" @click="logout">GANTI AKUN</button></div>
    </div>

    <LinkAccount v-else-if="auth.me && !auth.me.terhubung" />

    <template v-else-if="auth.me">
      <template v-if="sudah">
        <div class="stamp">TERCATAT ✓</div>
        <span class="kicker" style="align-self: center">{{ auth.me.nama.toUpperCase() }} · {{ sudah.waktu }} WIB</span>
        <button class="btn" @click="$emit('go', 'jadwal')">← KE JADWAL</button>
      </template>

      <div v-else-if="!sesiHariIni" class="card" style="display: flex; flex-direction: column; gap: 10px">
        <span class="display" style="font-size: 26px; line-height: 1">HARI INI TIDAK ADA MKS.</span>
        <span v-if="berikut" class="small" style="font-size: 13px">Sesi berikutnya {{ longDate(berikut.tanggal) }}. Absen dibuka {{ server.absenBuka }}–{{ server.absenTutup }} WIB.</span>
      </div>

      <template v-else>
        <span class="kicker">HALO, {{ auth.me.nama.toUpperCase() }}</span>
        <span class="clock" aria-label="Jam sekarang">{{ now.replace('.', ':') }}</span>
        <button v-if="!belumBuka && !sudahTutup" class="btn btn-pink" style="min-height: 80px; font-family: var(--display); font-size: 30px; box-shadow: 8px 8px 0 #000" :disabled="busy" @click="hadir">
          {{ busy ? 'MENCATAT…' : 'SAYA HADIR ✓' }}
        </button>
        <button v-else class="btn" style="min-height: 72px" disabled>
          {{ belumBuka ? `DIBUKA PUKUL ${server.absenBuka} WIB` : 'ABSEN SUDAH DITUTUP' }}
        </button>
        <p v-if="err" class="alert alert-err" role="alert">{{ err }}</p>
      </template>
    </template>
  </div>
</template>
