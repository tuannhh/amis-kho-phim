<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MMobileTopBar from '@/components/mds/MMobileTopBar.vue'
import FilmForm from './FilmForm.vue'
import { useFilmsStore } from '@/features/films/filmsStore'

const route = useRoute()
const router = useRouter()
const store = useFilmsStore()
const editingSlug = computed(() => (route.query.edit as string) || '')
const isEditMode = computed(() => !!editingSlug.value && store.films.some((film) => film.slug === editingSlug.value))

function goBack() {
  router.push({ name: 'films' })
}
</script>

<template>
  <section class="mds-mobile-app flex h-full min-h-0 flex-col overflow-hidden bg-[var(--mds-bg-page)]">
    <MMobileTopBar :title="isEditMode ? 'Sửa phim' : 'Thêm phim'" :show-more="false" @back="goBack" />
    <div class="min-h-0 flex-1">
      <FilmForm :editing-slug="editingSlug" mobile />
    </div>
  </section>
</template>
