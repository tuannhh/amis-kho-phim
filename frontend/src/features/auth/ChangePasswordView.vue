<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import MButton from '@/components/mds/MButton.vue'
import MInput from '@/components/mds/MInput.vue'
import MIcon from '@/components/mds/MIcon.vue'
import { useAuthStore } from './authStore'
import { apiFetch } from '@/lib/http'
import { useToast } from '@/components/mds/toast.js'

/**
 * Đổi mật khẩu — dùng cho luồng buộc đổi lần đầu (tài khoản do admin tạo) và
 * đổi mật khẩu chủ động. Sau khi đổi: refresh user (mustChangePassword=false) → về trang chủ.
 */
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const current = ref('')
const next = ref('')
const confirm = ref('')
const error = ref('')
const submitting = ref(false)

const forced = auth.user?.mustChangePassword === true

async function submit() {
  error.value = ''
  if (!current.value) { error.value = 'Vui lòng nhập mật khẩu hiện tại'; return }
  if (next.value.length < 8) { error.value = 'Mật khẩu mới tối thiểu 8 ký tự'; return }
  if (next.value !== confirm.value) { error.value = 'Xác nhận mật khẩu không khớp'; return }

  submitting.value = true
  try {
    await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current.value, newPassword: next.value }),
    })
    await auth.refresh() // cập nhật mustChangePassword=false
    toast.success('Đã đổi mật khẩu thành công')
    router.replace('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Đổi mật khẩu không thành công'
  } finally {
    submitting.value = false
  }
}

function backToLogin() {
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div
    class="flex h-full items-center justify-center p-4"
    style="background: var(--mds-bg-canvas, #ECEDEF)"
  >
    <div
      class="w-full max-w-[400px] rounded-lg bg-white p-8"
      style="box-shadow: var(--mds-shadow-card, 0 0 2px 0 rgba(0,0,0,0.1))"
    >
      <div class="mb-6 flex flex-col items-center gap-2 text-center">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-lg"
          style="background: var(--mds-brand-600, #245FDF); color: #fff"
        >
          <MIcon name="lock" :size="26" />
        </div>
        <h1 class="text-[18px] font-semibold" style="color: var(--mds-text-primary)">Đổi mật khẩu</h1>
        <p class="text-[13px]" style="color: var(--mds-text-secondary)">
          {{ forced ? 'Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng.' : 'Cập nhật mật khẩu tài khoản của bạn.' }}
        </p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Mật khẩu hiện tại
          </label>
          <MInput v-model="current" type="password" placeholder="Nhập mật khẩu hiện tại" />
        </div>
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Mật khẩu mới
          </label>
          <MInput v-model="next" type="password" placeholder="Tối thiểu 8 ký tự" />
        </div>
        <div>
          <label class="mb-1 block text-[13px] font-medium" style="color: var(--mds-text-primary)">
            Xác nhận mật khẩu mới
          </label>
          <MInput v-model="confirm" type="password" placeholder="Nhập lại mật khẩu mới" />
        </div>

        <p v-if="error" class="text-[13px]" style="color: var(--mds-danger, #F04438)">{{ error }}</p>

        <MButton variant="primary" class="w-full" :loading="submitting" @click="submit">
          Đổi mật khẩu
        </MButton>
        <MButton variant="link" class="w-full" @click="backToLogin">Đăng nhập tài khoản khác</MButton>
      </form>
    </div>
  </div>
</template>
