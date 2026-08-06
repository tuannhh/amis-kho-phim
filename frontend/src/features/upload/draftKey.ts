/**
 * Khoá localStorage cho nháp form Thêm/Sửa phim.
 *
 * LỖI BẢO MẬT ĐÃ SỬA (ADR-050): bản cũ dùng khoá `kho-phim:film-draft:new` KHÔNG gắn định danh
 * người dùng. Trên máy dùng chung, người A gõ dở form rồi đăng xuất, người B đăng nhập vào màn
 * "Thêm phim" sẽ thấy nguyên nội dung nháp của người A — rò dữ liệu giữa hai tài khoản.
 *
 * Nay khoá luôn kèm `userId`, nên nháp của mỗi tài khoản nằm ở một khoá riêng và không thể đọc
 * chéo. Tiền tố cũng đổi hẳn (`film-draft` → `film-draft-v2`) để nháp ghi bằng định dạng cũ trở
 * thành rác không bao giờ khớp khoá mới — cố ý KHÔNG migrate: nháp cũ không xác định được của
 * ai, migrate sang bất kỳ tài khoản nào cũng chính là tái tạo đúng lỗi rò đang sửa.
 */
const DRAFT_PREFIX = 'kho-phim:film-draft-v2:'

/** Tiền tố khoá của định dạng cũ (không có userId) — chỉ dùng để dọn rác, không đọc nội dung. */
const LEGACY_DRAFT_PREFIX = 'kho-phim:film-draft:'

/**
 * Khoá nháp của MỘT người dùng cho MỘT ngữ cảnh form.
 *
 * @param userId  id người đang đăng nhập; `null`/`undefined` (chưa xác định danh tính) trả về
 *                `null` — nơi gọi phải hiểu là "không đọc, không ghi nháp" chứ không được rơi
 *                về một khoá dùng chung, vì khoá dùng chung chính là lỗi cũ.
 * @param editingSlug  slug phim đang sửa; rỗng = form thêm mới.
 */
export function buildDraftKey(
  userId: number | null | undefined,
  editingSlug: string,
): string | null {
  if (userId == null) return null
  return `${DRAFT_PREFIX}${userId}:${editingSlug ? `edit:${editingSlug}` : 'new'}`
}

/**
 * Xoá mọi nháp ghi theo định dạng cũ (không có userId) còn sót trong localStorage của máy này.
 * Gọi một lần lúc mở form: dữ liệu đó không thể quy về tài khoản nào nên không được phép khôi
 * phục cho ai cả, giữ lại chỉ tổ chiếm chỗ.
 */
export function purgeLegacyDrafts(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>): number {
  const stale: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    // Khoá mới cũng bắt đầu bằng tiền tố cũ (`...film-draft` là tiền tố của `...film-draft-v2`)
    // nên phải loại trừ tường minh, nếu không sẽ xoá nhầm nháp hợp lệ của chính người dùng.
    if (k && k.startsWith(LEGACY_DRAFT_PREFIX) && !k.startsWith(DRAFT_PREFIX)) stale.push(k)
  }
  for (const k of stale) storage.removeItem(k)
  return stale.length
}
