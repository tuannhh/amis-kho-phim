<script setup lang="ts">
import MEmptyState from '@/components/mds/MEmptyState.vue'
import MTag from '@/components/mds/MTag.vue'

/**
 * Placeholder GĐ 0 — khung trang chuẩn MDS (page header 56px + vùng nội dung nền xám).
 * GĐ 0.5 sẽ thay phần nội dung bằng UI mock thật của từng màn hình.
 */
defineProps<{
  title: string
  description?: string
  phase?: string
}>()
</script>

<template>
  <section class="flex h-full flex-col">
    <!-- Page header 56px -->
    <header
      class="flex h-14 shrink-0 items-center gap-3 bg-white px-5"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <h1 class="text-[16px] font-semibold" style="color: var(--mds-text-primary)">
        {{ title }}
      </h1>
      <MTag v-if="phase" color="info" size="sm">{{ phase }}</MTag>
    </header>

    <!-- Nội dung -->
    <div class="flex-1 overflow-auto p-4">
      <div
        class="flex min-h-[420px] items-center justify-center rounded-lg bg-white"
        style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
      >
        <MEmptyState
          type="initial"
          :title="title"
          :description="description || 'Màn hình sẽ được dựng đầy đủ ở GĐ 0.5 (UI mock).'"
        />
      </div>
    </div>
  </section>
</template>
