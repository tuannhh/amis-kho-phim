/**
 * Rehearsal Redis shared throttler: xen kẽ 11 login sai qua HAI process backend khác nhau.
 * Nếu rate-limit còn nằm memory từng process thì cả hai chỉ nhận 5 request và request thứ 11
 * sẽ là 401. Với Redis dùng chung, tổng request thứ 11 phải là 429.
 */
const endpointA = process.env.MULTI_REPLICA_BACKEND_A_URL || 'http://127.0.0.1:8301'
const endpointB = process.env.MULTI_REPLICA_BACKEND_B_URL || 'http://127.0.0.1:8302'

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'multi-replica-rate-limit@misa.invalid', password: 'SaiMatKhau@2026' }),
  })
  return response.status
}

const statuses = []
for (let i = 0; i < 11; i++) {
  statuses.push(await login(i % 2 === 0 ? endpointA : endpointB))
}

const firstTenAreUnauthorized = statuses.slice(0, 10).every((status) => status === 401)
if (!firstTenAreUnauthorized || statuses[10] !== 429) {
  throw new Error(
    `Redis rate-limit không được chia sẻ đúng giữa 2 replica. statuses=${statuses.join(',')}`,
  )
}

console.log(`PASS shared Redis throttler: ${statuses.join(',')} (request 11 bị chặn trên replica kia)`)
