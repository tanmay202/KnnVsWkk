import { WeightingScheme, WedgeSolutionItem } from './types';
import { computeWeights } from './engine';
import { RNG } from './rng';

function checkWedgeSingle(
  baseD: number[],
  baseC: number[],
  placeD: number[],
  placeC: number[],
  k: number,
  scheme: WeightingScheme,
  C: number,
  goal: [number, number]
): boolean {
  // Combine base and placed items
  const all: { d: number; c: number }[] = [];
  for (let i = 0; i < baseD.length; i++) {
    all.push({ d: baseD[i], c: baseC[i] });
  }
  for (let i = 0; i < placeD.length; i++) {
    all.push({ d: placeD[i], c: placeC[i] });
  }

  // Stable sort by distance
  all.sort((a, b) => a.d - b.d);

  const top = all.slice(0, k);
  const Dk = top.map((x) => x.d);
  const Ck = top.map((x) => x.c);

  // Evaluate kNN
  const wKnn = new Array(k).fill(1.0);
  const votesK = new Array(C).fill(0);
  for (let i = 0; i < k; i++) {
    votesK[Ck[i]] += wKnn[i];
  }
  const sumK = votesK.reduce((a, b) => a + b, 0) || 1;
  const pK = votesK.map((v) => v / sumK);
  pK[Ck[0]] += 1e-9;
  const predK = pK[1] > pK[0] ? 1 : 0;

  // Evaluate wkNN
  const wWknn = computeWeights(Dk, scheme);
  const votesW = new Array(C).fill(0);
  for (let i = 0; i < k; i++) {
    votesW[Ck[i]] += wWknn[i];
  }
  const sumW = votesW.reduce((a, b) => a + b, 0) || 1;
  const pW = votesW.map((v) => v / sumW);
  pW[Ck[0]] += 1e-9;
  const predW = pW[1] > pW[0] ? 1 : 0;

  return predK === goal[0] && predW === goal[1];
}

export function solveWedge(
  base_d: number[],
  base_c: number[],
  k: number,
  scheme: WeightingScheme,
  budget: number,
  r_min: number,
  goal: [number, number],
  C: number = 2,
  step: number = 0.025
): WedgeSolutionItem[] | null {
  const effectiveBaseD = base_d.slice(0, k);
  const effectiveBaseC = base_c.slice(0, k);

  const maxDist = effectiveBaseD[effectiveBaseD.length - 1];
  const ds: number[] = [];
  for (let d = r_min; d <= maxDist + 1e-9; d += step) {
    ds.push(Number(d.toFixed(4)));
  }

  if (ds.length === 0) return null;

  // Options of (distance, class)
  const options: { d: number; c: number }[] = [];
  for (const d of ds) {
    for (let c = 0; c < C; c++) {
      options.push({ d, c });
    }
  }

  const rng = new RNG(0);

  // Helper for combinations with replacement
  function getCombos(n: number, m: number): number[][] {
    const result: number[][] = [];
    function backtrack(start: number, current: number[]) {
      if (current.length === m) {
        result.push([...current]);
        return;
      }
      for (let i = start; i < n; i++) {
        current.push(i);
        backtrack(i, current);
        current.pop();
      }
    }
    backtrack(0, []);
    return result;
  }

  for (let m = 1; m <= budget; m++) {
    const combos = getCombos(options.length, m);
    const validCombos: number[][] = [];

    for (let i = 0; i < combos.length; i++) {
      const combo = combos[i];
      const placeD = combo.map((idx) => options[idx].d);
      const placeC = combo.map((idx) => options[idx].c);

      if (
        checkWedgeSingle(
          effectiveBaseD,
          effectiveBaseC,
          placeD,
          placeC,
          k,
          scheme,
          C,
          goal
        )
      ) {
        validCombos.push(combo);
        if (validCombos.length >= 3000) break;
      }
    }

    if (validCombos.length === 0) continue;

    // Jitter test
    let bestCombo: number[] | null = null;
    let bestScore = -1;

    for (const combo of validCombos) {
      let score = 0;
      const baseComboD = combo.map((idx) => options[idx].d);
      const comboC = combo.map((idx) => options[idx].c);

      for (let j = 0; j < 12; j++) {
        const jitteredD = baseComboD.map((d) =>
          Math.max(r_min, d + rng.uniform(-0.02, 0.02))
        );
        if (
          checkWedgeSingle(
            effectiveBaseD,
            effectiveBaseC,
            jitteredD,
            comboC,
            k,
            scheme,
            C,
            goal
          )
        ) {
          score++;
        }
      }

      if (score >= 4 && score > bestScore) {
        bestScore = score;
        bestCombo = combo;
      }
    }

    if (bestCombo !== null) {
      return bestCombo.map((idx) => ({
        distance: options[idx].d,
        cls: options[idx].c,
      }));
    }
  }

  return null;
}
