<script setup>
defineProps({ tabs: Array, route: String })
defineEmits(['go'])
</script>

<template>
  <nav class="bottom-nav m-only" aria-label="Menu">
    <button
      v-for="t in tabs"
      :key="t.key"
      :aria-current="route === t.key ? 'page' : undefined"
      :style="route === t.key ? { background: 'var(--ink)', color: t.color } : { background: t.color }"
      @click="$emit('go', t.key)"
    >
      <span class="num">{{ t.num }}</span>
      <span class="lbl">{{ t.label }}</span>
    </button>
  </nav>
</template>
