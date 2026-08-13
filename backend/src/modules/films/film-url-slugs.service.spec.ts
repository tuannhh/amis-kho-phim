import { FilmUrlSlugsService, UNCATEGORIZED_URL_SEGMENT } from './film-url-slugs.service'
import { FilmUrlSlug } from './entities/film-url-slug.entity'

/**
 * Feature 2026-08-13 — mỗi phim có 1 URL riêng `ten-chuyen-muc/ten-phim-ngay-phat-hanh-version`.
 * Ba hành vi quan trọng nhất kiểm ở đây:
 *  1. `assignCurrent` sinh đúng chuỗi từ slug/ngày/version, và VÔ HIỆU HOÁ (không xoá) URL cũ
 *     của CHÍNH phim đó khi sinh URL mới — link cũ vẫn phải tồn tại để `findByPath` tra ra được.
 *  2. Trùng `path` giữa 2 PHIM KHÁC NHAU → tự thêm hậu tố `-2/-3`; trùng `path` do CHÍNH phim
 *     đó gọi lại (idempotent, vd bấm lưu 2 lần cùng ngày) → tái dùng dòng cũ, không tạo trùng.
 *  3. Không có chuyên mục (`categorySlug: null`) → dùng fallback `chua-phan-loai`, không throw.
 */

function fakeManager(rows: FilmUrlSlug[] = []) {
  let nextId = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1
  return {
    findOne: jest.fn(async (_entity: unknown, opts: { where: Partial<FilmUrlSlug> }) => {
      const { path } = opts.where
      return rows.find((r) => r.path === path) ?? null
    }),
    update: jest.fn(async (_entity: unknown, where: Partial<FilmUrlSlug>, patch: Partial<FilmUrlSlug>) => {
      for (const r of rows) {
        if (r.filmId === where.filmId && r.isCurrent === where.isCurrent) Object.assign(r, patch)
      }
    }),
    create: jest.fn((_entity: unknown, data: Partial<FilmUrlSlug>) => ({ id: nextId++, ...data }) as FilmUrlSlug),
    save: jest.fn(async (row: FilmUrlSlug) => {
      const existed = rows.find((r) => r.id === row.id)
      if (existed) Object.assign(existed, row)
      else rows.push(row)
      return row
    }),
  }
}

function setup(rows: FilmUrlSlug[] = []) {
  const slugsRepo = { findOne: jest.fn(), find: jest.fn() }
  const service = new FilmUrlSlugsService(slugsRepo as never)
  const em = fakeManager(rows)
  return { service, em, rows, slugsRepo }
}

describe('FilmUrlSlugsService.assignCurrent', () => {
  it('sinh path đúng dạng ten-chuyen-muc/ten-phim-ngay-version', async () => {
    const { service, em } = setup()
    const row = await service.assignCurrent(em as never, {
      filmId: 7,
      filmSlug: 'gioi-thieu-tap-doan-misa',
      categorySlug: 'phim-gioi-thieu-cong-ty',
      publishedAt: '2026-08-13',
      versionNo: 1,
    })
    expect(row.path).toBe('phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-1')
    expect(row.isCurrent).toBe(true)
  })

  it('không có chuyên mục (categorySlug null) → dùng fallback chua-phan-loai', async () => {
    const { service, em } = setup()
    const row = await service.assignCurrent(em as never, {
      filmId: 1,
      filmSlug: 'phim-le',
      categorySlug: null,
      publishedAt: '2026-01-05',
      versionNo: 1,
    })
    expect(row.path).toBe(`${UNCATEGORIZED_URL_SEGMENT}/phim-le-05012026-1`)
  })

  it('sinh URL mới cho CÙNG phim → URL cũ chuyển is_current=false, không bị xoá', async () => {
    const existing: FilmUrlSlug = {
      id: 1,
      filmId: 7,
      categorySlug: 'phim-gioi-thieu-cong-ty',
      slugSegment: 'gioi-thieu-tap-doan-misa-01012026-1',
      path: 'phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-01012026-1',
      isCurrent: true,
      createdAt: new Date(),
    }
    const { service, em, rows } = setup([existing])

    await service.assignCurrent(em as never, {
      filmId: 7,
      filmSlug: 'gioi-thieu-tap-doan-misa',
      categorySlug: 'phim-gioi-thieu-cong-ty',
      publishedAt: '2026-08-13',
      versionNo: 2,
    })

    expect(rows).toHaveLength(2)
    expect(existing.isCurrent).toBe(false) // URL cũ vẫn còn trong bảng, chỉ tắt cờ current
    const newest = rows.find((r) => r.id !== existing.id)!
    expect(newest.path).toBe('phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-2')
    expect(newest.isCurrent).toBe(true)
  })

  it('2 phim KHÁC NHAU trùng category+tên+ngày+version → phim thứ 2 tự thêm hậu tố -2', async () => {
    const filmA: FilmUrlSlug = {
      id: 1,
      filmId: 1,
      categorySlug: 'phim-gioi-thieu-cong-ty',
      slugSegment: 'gioi-thieu-tap-doan-misa-13082026-1',
      path: 'phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-1',
      isCurrent: true,
      createdAt: new Date(),
    }
    const { service, em } = setup([filmA])

    const row = await service.assignCurrent(em as never, {
      filmId: 2, // phim KHÁC filmA
      filmSlug: 'gioi-thieu-tap-doan-misa',
      categorySlug: 'phim-gioi-thieu-cong-ty',
      publishedAt: '2026-08-13',
      versionNo: 1,
    })

    expect(row.path).toBe('phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-1-2')
    expect(filmA.isCurrent).toBe(true) // không đụng tới URL của phim khác
  })

  it('gọi lại đúng tham số cho CÙNG phim (idempotent) → tái dùng dòng đã có, không tạo trùng', async () => {
    const existing: FilmUrlSlug = {
      id: 1,
      filmId: 7,
      categorySlug: 'phim-gioi-thieu-cong-ty',
      slugSegment: 'gioi-thieu-tap-doan-misa-13082026-1',
      path: 'phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-1',
      isCurrent: true,
      createdAt: new Date(),
    }
    const { service, em, rows } = setup([existing])

    await service.assignCurrent(em as never, {
      filmId: 7,
      filmSlug: 'gioi-thieu-tap-doan-misa',
      categorySlug: 'phim-gioi-thieu-cong-ty',
      publishedAt: '2026-08-13',
      versionNo: 1,
    })

    expect(rows).toHaveLength(1)
    expect(existing.isCurrent).toBe(true)
  })
})

describe('FilmUrlSlugsService.findCurrentMap', () => {
  it('mảng rỗng → trả Map rỗng, KHÔNG gọi truy vấn (tránh IN () rỗng lỗi cú pháp SQL)', async () => {
    const slugsRepo = { find: jest.fn() }
    const service = new FilmUrlSlugsService(slugsRepo as never)
    const map = await service.findCurrentMap([])
    expect(map.size).toBe(0)
    expect(slugsRepo.find).not.toHaveBeenCalled()
  })
})
