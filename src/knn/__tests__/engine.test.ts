import { describe, it, expect } from 'vitest';
import {
  dist,
  computeWeights,
  predictFromNeighbors,
  queryPoint,
  ballPoly,
  EPS,
} from '../engine';
import { Point } from '../types';

describe('KNN Engine & Metrics', () => {
  it('correctly calculates Euclidean, Manhattan, and Chebyshev distances', () => {
    const p1: Point = [0, 0];
    const p2: Point = [3, 4];

    expect(dist(p1, p2, 'euclidean')).toBeCloseTo(5.0);
    expect(dist(p1, p2, 'manhattan')).toBeCloseTo(7.0);
    expect(dist(p1, p2, 'chebyshev')).toBeCloseTo(4.0);
  });

  it('generates metric ball polygon where every point is at distance r', () => {
    const center: Point = [1, 2];
    const r = 2.5;

    for (const metric of ['euclidean', 'manhattan', 'chebyshev'] as const) {
      const poly = ballPoly(center, r, metric, 37);
      expect(poly.length).toBe(37);
      for (const pt of poly) {
        const d = dist(center, pt, metric);
        expect(d).toBeCloseTo(r, 4);
      }
    }
  });

  it('computes weights correctly for all schemes', () => {
    const d = [0.0, 1.0, 2.0];

    // Uniform
    const wUniform = computeWeights(d, 'uniform');
    expect(wUniform).toEqual([1.0, 1.0, 1.0]);

    // Inverse: 1 / (d + EPS)
    const wInverse = computeWeights(d, 'inverse');
    expect(wInverse[0]).toBeCloseTo(1.0 / EPS);
    expect(wInverse[1]).toBeCloseTo(1.0 / (1.0 + EPS));
    expect(wInverse[2]).toBeCloseTo(1.0 / (2.0 + EPS));

    // Inverse squared: 1 / (d^2 + EPS)
    const wInvSq = computeWeights(d, 'inverse_sq');
    expect(wInvSq[0]).toBeCloseTo(1.0 / EPS);
    expect(wInvSq[1]).toBeCloseTo(1.0 / (1.0 + EPS));
    expect(wInvSq[2]).toBeCloseTo(1.0 / (4.0 + EPS));

    // Gaussian: bandwidth h = d_k = 2.0 + EPS
    const wGauss = computeWeights(d, 'gaussian');
    expect(wGauss[0]).toBeCloseTo(1.0); // exp(0) = 1
    expect(wGauss[2]).toBeCloseTo(Math.exp(-3.0), 3); // at d = h, exp(-3) ~ 0.0498
  });

  it('properly breaks ties in favor of the single nearest neighbor', () => {
    const idx = [0, 1];
    const d = [1.0, 1.0];
    const ytr = [1, 0]; // Nearest neighbor is class 1, second is class 0

    // With uniform weights, both have equal votes (1.0 each)
    const res = predictFromNeighbors(idx, d, ytr, 2, 'uniform');

    // Probabilities remain unbiased 50/50
    expect(res.proba[0]).toBeCloseTo(0.5);
    expect(res.proba[1]).toBeCloseTo(0.5);

    // Prediction breaks tie in favor of class 1 (nearest neighbor!)
    expect(res.pred).toBe(1);
  });

  it('performs queryPoint accurately with correct neighbor order', () => {
    const target: Point = [0, 0];
    const Xtr: Point[] = [
      [2, 0], // dist 2.0, class 0
      [0.5, 0], // dist 0.5, class 1
      [1.0, 0], // dist 1.0, class 0
      [3, 0], // dist 3.0, class 1
    ];
    const ytr = [0, 1, 0, 1];

    const q = queryPoint(target, Xtr, ytr, 2, 3, 'euclidean', 'inverse');

    // Top 3 neighbors sorted nearest first:
    // 1st: index 1 (dist 0.5, class 1)
    // 2nd: index 2 (dist 1.0, class 0)
    // 3rd: index 0 (dist 2.0, class 0)
    expect(q.idx).toEqual([1, 2, 0]);
    expect(q.d).toEqual([0.5, 1.0, 2.0]);

    // kNN counts heads:
    // class 1 has 1 vote (index 1)
    // class 0 has 2 votes (indices 2, 0)
    // kNN should predict class 0
    expect(q.pk).toBe(0);

    // wkNN weighs by 1/d:
    // class 1 weight = 1/0.5 = 2.0
    // class 0 weights = 1/1.0 + 1/2.0 = 1.0 + 0.5 = 1.5
    // class 1 has weight 2.0 > class 0 weight 1.5
    // wkNN should predict class 1!
    expect(q.pw).toBe(1);
  });

  it('handles edge case when k is greater than the number of training points', () => {
    const target: Point = [0, 0];
    const Xtr: Point[] = [
      [1, 0],
      [2, 0],
    ];
    const ytr = [0, 1];

    const q = queryPoint(target, Xtr, ytr, 2, 10, 'euclidean', 'uniform');
    expect(q.idx.length).toBe(2);
    expect(q.d.length).toBe(2);
    expect(q.idx).toEqual([0, 1]);
  });

  it('handles edge case when a point overlaps exactly with target (distance 0)', () => {
    const target: Point = [1, 1];
    const Xtr: Point[] = [
      [1, 1], // exact match, dist 0
      [2, 1], // dist 1
    ];
    const ytr = [1, 0];

    const q = queryPoint(target, Xtr, ytr, 2, 2, 'euclidean', 'inverse');
    expect(q.d[0]).toBe(0);
    // Inverse weight at 0 does not explode due to EPS
    expect(Number.isFinite(q.w[0])).toBe(true);
    expect(q.w[0]).toBeGreaterThan(1e8);
    expect(q.pw).toBe(1);
  });

  it('handles 3-way tie breaking towards nearest neighbor', () => {
    const idx = [0, 1, 2];
    const d = [1.0, 1.0, 1.0];
    const ytr = [2, 0, 1]; // Nearest is class 2, others are 0 and 1

    const res = predictFromNeighbors(idx, d, ytr, 3, 'uniform');
    expect(res.pred).toBe(2);
  });
});
