import { describe, expect, it } from 'vitest'
import { canonicalFilmPath, canonicalFilmUrl } from './filmShareLink'

describe('canonicalFilmPath / canonicalFilmUrl', () => {
  const film = {
    urlCategorySlug: 'phim-gioi-thieu-cong-ty',
    urlFilmSlug: 'gioi-thieu-tap-doan-misa-13082026-1',
  }

  it('tạo đúng path public do backend đã canonical hoá', () => {
    expect(canonicalFilmPath(film)).toBe('/phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-1')
  })

  it('tạo hyperlink tuyệt đối để copy chia sẻ', () => {
    expect(canonicalFilmUrl(film, 'https://kho-phim.misa.vn')).toBe(
      'https://kho-phim.misa.vn/phim-gioi-thieu-cong-ty/gioi-thieu-tap-doan-misa-13082026-1',
    )
  })
})
