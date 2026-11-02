import { Metric, Point, WedgeLevelDef } from './types';
import { atDistance, mnorm } from './engine';
import { RNG } from './rng';

export const NEAR: Record<number, [number, number][]> = {
  1: [
    [0.30, 1],
    [0.70, 0],
    [0.75, 0],
    [0.80, 0],
    [0.85, 0],
    [0.90, 0],
    [0.95, 0],
    [1.05, 1],
    [1.10, 0],
    [1.20, 1],
    [1.25, 0],
    [1.35, 0],
    [1.40, 1],
  ],
  2: [
    [0.25, 0],
    [0.30, 0],
    [0.60, 1],
    [0.70, 1],
    [0.80, 0],
    [0.85, 0],
    [0.90, 0],
    [1.05, 1],
    [1.10, 0],
    [1.20, 1],
    [1.25, 0],
    [1.35, 0],
    [1.40, 1],
  ],
  3: [
    [0.25, 1],
    [0.37, 1],
    [0.42, 0],
    [0.53, 1],
    [0.66, 0],
    [0.79, 0],
    [0.92, 0],
    [1.07, 0],
    [1.20, 1],
    [1.35, 0],
  ],
  4: [
    [0.58, 0],
    [0.72, 0],
    [0.86, 0],
    [0.98, 1],
    [1.10, 0],
    [1.20, 1],
    [1.30, 1],
    [1.37, 1],
    [1.47, 0],
    [1.58, 0],
    [1.70, 1],
    [1.76, 1],
  ],
  5: [
    [0.62, 0],
    [0.75, 1],
    [0.89, 1],
    [1.03, 0],
    [1.11, 1],
    [1.22, 0],
    [1.30, 1],
    [1.38, 0],
  ],
  6: [
    [0.38, 1],
    [0.50, 0],
    [0.55, 0],
    [0.60, 0],
    [0.65, 0],
    [0.85, 1],
    [1.05, 0],
    [1.25, 1],
  ],
  7: [
    [0.22, 0],
    [0.25, 0],
    [0.36, 1],
    [0.38, 1],
    [0.40, 1],
    [0.42, 1],
    [1.60, 0],
    [1.75, 1],
    [1.90, 0],
  ],
};

export const LEVELS: WedgeLevelDef[] = [
  {
    name: "Close Call",
    seed: 11,
    k: 7,
    scheme: "inverse",
    metric: "euclidean",
    budget: 2,
    r_min: 0.20,
    goal: [0, 1],
    near: NEAR[1],
    blurb: "kNN counts heads. wkNN weighs each neighbour by 1/distance.\nKeep kNN on Fire, flip wkNN to Water.",
  },
  {
    name: "Crowd Control",
    seed: 12,
    k: 7,
    scheme: "inverse",
    metric: "euclidean",
    budget: 3,
    r_min: 0.20,
    goal: [1, 0],
    near: NEAR[2],
    blurb: "The reverse: flip kNN to Water, keep wkNN on Fire.\nA new point evicts the k-th neighbour, while far points carry small weight.",
  },
  {
    name: "Swap Places",
    seed: 13,
    k: 7,
    scheme: "inverse",
    metric: "euclidean",
    budget: 3,
    r_min: 0.20,
    goal: [1, 0],
    near: NEAR[3],
    blurb: "Currently kNN=Fire and wkNN=Water. Swap both: make kNN=Water and wkNN=Fire.\nNotice who sits at ranks #5, #6, #7!",
  },
  {
    name: "Sealed Zone",
    seed: 14,
    k: 9,
    scheme: "inverse_sq",
    metric: "euclidean",
    budget: 3,
    r_min: 0.45,
    goal: [0, 1],
    near: NEAR[4],
    blurb: "The no-go zone blocks point-blank placement, and 1/d^2 weights fall off fast.\nKeep kNN on Fire, flip wkNN to Water.",
  },
  {
    name: "Diamond Rush",
    seed: 15,
    k: 5,
    scheme: "inverse",
    metric: "manhattan",
    budget: 3,
    r_min: 0.30,
    goal: [0, 1],
    near: NEAR[5],
    blurb: "Manhattan (L1) distance: equidistant contours are diamonds, not circles.\nBoth models say Water. Flip kNN to Fire, keep wkNN on Water.",
  },
  {
    name: "Boxed In",
    seed: 16,
    k: 5,
    scheme: "inverse",
    metric: "chebyshev",
    budget: 2,
    r_min: 0.25,
    goal: [0, 1],
    near: NEAR[6],
    blurb: "Chebyshev (L_inf) distance: max(|dx|, |dy|) forms square shells whose corners reach far.\nKeep kNN on Fire, flip wkNN to Water.",
  },
  {
    name: "Bandwidth Squeeze",
    seed: 17,
    k: 7,
    scheme: "gaussian",
    metric: "euclidean",
    budget: 2,
    r_min: 0.35,
    goal: [1, 0],
    near: NEAR[7],
    blurb: "Gaussian wkNN uses bandwidth h = d_k (the k-th neighbour's distance!).\nEvict distant #7 (d=1.60) to shrink h and crush the middle Water cluster's weights!",
  },
];

export function makeLevel(L: WedgeLevelDef): { X: Point[]; y: number[]; star: Point } {
  const rng = new RNG(L.seed);
  const star: Point = [0, 0];
  const metric: Metric = L.metric;
  const ang0 = rng.uniform(0, 2 * Math.PI);

  const pts: Point[] = L.near.map(([d], i) => {
    return atDistance(star, d, ang0 + i * 2.39996, metric);
  });
  const labs: number[] = L.near.map(([, c]) => c);

  let maxNearDist = 0;
  for (const [d] of L.near) {
    if (d > maxNearDist) maxNearDist = d;
  }
  const bg_r = maxNearDist + 0.35;

  let n_bg = 0;
  while (n_bg < 110) {
    const p: Point = [rng.uniform(-3, 3), rng.uniform(-3, 3)];
    if (mnorm(p, metric) < bg_r) {
      continue;
    }
    let c = p[0] > 0 ? 1 : 0;
    if (rng.random() < 0.12) {
      c = 1 - c;
    }
    pts.push(p);
    labs.push(c);
    n_bg++;
  }

  return { X: pts, y: labs, star };
}
