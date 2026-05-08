const store = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests = 5,
  windowMs = 60_000,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (store.get(key) ?? []).filter(t => t > cutoff);

  if (hits.length >= maxRequests) {
    const retryAfterSeconds = Math.ceil((hits[0]! + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  hits.push(now);
  store.set(key, hits);
  return { allowed: true, retryAfterSeconds: 0 };
}
