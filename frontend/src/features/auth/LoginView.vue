<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { useAuthStore } from './authStore'

/**
 * Màn đăng nhập (pre-auth) — full-page, thẻ giữa nền xám theo MDS.
 * Sau đăng nhập: nếu buộc đổi mật khẩu → /change-password, ngược lại về trang đích.
 */
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  if (!email.value.trim()) { error.value = 'Vui lòng nhập email'; return }
  if (!password.value) { error.value = 'Vui lòng nhập mật khẩu'; return }

  submitting.value = true
  try {
    const user = await auth.login(email.value.trim(), password.value)
    if (user.mustChangePassword) {
      router.replace({ name: 'change-password' })
      return
    }
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Đăng nhập không thành công'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- min-h-dvh (không phải h-full/100vh): thanh địa chỉ trình duyệt di động làm 100vh sai
       chiều cao — mobile-pwa.md §6. -->
  <div
    class="flex min-h-dvh items-center justify-center p-4"
    style="
      background: var(--mds-bg-canvas, #ecedef);
      padding-top: max(16px, env(safe-area-inset-top));
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    "
  >
    <div
      class="w-full max-w-[400px] rounded-lg bg-white p-8"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <!-- Thương hiệu -->
      <div class="mb-6 flex flex-col items-center gap-2 text-center">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-lg"
          style="background: var(--mds-brand-600, #245FDF); color: #fff"
        >
          <MIcon name="layout-grid" :size="28" />
        </div>
        <h1 class="text-[18px] font-semibold" style="color: var(--mds-text-primary)">AMIS Kho phim</h1>
        <p class="text-[13px]" style="color: var(--mds-text-secondary)">Đăng nhập để tiếp tục</p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Email
          </label>
          <!-- inputmode/autocapitalize/enterkeyhint theo mobile-pwa.md §5: bàn phím email,
               không tự viết hoa chữ đầu, phím Enter hiện "Tiếp". Từ GĐ8 các thuộc tính này
               mới thực sự tới được thẻ <input> (xem MInput: inheritAttrs=false). -->
          <MInput
            v-model="email"
            type="email"
            placeholder="ten@misa.com.vn"
            autocomplete="username"
            inputmode="email"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
          >
            <template #prefix><MIcon name="mail" :size="16" /></template>
          </MInput>
        </div>

        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Mật khẩu
          </label>
          <MInput
            v-model="password"
            type="password"
            placeholder="Nhập mật khẩu"
            autocomplete="current-password"
            enterkeyhint="go"
          >
            <template #prefix><MIcon name="lock" :size="16" /></template>
          </MInput>
        </div>

        <p v-if="error" class="text-[13px]" style="color: var(--mds-danger, #F04438)">{{ error }}</p>

        <!-- KHÔNG gắn thêm @click: nút đã là type="submit" trong form có @submit.prevent, gắn
             cả hai làm submit() chạy HAI LẦN (hai request đăng nhập cho một cú bấm). -->
        <MButton type="submit" variant="primary" class="w-full" :loading="submitting">
          Đăng nhập
        </MButton>
      </form>
    </div>
  </div>
</template>
