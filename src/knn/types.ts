export type Metric = 'euclidean' | 'manhattan' | 'chebyshev';

export type WeightingScheme = 'uniform' | 'inverse' | 'inverse_sq' | 'gaussian';

export type BackgroundMode = 'none' | 'knn' | 'wknn' | 'disagree';

export type AppMode = 'play' | 'sandbox' | 'wedge';

export type Point = [number, number];

export interface QueryResult {
  idx: number[];
  d: number[];
  pk: number;
  pw: number;
  Pk: number[];
  Pw: number[];
  w: number[];
}

export interface WedgeLevelDef {
  name: string;
  seed: number;
  k: number;
  scheme: WeightingScheme;
  metric: Metric;
  budget: number;
  r_min: number;
  goal: [number, number];
  near: [number, number][];
  blurb: string;
}

export interface WedgeSolutionItem {
  distance: number;
  cls: number;
}
