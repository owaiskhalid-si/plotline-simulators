// Sliding-window limiter kept in memory. Good enough to stop casual abuse of a
// portfolio demo on one serverless instance; swap for Upstash/Redis at scale.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 10, windowMs = 10 * 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false as const, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return { ok: true as const, remaining: limit - recent.length };
}
