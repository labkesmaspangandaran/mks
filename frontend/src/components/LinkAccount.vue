<script setup>
import { ref, computed } from 'vue'
import { auth, authed, logout } from '../lib/auth'

const q = ref('')
const pick = ref(null)
const busy = ref(false)
const err = ref('')

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  const all = auth.me?.pilihan || []
  return s ? all.filter((p) => p.nama.toLowerCase().includes(s) || p.jabatan.toLowerCase().includes(s)) : all
})

async function simpan() {
  if (!pick.value) return
  busy.value = true
  err.value = ''
  try {
    auth.me = await authed('hubungkan', { key: pick.value.key })
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="card" style="display: flex; flex-direction: column; gap: 12px">
    <span class="display" style="font-size: 26px; line-height: 1">SIAPA ANDA?</span>
    <span class="small" style="font-size: 13px">
      Masuk sebagai <strong>{{ auth.me.email }}</strong>. Pilih nama Anda sekali saja; berikutnya akun ini langsung dikenali.
    </span>

    <label for="cari-nama" class="kicker">CARI NAMA</label>
    <input
      id="cari-nama"
      v-model="q"
      type="search"
      autocomplete="off"
      placeholder="ketik nama…"
      style="min-height: 48px; border: var(--line); padding: 0 12px; font-family: inherit; font-size: 15px; background: var(--bg)"
    />

    <div role="radiogroup" aria-label="Pilih nama" style="max-height: 300px; overflow-y: auto; border: var(--line); background: #fff">
      <button
        v-for="p in list"
        :key="p.key"
        role="radio"
        :aria-checked="pick?.key === p.key"
        style="width: 100%; min-height: 54px; border: none; border-bottom: 2px solid var(--ink); text-align: left; padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px"
        :style="{ background: pick?.key === p.key ? 'var(--ink)' : '#fff', color: pick?.key === p.key ? 'var(--yellow)' : 'var(--ink)' }"
        @click="pick = p"
      >
        <span style="font-weight: 700; font-size: 14px">{{ p.nama }}</span>
        <span style="font-size: 11px">{{ p.jabatan }}</span>
      </button>
      <p v-if="!list.length" class="small" style="padding: 12px; margin: 0">
        Nama tidak ada di daftar. Mungkin sudah terhubung ke akun lain; hubungi admin MKS.
      </p>
    </div>

    <button class="btn btn-yellow" :disabled="!pick || busy" @click="simpan">
      {{ busy ? 'MENYIMPAN…' : pick ? `INI SAYA: ${pick.nama.toUpperCase()} →` : 'PILIH NAMA DULU' }}
    </button>
    <p v-if="err" class="alert alert-err" role="alert" style="margin: 0">{{ err }}</p>
    <span class="small">Hanya sekali dan tidak bisa diubah sendiri. Salah pilih? Minta admin mereset. ·
      <button style="border: none; background: none; padding: 0; text-decoration: underline; cursor: pointer; font-size: 12px" @click="logout">ganti akun Google</button>
    </span>
  </div>
</template>
