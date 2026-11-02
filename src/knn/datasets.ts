import { Point } from './types';
import { RNG } from './rng';

export type DatasetName = 'Blobs (3)' | 'Moons (2)' | 'Rings (2)' | 'Spirals (3)';

export interface DatasetSpec {
  generator: (rng: RNG, n: number) => { X: Point[]; y: number[] };
  n: number;
}

export function makeBlobs(rng: RNG, n: number): { X: Point[]; y: number[] } {
  const centers: Point[] = [
    [-1.5, -1.0],
    [1.5, -1.0],
    [0.0, 1.8],
  ];
  const countPer = Math.floor(n / 3);
  const X: Point[] = [];
  const y: number[] = [];

  for (let c = 0; c < 3; c++) {
    const center = centers[c];
    for (let i = 0; i < countPer; i++) {
      X.push([
        rng.normal(center[0], 0.95),
        rng.normal(center[1], 0.95),
      ]);
      y.push(c);
    }
  }

  return { X, y };
}

export function makeMoons(rng: RNG, n: number): { X: Point[]; y: number[] } {
  const m = Math.floor(n / 2);
  const X: Point[] = [];
  const y: number[] = [];

  for (let i = 0; i < m; i++) {
    const t = rng.uniform(0, Math.PI);
    // moon a: [cos(t), sin(t)] + noise - [0.5, 0.25]
    X.push([
      Math.cos(t) + rng.normal(0, 0.17) - 0.5,
      Math.sin(t) + rng.normal(0, 0.17) - 0.25,
    ]);
    y.push(0);
  }

  for (let i = 0; i < m; i++) {
    const t = rng.uniform(0, Math.PI);
    // moon b: [1 - cos(t), 0.5 - sin(t)] + noise - [0.5, 0.25]
    X.push([
      1.0 - Math.cos(t) + rng.normal(0, 0.17) - 0.5,
      0.5 - Math.sin(t) + rng.normal(0, 0.17) - 0.25,
    ]);
    y.push(1);
  }

  return { X, y };
}

export function makeRings(rng: RNG, n: number): { X: Point[]; y: number[] } {
  const m = Math.floor(n / 2);
  const X: Point[] = [];
  const y: number[] = [];

  // Inner ring
  for (let i = 0; i < m; i++) {
    const t = rng.uniform(0, 2 * Math.PI);
    const r = rng.normal(1.0, 0.12);
    X.push([r * Math.cos(t), r * Math.sin(t)]);
    y.push(0);
  }

  // Outer ring
  for (let i = 0; i < m; i++) {
    const t = rng.uniform(0, 2 * Math.PI);
    const r = rng.normal(2.1, 0.15);
    X.push([r * Math.cos(t), r * Math.sin(t)]);
    y.push(1);
  }

  return { X, y };
}

export function makeSpirals(rng: RNG, n: number): { X: Point[]; y: number[] } {
  const m = Math.floor(n / 3);
  const X: Point[] = [];
  const y: number[] = [];

  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < m; i++) {
      const frac = m > 1 ? i / (m - 1) : 0;
      const r = 0.25 + (2.2 - 0.25) * frac;
      const th = r * 1.6 + (c * 2 * Math.PI) / 3 + rng.normal(0, 0.18);
      X.push([r * Math.cos(th), r * Math.sin(th)]);
      y.push(c);
    }
  }

  return { X, y };
}

export const DATASETS: Record<DatasetName, DatasetSpec> = {
  'Blobs (3)': { generator: makeBlobs, n: 240 },
  'Moons (2)': { generator: makeMoons, n: 240 },
  'Rings (2)': { generator: makeRings, n: 240 },
  'Spirals (3)': { generator: makeSpirals, n: 330 },
};
