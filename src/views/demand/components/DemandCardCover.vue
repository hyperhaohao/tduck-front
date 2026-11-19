<template>
  <div class="demand-card-cover" aria-hidden="true">
    <div class="demand-card-cover-pattern">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="25" width="70" height="8" rx="2" fill="currentColor" fill-opacity="0.08" />
        <rect x="15" y="45" width="50" height="8" rx="2" fill="currentColor" fill-opacity="0.06" />
        <rect x="15" y="65" width="60" height="8" rx="2" fill="currentColor" fill-opacity="0.04" />
        <circle cx="75" cy="49" r="4" fill="currentColor" fill-opacity="0.1" />
        <circle cx="75" cy="69" r="4" fill="currentColor" fill-opacity="0.1" />
      </svg>
    </div>
    <span v-if="label" class="demand-card-type">{{ label }}</span>
  </div>
</template>

<script>
export default {
  name: 'DemandCardCover',
  props: {
    label: { type: String, default: '' }
  }
}
</script>
