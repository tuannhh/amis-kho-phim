/**
 * Jest cho backend NestJS (GĐ7). Test đặt cạnh source, đặt tên `<ten>.spec.ts` trong src/.
 *
 * Không bật `collectCoverage` mặc định (chạy chậm); dùng `npm run test:cov` khi cần.
 * Không có threshold giả tạo — mục tiêu GĐ7 là phủ phần RỦI RO CAO (guard, auth, RBAC,
 * SSO, xuất CSV), không phải chạy đua tỷ lệ phần trăm trên CRUD không có logic.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Báo lỗi nếu có test bị bỏ quên ở chế độ .only
  verbose: true,
}
