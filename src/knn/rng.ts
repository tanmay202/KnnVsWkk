// Simple and high quality Mulberry32 seeded PRNG
export class RNG {
  private s: number;

  constructor(seed: number = Math.floor(Math.random() * 2147483647)) {
    this.s = seed >>> 0;
  }

  // Returns pseudo-random float in [0, 1)
  random(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(min: number = 0, max: number = 1): number {
    return min + (max - min) * this.random();
  }

  integers(min: number, max: number): number {
    return Math.floor(this.uniform(min, max));
  }

  // Box-Muller transform for normal distribution
  normal(mean: number = 0, std: number = 1): number {
    let u1 = this.random();
    let u2 = this.random();
    while (u1 <= 1e-15) {
      u1 = this.random();
    }
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * std;
  }

  permutation<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
