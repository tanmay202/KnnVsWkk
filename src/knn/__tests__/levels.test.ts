import { describe, it, expect } from 'vitest';
import { LEVELS, makeLevel } from '../levels';
import { makeBlobs, makeMoons, makeRings, makeSpirals } from '../datasets';
import { RNG } from '../rng';
import { solveWedge } from '../solver';
import { queryPoint } from '../engine';

describe('Datasets & RNG', () => {
  it('generates blobs with correct counts and 3 classes', () => {
    const rng = new RNG(42);
    const { X, y } = makeBlobs(rng, 240);
    expect(X.length).toBe(240);
    expect(y.length).toBe(240);
    expect(new Set(y).size).toBe(3);
  });

  it('generates moons with correct counts and 2 classes', () => {
    const rng = new RNG(42);
    const { X, y } = makeMoons(rng, 240);
    expect(X.length).toBe(240);
    expect(y.length).toBe(240);
    expect(new Set(y).size).toBe(2);
  });

  it('generates rings with 2 classes', () => {
    const rng = new RNG(42);
    const { X, y } = makeRings(rng, 240);
    expect(X.length).toBe(240);
    expect(new Set(y).size).toBe(2);
  });

  it('generates spirals with 3 classes', () => {
    const rng = new RNG(42);
    const { X, y } = makeSpirals(rng, 330);
    expect(X.length).toBe(330);
    expect(new Set(y).size).toBe(3);
  });
});

describe('Wedge Levels & Solver', () => {
  it('contains exactly 7 curated levels with complete definitions', () => {
    expect(LEVELS.length).toBe(7);
    for (const lvl of LEVELS) {
      expect(lvl.name).toBeTruthy();
      expect(lvl.k).toBeGreaterThan(0);
      expect(lvl.budget).toBeGreaterThan(0);
      expect(lvl.r_min).toBeGreaterThan(0);
      expect(lvl.near.length).toBeGreaterThan(0);
      expect(lvl.goal.length).toBe(2);
    }
  });

  it('verifies all 7 wedge levels have valid initial states and par solutions', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const L = LEVELS[i];
      const { X, y, star } = makeLevel(L);

      const q0 = queryPoint(star, X, y, 2, L.k, L.metric, L.scheme);
      // None of the levels should be solved initially
      const solvedInitial = q0.pk === L.goal[0] && q0.pw === L.goal[1];
      expect(solvedInitial).toBe(false);

      const baseC = q0.idx.map((idx) => y[idx]);
      const sol = solveWedge(q0.d, baseC, L.k, L.scheme, L.budget, L.r_min, L.goal, 2);
      expect(sol).not.toBeNull();
      expect(sol!.length).toBeGreaterThan(0);
      expect(sol!.length).toBeLessThanOrEqual(L.budget);

      // Verify that placing the solved points actually achieves the goal
      const placedPts = sol!.map((s) => [s.distance, 0] as [number, number]);
      const placedCls = sol!.map((s) => s.cls);
      const testX = [...X, ...placedPts];
      const testY = [...y, ...placedCls];

      const qSolved = queryPoint(star, testX, testY, 2, L.k, L.metric, L.scheme);
      expect(qSolved.pk).toBe(L.goal[0]);
      expect(qSolved.pw).toBe(L.goal[1]);
    }
  });
});
