/**
 * Tách chuỗi người dùng gõ tự do thành danh sách hashtag (ADR-047).
 *
 * Quy ước nghiệp vụ do người dùng chốt: **chỉ dấu phẩy mới ngăn cách hashtag**, khoảng trắng
 * KHÔNG ngăn cách. Nhờ vậy "MISA, Agentic AI" ra đúng 2 hashtag `MISA` và `Agentic AI` —
 * hashtag nhiều chữ là trường hợp thật (tên sản phẩm, tên chiến dịch) nên không được tự cắt.
 *
 * Tách riêng khỏi component để test được thuần tuý (không cần mount Vue).
 */

/** Ký tự `#` người dùng quen gõ kèm — bỏ đi vì UI tự thêm khi hiển thị. */
function normalize(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim()
}

/**
 * Tách `raw` theo dấu phẩy, trim từng phần, bỏ phần rỗng và loại trùng lặp.
 *
 * @param raw     chuỗi thô trong ô nhập, vd `"MISA, Agentic AI"`.
 * @param existing các hashtag đã chọn — dùng để không thêm trùng (so sánh không phân biệt hoa/thường).
 * @returns các hashtag MỚI cần thêm, giữ nguyên thứ tự người dùng gõ.
 */
export function parseHashtags(raw: string, existing: readonly string[] = []): string[] {
  const seen = new Set(existing.map((h) => h.toLowerCase()))
  const out: string[] = []

  for (const part of String(raw ?? '').split(',')) {
    const tag = normalize(part)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }

  return out
}
