/**
 * Seeded pseudo-random numbers so a shared link reproduces the exact same
 * Monte Carlo result on every machine.
 */

/** mulberry32 — tiny, fast, good enough for simulation (not crypto). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box–Muller. */
export function normal(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Multiplicative shock centred on 1 with the given spread (0.2 ≈ ±20%).
 * Log-normal so a factor can never go negative.
 */
export function shock(rng: () => number, spread: number): number {
  if (spread <= 0) return 1;
  return Math.exp(normal(rng) * spread - (spread * spread) / 2);
}

/** Linear-interpolated percentile of an already sorted array. p in [0, 1]. */
export function percentileSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}
