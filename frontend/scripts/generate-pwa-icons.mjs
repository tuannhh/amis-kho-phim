// Sinh icon PWA (192/512/512-maskable) từ 1 SVG nguồn — nền brand MDS #245FDF
// + glyph "device-tv" phong cách Tabler (stroke 1.5 outline, giữ đúng phong cách
// icon MDS đang dùng trong app). Dùng `sharp` để render SVG -> PNG (đủ nhẹ, không
// cần Chromium/puppeteer). Chạy lại: `node scripts/generate-pwa-icons.mjs`.
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BRAND = '#245FDF'

// Glyph "device-tv" (Tabler Icons, stroke 1.5, viewBox 0 0 24 24) — vẽ tay lại
// đúng path gốc để không phụ thuộc import runtime @tabler/icons-vue trong script Node.
const GLYPH = `
  <rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="#ffffff" stroke-width="1.5" />
  <path d="M8 7l4 -4l4 4" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M10 13l4 2.5l-4 2.5z" fill="#ffffff" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" />
`

/** size: kích thước canvas; glyphScale: glyph chiếm bao nhiêu % canvas (để chừa margin cho maskable) */
function svgIcon({ size, glyphScale, radius }) {
  const g = size * glyphScale
  const offset = (size - g) / 2
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}" />
  <g transform="translate(${offset}, ${offset}) scale(${g / 24})">
    ${GLYPH}
  </g>
</svg>`
}

const targets = [
  { file: 'app-192.png', size: 192, glyphScale: 0.55, radius: 32 },
  { file: 'app-512.png', size: 512, glyphScale: 0.55, radius: 85 },
  // Maskable: hệ điều hành có thể crop tròn/bo góc mạnh — glyph phải nằm trong
  // vùng an toàn ~80% giữa canvas (safe zone maskable icon), nền vuông không bo góc.
  { file: 'app-maskable-512.png', size: 512, glyphScale: 0.42, radius: 0 },
]

for (const t of targets) {
  const svg = svgIcon(t)
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  writeFileSync(path.join(outDir, t.file), buf)
  console.log('Đã tạo', t.file)
}

// apple-touch-icon: 180x180, không bo góc trong SVG (iOS tự bo), nền đặc.
const appleSvg = svgIcon({ size: 180, glyphScale: 0.55, radius: 0 })
writeFileSync(path.join(outDir, 'apple-touch-icon.png'), await sharp(Buffer.from(appleSvg)).png().toBuffer())
console.log('Đã tạo apple-touch-icon.png')
