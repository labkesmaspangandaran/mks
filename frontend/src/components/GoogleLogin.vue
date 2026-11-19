<script setup>
import { ref, onMounted } from 'vue'
import { renderGoogleButton, loginAvailable } from '../lib/auth'

defineProps({ title: String, text: String })
const el = ref(null)
const failed = ref('')

onMounted(async () => {
  if (!loginAvailable) return
  try {
    await renderGoogleButton(el.value)
  } catch (e) {
    failed.value = e.message
  }
})
</script>

<template>
  <div class="card" style="display: flex; flex-direction: column; gap: 14px">
    <span class="display" style="font-size: 28px; line-height: 1">{{ title }}</span>
    <span class="small" style="font-size: 13px">{{ text }}</span>
    <div v-if="loginAvailable" ref="el" class="gbtn"></div>
    <p v-if="!loginAvailable" class="tag" style="background: var(--yellow); white-space: normal">
      Login belum aktif: isi VITE_API_URL dan VITE_GOOGLE_CLIENT_ID.
    </p>
    <p v-if="failed" class="small" role="alert">{{ failed }} Muat ulang halaman.</p>
  </div>
</template>
