// GĐ8 — "1 route, 2 view" (ADR-058).
//
// Mỗi route chính giữ ĐÚNG MỘT đường dẫn URL, nhưng render 2 component khác nhau tuỳ
// window size class: bản desktop hiện có (Medium/Expanded/Large) và bản mobile dựng
// riêng (Compact <600px). Đây KHÔNG phải responsive co giãn bằng CSS — hai view là hai
// cây component độc lập, chỉ dùng chung store/API/business logic.
//
// Vì sao không tách route riêng cho mobile (vd /m/films): tách route sẽ biến app thành
// "trang mobile riêng" — link chia sẻ giữa máy tính và điện thoại sẽ không mở được cùng
// một chỗ, và back/forward của trình duyệt sẽ lệch nhau. Giữ chung URL thì đổi kích thước
// cửa sổ chỉ là đổi cách trình bày.
import { defineAsyncComponent, defineComponent, h, type Component } from 'vue'
import { useWindowSize } from './windowSize'

/**
 * Chọn view theo size class. Tách riêng thành hàm THUẦN để test được logic quyết định
 * mà không cần mount cả cây component (component thật cần router/pinia/API).
 */
export function pickView<T>(isCompact: boolean, desktop: T, mobile: T): T {
  return isCompact ? mobile : desktop
}

/**
 * Bọc 2 component thành 1 "resolver" dùng làm component của route.
 *
 * `isCompact` là computed trên `window.innerWidth` (xem windowSize.ts) nên khi người dùng
 * kéo resize cửa sổ qua mốc 600px, render function chạy lại và Vue tự unmount view cũ,
 * mount view mới — KHÔNG cần tải lại trang.
 */
export function responsiveView(
  desktop: Component,
  mobile: Component,
  name = 'ResponsiveView',
): Component {
  return defineComponent({
    name,
    setup() {
      const { isCompact } = useWindowSize()
      return () => h(pickView(isCompact.value, desktop, mobile))
    },
  })
}

/**
 * Biến thể lazy-load: giữ nguyên cách chia bundle theo route của router hiện tại — chỉ
 * view nào thực sự được render mới tải chunk của nó (máy tính không tải code mobile và
 * ngược lại).
 */
export function lazyResponsiveView(
  desktop: () => Promise<Component | { default: Component }>,
  mobile: () => Promise<Component | { default: Component }>,
  name = 'ResponsiveView',
): Component {
  return responsiveView(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defineAsyncComponent(desktop as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defineAsyncComponent(mobile as any),
    name,
  )
}
