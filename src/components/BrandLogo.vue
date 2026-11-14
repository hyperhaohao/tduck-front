<template>
  <span class="ruima-brand" :aria-label="$brand.name">
    <img :src="$brand.logo" alt="瑞玛公司标志" />
    <span v-if="!compact" class="ruima-brand-name">{{ $brand.name }}</span>
  </span>
</template>
<script>
export default { name: 'BrandLogo', props: { compact: Boolean } }
</script>
<style scoped>
.ruima-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  vertical-align: middle;
  color: inherit;
}
.ruima-brand img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}
.ruima-brand-name {
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}
@media (max-width: 767px) {
  .ruima-brand {
    gap: 6px;
  }
  .ruima-brand img {
    width: 28px;
    height: 28px;
  }
  .ruima-brand-name {
    font-size: 15px;
  }
}
</style>
