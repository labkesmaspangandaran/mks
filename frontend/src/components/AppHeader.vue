<script setup>
import { computed } from 'vue'
import { auth, logout } from '../lib/auth'

const props = defineProps({ tabs: Array, route: String })
defineEmits(['go'])

const initials = computed(() =>
  (auth.me?.nama || auth.name || auth.email || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
)
const showAccount = computed(() => !!auth.idToken && props.route !== 'jadwal')
</script>

<template>
  <header class="header">
    <div class="header-in">
      <a class="logo" href="#/jadwal">
        <span class="logo-mark">MKS</span>
        <span class="logo-text">KNOWLEDGE<br />SHARING</span>
      </a>
      <nav class="d-only" aria-label="Menu utama" style="gap: 10px">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="btn btn-sm"
          :class="{ pressed: route === t.key }"
          :aria-current="route === t.key ? 'page' : undefined"
          :style="route === t.key ? { background: 'var(--ink)', color: t.color } : { background: t.color }"
          @click="$emit('go', t.key)"
        >
          {{ t.num }} {{ t.label }}
        </button>
      </nav>
      <button v-if="showAccount" class="btn btn-sm" :aria-label="`Keluar dari akun ${auth.email}`" @click="logout">
        {{ initials }} · KELUAR
      </button>
    </div>
  </header>
</template>
