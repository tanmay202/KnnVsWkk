import { Metric, Point, QueryResult, WeightingScheme } from './types';

export const EPS = 1e-9;
export const COLORS = ["#e4572e", "#17bebb", "#f2b705", "#76b041"] as const;
export const NAMES = ["Fire", "Water", "Sun", "Leaf"] as const;

export function tint(hexColor: string, a: number = 0.6): string {
  const clean = hexColor.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const tr = Math.round(r + (255 - r) * a);
  const tg = Math.round(g + (255 - g) * a);
  const tb = Math.round(b + (255 - b) * a);
  return `rgb(${tr}, ${tg}, ${tb})`;
}

export function mnorm(v: Point, metric: Metric): number {
  const ax = Math.abs(v[0]);
  const ay = Math.abs(v[1]);
  if (metric === 'euclidean') {
    return Math.sqrt(ax * ax + ay * ay);
  }
  if (metric === 'manhattan') {
    return ax + ay;
  }
  return Math.max(ax, ay); // chebyshev
}

export function dist(p1: Point, p2: Point, metric: Metric): number {
  return mnorm([p1[0] - p2[0], p1[1] - p2[1]], metric);
}

export function atDistance(center: Point, d: number, theta: number, metric: Metric): Point {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const norm = mnorm([ux, uy], metric);
  return [
    center[0] + (d * ux) / norm,
    center[1] + (d * uy) / norm,
  ];
}

export function ballPoly(center: Point, r: number, metric: Metric, n: number = 181): Point[] {
  const pts: Point[] = [];
  const step = (2 * Math.PI) / (n - 1);
  for (let i = 0; i < n; i++) {
    const th = i * step;
    pts.push(atDistance(center, r, th, metric));
  }
  return pts;
}

export function computeWeights(d: number[], scheme: WeightingScheme): number[] {
  const k = d.length;
  if (scheme === 'uniform') {
    return new Array(k).fill(1.0);
  }
  if (scheme === 'inverse') {
    return d.map((dist) => 1.0 / (dist + EPS));
  }
  if (scheme === 'inverse_sq') {
    return d.map((dist) => 1.0 / (dist * dist + EPS));
  }
  // gaussian kernel, bandwidth = distance to k-th neighbour (or EPS if 0)
  const h = (k > 0 ? d[k - 1] : 0) + EPS;
  return d.map((dist) => Math.exp(-3.0 * Math.pow(dist / h, 2)));
}

export function predictFromNeighbors(
  idx: number[],
  d: number[],
  ytr: number[],
  nClasses: number,
  scheme: WeightingScheme
): { pred: number; proba: number[]; w: number[] } {
  const w = computeWeights(d, scheme);
  const votes = new Array(nClasses).fill(0);

  for (let i = 0; i < idx.length; i++) {
    const cls = ytr[idx[i]];
    if (cls >= 0 && cls < nClasses) {
      votes[cls] += w[i];
    }
  }

  const sumVotes = votes.reduce((acc, v) => acc + v, 0) || 1e-12;
  const proba = votes.map((v) => v / sumVotes);

  // Tie-break in favor of the single nearest neighbor
  const scores = [...proba];
  if (idx.length > 0) {
    const nearestCls = ytr[idx[0]];
    if (nearestCls >= 0 && nearestCls < nClasses) {
      scores[nearestCls] += 1e-9;
    }
  }

  let pred = 0;
  let maxScore = scores[0];
  for (let c = 1; c < nClasses; c++) {
    if (scores[c] > maxScore) {
      maxScore = scores[c];
      pred = c;
    }
  }

  return { pred, proba, w };
}

export function queryPoint(
  target: Point,
  Xtr: Point[],
  ytr: number[],
  nClasses: number,
  k: number,
  metric: Metric,
  scheme: WeightingScheme
): QueryResult {
  const effectiveK = Math.min(k, Xtr.length);

  // Compute all distances
  const distList: { index: number; dist: number }[] = new Array(Xtr.length);
  for (let i = 0; i < Xtr.length; i++) {
    distList[i] = { index: i, dist: dist(target, Xtr[i], metric) };
  }

  // Sort by distance ascending
  distList.sort((a, b) => a.dist - b.dist);

  const top = distList.slice(0, effectiveK);
  const idx = top.map((t) => t.index);
  const d = top.map((t) => t.dist);

  // Predict for kNN (uniform)
  const knnRes = predictFromNeighbors(idx, d, ytr, nClasses, 'uniform');

  // Predict for wkNN (scheme)
  const wknnRes = predictFromNeighbors(idx, d, ytr, nClasses, scheme);

  return {
    idx,
    d,
    pk: knnRes.pred,
    pw: wknnRes.pred,
    Pk: knnRes.proba,
    Pw: wknnRes.proba,
    w: wknnRes.w,
  };
}

export function getTotalsFromQuery(
  q: QueryResult,
  ytr: number[],
  nClasses: number
): { counts: number[]; weights: number[] } {
  const counts = new Array(nClasses).fill(0);
  const weights = new Array(nClasses).fill(0);

  for (let i = 0; i < q.idx.length; i++) {
    const c = ytr[q.idx[i]];
    if (c >= 0 && c < nClasses) {
      counts[c] += 1;
      weights[c] += q.w[i];
    }
  }

  return { counts, weights };
}
