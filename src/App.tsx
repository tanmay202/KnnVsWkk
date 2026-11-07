import React, { useState, useEffect, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  AppMode,
  BackgroundMode,
  Metric,
  Point,
  QueryResult,
  WeightingScheme,
} from './knn/types';
import { DATASETS, DatasetName } from './knn/datasets';
import {
  atDistance,
  COLORS,
  computeWeights,
  dist,
  getTotalsFromQuery,
  mnorm,
  NAMES,
  queryPoint,
} from './knn/engine';
import { LEVELS, makeLevel } from './knn/levels';
import { solveWedge } from './knn/solver';
import { RNG } from './knn/rng';
import { ArenaCanvas } from './components/ArenaCanvas';
import { VoteTable } from './components/VoteTable';
import { ControlPanel } from './components/ControlPanel';
import { Header } from './components/Header';

export const App: React.FC = () => {
  // Global App Mode
  const [mode, setMode] = useState<AppMode>('play');

  // Play Mode Hyperparameters
  const [datasetName, setDatasetName] = useState<DatasetName>('Moons (2)');
  const [noise, setNoise] = useState<number>(10);
  const [hardMode, setHardMode] = useState<boolean>(true);
  const [k, setK] = useState<number>(7);
  const [metric, setMetric] = useState<Metric>('euclidean');
  const [scheme, setScheme] = useState<WeightingScheme>('inverse');
  const [boundary, setBoundary] = useState<BackgroundMode>('none');

  // Scores for Play Mode
  const [scores, setScores] = useState({
    You: { correct: 0, total: 0 },
    kNN: { correct: 0, total: 0 },
    wkNN: { correct: 0, total: 0 },
  });

  // Data sets state
  const [XtrBase, setXtrBase] = useState<Point[]>([]);
  const [ytrCleanBase, setYtrCleanBase] = useState<number[]>([]);
  const [noiseU, setNoiseU] = useState<number[]>([]);
  const [noiseShift, setNoiseShift] = useState<number[]>([]);
  const [Xte, setXte] = useState<Point[]>([]);
  const [yte, setYte] = useState<number[]>([]);
  const [nBase, setNBase] = useState<number>(0);
  const [nClasses, setNClasses] = useState<number>(2);

  // User additions in Sandbox mode
  const [userPoints, setUserPoints] = useState<{ point: Point; cls: number }[]>([]);

  // Focus point (for mystery star in Play, probe in Sandbox, center in Wedge)
  const [focus, setFocus] = useState<{ point: Point; truth: number | null } | null>(null);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [testPool, setTestPool] = useState<number[]>([]);

  // Bounds
  const [bounds, setBounds] = useState<{ lo: Point; hi: Point }>({
    lo: [-3.2, -2.5],
    hi: [3.2, 2.5],
  });

  // Wedge Puzzle Mode State
  const [levelIndex, setLevelIndex] = useState<number>(0);
  const [wedgePlaced, setWedgePlaced] = useState<{ point: Point; cls: number }[]>([]);
  const [wedgeGhosts, setWedgeGhosts] = useState<{ point: Point; cls: number }[]>([]);
  const [wedgeSolved, setWedgeSolved] = useState<boolean>(false);
  const [wedgeHintUsed, setWedgeHintUsed] = useState<boolean>(false);
  const [wedgeStars, setWedgeStars] = useState<Record<number, number>>({});
  const [brush, setBrush] = useState<number>(0);
  const [savedParams, setSavedParams] = useState<{
    k: number;
    metric: Metric;
    scheme: WeightingScheme;
  }>({ k: 7, metric: 'euclidean', scheme: 'inverse' });

  // Status & Hover strings
  const [statusText, setStatusText] = useState<string>('');
  const [hoverInfo, setHoverInfo] = useState<string>('');

  // Active training data (combining base training + noise + user points/wedge placed)
  const Xtr = useMemo(() => {
    if (mode === 'wedge') {
      const basePts = XtrBase;
      const extra = wedgePlaced.map((p) => p.point);
      return [...basePts, ...extra];
    }
    const extra = userPoints.map((p) => p.point);
    return [...XtrBase, ...extra];
  }, [mode, XtrBase, wedgePlaced, userPoints]);

  const ytr = useMemo(() => {
    if (mode === 'wedge') {
      const baseLabels = [...ytrCleanBase];
      const extra = wedgePlaced.map((p) => p.cls);
      return [...baseLabels, ...extra];
    }
    // Apply noise to base training points
    const noisyLabels = [...ytrCleanBase];
    const noiseFrac = noise / 100;
    for (let i = 0; i < noisyLabels.length; i++) {
      if (noiseU[i] < noiseFrac) {
        noisyLabels[i] = (noisyLabels[i] + noiseShift[i]) % nClasses;
      }
    }
    const extra = userPoints.map((p) => p.cls);
    return [...noisyLabels, ...extra];
  }, [mode, ytrCleanBase, noise, noiseU, noiseShift, nClasses, wedgePlaced, userPoints]);

  // Compute query on focus point
  const cachedQuery: QueryResult | null = useMemo(() => {
    if (!focus || Xtr.length === 0) return null;
    return queryPoint(focus.point, Xtr, ytr, nClasses, k, metric, scheme);
  }, [focus, Xtr, ytr, nClasses, k, metric, scheme]);

  // Calculate base totals for wedge deltas
  const baseTotals = useMemo(() => {
    if (mode !== 'wedge' || XtrBase.length === 0) return null;
    const q0 = queryPoint([0, 0], XtrBase, ytrCleanBase, 2, k, metric, scheme);
    return getTotalsFromQuery(q0, ytrCleanBase, 2);
  }, [mode, XtrBase, ytrCleanBase, k, metric, scheme]);

  // Solver for Wedge Par
  const parSolution = useMemo(() => {
    if (mode !== 'wedge' || XtrBase.length === 0) return null;
    const L = LEVELS[levelIndex];
    const q0 = queryPoint([0, 0], XtrBase, ytrCleanBase, 2, L.k, L.metric, L.scheme);
    const baseC = q0.idx.map((i) => ytrCleanBase[i]);
    return solveWedge(q0.d, baseC, L.k, L.scheme, L.budget, L.r_min, L.goal, 2);
  }, [mode, levelIndex, XtrBase, ytrCleanBase]);

  const par = parSolution ? parSolution.length : null;

  // Helper: Set bounds with equal aspect ratio
  const calculateEqualBounds = useCallback((pts: Point[], pad = 0.55, aspect = 1.28) => {
    if (pts.length === 0) return;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const lo: Point = [minX - pad, minY - pad];
    const hi: Point = [maxX + pad, maxY + pad];
    const center: Point = [0.5 * (lo[0] + hi[0]), 0.5 * (lo[1] + hi[1])];
    const span: Point = [hi[0] - lo[0], hi[1] - lo[1]];

    if (span[0] / span[1] < aspect) {
      span[0] = span[1] * aspect;
    } else {
      span[1] = span[0] / aspect;
    }

    setBounds({
      lo: [center[0] - 0.5 * span[0], center[1] - 0.5 * span[1]],
      hi: [center[0] + 0.5 * span[0], center[1] + 0.5 * span[1]],
    });
  }, []);

  // Format vote percentages helper
  const fmtVotes = useCallback(
    (P: number[], C: number) => {
      return Array.from({ length: C })
        .map((_, c) => `${NAMES[c][0]}:${Math.round((P[c] || 0) * 100)}%`)
        .join(' ');
    },
    []
  );

  // Rebuild test pool
  const rebuildTestPool = useCallback(
    (testPoints: Point[], trainPts: Point[], trainLabels: number[], numC: number, currentK: number, currentMetric: Metric, currentScheme: WeightingScheme, isHard: boolean) => {
      if (testPoints.length === 0) return [];
      const rng = new RNG();
      if (!isHard) {
        return rng.permutation(Array.from({ length: testPoints.length }, (_, i) => i));
      }

      // Hard mode: prioritize contested points where kNN != wkNN or high uncertainty
      const priorities: { index: number; prio: number }[] = [];
      for (let i = 0; i < testPoints.length; i++) {
        const q = queryPoint(testPoints[i], trainPts, trainLabels, numC, currentK, currentMetric, currentScheme);
        const disagree = q.pk !== q.pw ? 1 : 0;
        const maxK = Math.max(...q.Pk);
        const maxW = Math.max(...q.Pw);
        const uncertainty = 1.0 - 0.5 * (maxK + maxW);
        const prio = disagree * 2.0 + uncertainty + rng.uniform(0, 0.05);
        priorities.push({ index: i, prio });
      }

      // Sort ascending, so pop() returns the highest priority!
      priorities.sort((a, b) => a.prio - b.prio);
      return priorities.map((p) => p.index);
    },
    []
  );

  // Initialize a new dataset (for Play / Sandbox)
  const initDataset = useCallback(
    (dName: DatasetName, hard: boolean) => {
      const spec = DATASETS[dName];
      const rng = new RNG();
      const { X, y } = spec.generator(rng, spec.n);

      // Shuffle
      const perm = rng.permutation(Array.from({ length: X.length }, (_, i) => i));
      const cut = Math.floor(0.75 * X.length);

      const trainPts = perm.slice(0, cut).map((i) => X[i]);
      const trainLabs = perm.slice(0, cut).map((i) => y[i]);
      const testPts = perm.slice(cut).map((i) => X[i]);
      const testLabs = perm.slice(cut).map((i) => y[i]);

      const numC = Math.max(...y) + 1;
      const uNoise = trainPts.map(() => rng.random());
      const sNoise = trainPts.map(() => rng.integers(1, numC));

      setXtrBase(trainPts);
      setYtrCleanBase(trainLabs);
      setNoiseU(uNoise);
      setNoiseShift(sNoise);
      setXte(testPts);
      setYte(testLabs);
      setNBase(trainPts.length);
      setNClasses(numC);
      setUserPoints([]);

      calculateEqualBounds(X);

      // Setup pool
      const pool = rebuildTestPool(testPts, trainPts, trainLabs, numC, k, metric, scheme, hard);
      setTestPool(pool);

      // Select first test point for Play mode
      if (pool.length > 0) {
        const poolCopy = [...pool];
        const nextIdx = poolCopy.pop()!;
        setTestPool(poolCopy);
        setFocus({ point: testPts[nextIdx], truth: testLabs[nextIdx] });
        setRevealed(false);
        setStatusText(`Which class does the mystery star belong to? (Choose 1-${numC})`);
      }
    },
    [calculateEqualBounds, rebuildTestPool, k, metric, scheme]
  );

  // Initial load on mount
  useEffect(() => {
    initDataset(datasetName, hardMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load a Wedge Puzzle Level
  const loadWedgeLevel = useCallback((lvlIndex: number) => {
    const safeIndex = (lvlIndex + LEVELS.length) % LEVELS.length;
    setLevelIndex(safeIndex);
    const L = LEVELS[safeIndex];

    const { X, y, star } = makeLevel(L);

    setXtrBase(X);
    setYtrCleanBase(y);
    setNBase(X.length);
    setNClasses(2);
    setWedgePlaced([]);
    setWedgeGhosts([]);
    setWedgeSolved(false);
    setWedgeHintUsed(false);
    setBrush(0);

    // Set fixed wedge parameters
    setK(L.k);
    setMetric(L.metric);
    setScheme(L.scheme);
    setBounds({ lo: [-3.2, -2.5], hi: [3.2, 2.5] });

    setFocus({ point: star, truth: null });
    setRevealed(true);
    setStatusText(L.blurb);
  }, []);

  // Mode switching
  const handleSetMode = (newMode: AppMode) => {
    if (newMode === mode) return;

    if (newMode === 'wedge') {
      // Save current parameters before locking in Wedge
      setSavedParams({ k, metric, scheme });
      setMode('wedge');
      loadWedgeLevel(levelIndex);
    } else {
      if (mode === 'wedge') {
        // Restore tunables when exiting Wedge
        setK(savedParams.k);
        setMetric(savedParams.metric);
        setScheme(savedParams.scheme);
      }
      setMode(newMode);
      setUserPoints([]);
      setRevealed(false);
      setFocus(null);
      initDataset(datasetName, hardMode);

      if (newMode === 'sandbox') {
        setStatusText('Sandbox: click anywhere on the plot to probe a point. Press a class button to add it as training data.');
      }
    }
  };

  // Next round in Play Mode
  const handleNextRound = useCallback(() => {
    if (mode !== 'play') return;
    let pool = [...testPool];
    if (pool.length === 0) {
      pool = rebuildTestPool(Xte, Xtr, ytr, nClasses, k, metric, scheme, hardMode);
    }
    if (pool.length > 0) {
      const nextIdx = pool.pop()!;
      setTestPool(pool);
      setFocus({ point: Xte[nextIdx], truth: yte[nextIdx] });
      setRevealed(false);
      setStatusText(`Which class does the mystery star belong to? (Choose 1-${nClasses})`);
    }
  }, [mode, testPool, rebuildTestPool, Xte, Xtr, ytr, nClasses, k, metric, scheme, hardMode, yte]);

  // Handle User Guess in Play Mode
  const handleGuess = useCallback(
    (c: number) => {
      if (mode !== 'play' || !focus || revealed || focus.truth === null) return;
      const truth = focus.truth;
      const q = queryPoint(focus.point, Xtr, ytr, nClasses, k, metric, scheme);
      const pk = q.pk;
      const pw = q.pw;

      // Update scores
      setScores((prev) => ({
        You: { correct: prev.You.correct + (c === truth ? 1 : 0), total: prev.You.total + 1 },
        kNN: { correct: prev.kNN.correct + (pk === truth ? 1 : 0), total: prev.kNN.total + 1 },
        wkNN: { correct: prev.wkNN.correct + (pw === truth ? 1 : 0), total: prev.wkNN.total + 1 },
      }));

      setRevealed(true);

      const tick = (ok: boolean) => (ok ? 'OK ✓' : 'X ✗');
      setStatusText(
        `Truth: ${NAMES[truth]}\n` +
          `You : ${NAMES[c]} (${tick(c === truth)})\n` +
          `kNN : ${NAMES[pk]} (${tick(pk === truth)}) [${fmtVotes(q.Pk, nClasses)}]\n` +
          `wkNN: ${NAMES[pw]} (${tick(pw === truth)}) [${fmtVotes(q.Pw, nClasses)}]`
      );

      // Celebration confetti if user guessed correctly
      if (c === truth) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: [COLORS[c], '#f2b705', '#17bebb'],
        });
      }
    },
    [mode, focus, revealed, Xtr, ytr, nClasses, k, metric, scheme, fmtVotes]
  );

  // Handle Class Button Click
  const handleClassClick = (c: number) => {
    if (c >= nClasses) return;

    if (mode === 'play') {
      handleGuess(c);
    } else if (mode === 'sandbox') {
      if (focus) {
        // Add probed point into training dataset
        setUserPoints((prev) => [...prev, { point: focus.point, cls: c }]);
        setStatusText(`Added a ${NAMES[c]} training point at (${focus.point[0].toFixed(2)}, ${focus.point[1].toFixed(2)}). Models refitted.`);
      }
    } else if (mode === 'wedge') {
      setBrush(c);
      setStatusText(`Placement brush: ${NAMES[c]}. Left-click on the canvas to place a point.`);
    }
  };

  // Wedge: Place point
  const handlePlaceWedge = useCallback(
    (pt: Point) => {
      const L = LEVELS[levelIndex];
      if (wedgeSolved) {
        setStatusText('Solved already! Undo / Reset to retry, or press Next Level >.');
        return;
      }
      if (wedgePlaced.length >= L.budget) {
        setStatusText('Out of points budget. Undo (or right-click) or Reset.');
        return;
      }

      const center: Point = [0, 0];
      const dToStar = mnorm([pt[0] - center[0], pt[1] - center[1]], L.metric);

      if (dToStar < L.r_min - 1e-9) {
        setStatusText(
          `Too close: the star is protected inside the grey no-go zone (distance ${dToStar.toFixed(3)} < ${L.r_min.toFixed(2)}).`
        );
        return;
      }

      const newPlaced = [...wedgePlaced, { point: pt, cls: brush }];
      setWedgePlaced(newPlaced);

      // Evaluate new state
      const currentX = [...XtrBase, ...newPlaced.map((p) => p.point)];
      const currentY = [...ytrCleanBase, ...newPlaced.map((p) => p.cls)];
      const q = queryPoint([0, 0], currentX, currentY, 2, L.k, L.metric, L.scheme);

      const isSolved = q.pk === L.goal[0] && q.pw === L.goal[1];
      const used = newPlaced.length;

      if (isSolved) {
        setWedgeSolved(true);
        const targetPar = par ?? used;
        let s = used <= targetPar ? 3 : used === targetPar + 1 ? 2 : 1;
        if (wedgeHintUsed) {
          s = Math.min(s, 1);
        }

        setWedgeStars((prev) => ({
          ...prev,
          [levelIndex]: Math.max(prev[levelIndex] || 0, s),
        }));

        setStatusText(
          `★ SOLVED with ${used} point(s), Par ${targetPar}!  Rating: ${'★'.repeat(s)}\n` +
            `kNN ➔ ${NAMES[q.pk]}, wkNN ➔ ${NAMES[q.pw]}. Inspect the table below: which neighbor changed rank, and why?`
        );

        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10b981', '#f59e0b', '#06b6d4', '#ec4899'],
        });
      } else {
        setStatusText(
          `Placed ${NAMES[brush]} at distance ${dToStar.toFixed(2)}. ` +
            `Now kNN ➔ ${NAMES[q.pk]}, wkNN ➔ ${NAMES[q.pw]}. Points left: ${L.budget - used}.`
        );
      }
    },
    [levelIndex, wedgeSolved, wedgePlaced, brush, XtrBase, ytrCleanBase, par, wedgeHintUsed]
  );

  // Wedge: Undo
  const handleUndoWedge = useCallback(() => {
    if (mode === 'wedge' && wedgePlaced.length > 0) {
      const newPlaced = wedgePlaced.slice(0, -1);
      setWedgePlaced(newPlaced);
      setWedgeSolved(false);

      const L = LEVELS[levelIndex];
      const currentX = [...XtrBase, ...newPlaced.map((p) => p.point)];
      const currentY = [...ytrCleanBase, ...newPlaced.map((p) => p.cls)];
      const q = queryPoint([0, 0], currentX, currentY, 2, L.k, L.metric, L.scheme);

      setStatusText(
        `Undone last placement. Now kNN ➔ ${NAMES[q.pk]}, wkNN ➔ ${NAMES[q.pw]}. Points left: ${L.budget - newPlaced.length}.`
      );
    }
  }, [mode, wedgePlaced, levelIndex, XtrBase, ytrCleanBase]);

  // Wedge: Reset level
  const handleResetLevel = () => {
    loadWedgeLevel(levelIndex);
  };

  // Wedge: Hint
  const handleHint = () => {
    if (mode !== 'wedge' || !parSolution) return;
    const L = LEVELS[levelIndex];
    const rng = new RNG(levelIndex);

    const ghosts = parSolution.map((sol) => {
      const ang = rng.uniform(0, 2 * Math.PI);
      const pt = atDistance([0, 0], sol.distance, ang, L.metric);
      return { point: pt, cls: sol.cls };
    });

    setWedgeGhosts(ghosts);
    setWedgeHintUsed(true);

    const solText = parSolution
      .map((s) => `${NAMES[s.cls]} at d = ${s.distance.toFixed(2)}`)
      .join(', ');

    setStatusText(
      `Hint: One Par-${par} solution is [${solText}].\n` +
        `Only distance matters, not the angle! (Rating for this level is now capped at 1 star).`
    );
  };

  // Canvas Click Handler
  const handleCanvasClick = (worldPt: Point, button: number) => {
    if (mode === 'wedge') {
      if (button === 2) {
        handleUndoWedge();
      } else {
        handlePlaceWedge(worldPt);
      }
    } else if (mode === 'sandbox') {
      // Probe clicked point
      setFocus({ point: worldPt, truth: null });
      setRevealed(true);
      const q = queryPoint(worldPt, Xtr, ytr, nClasses, k, metric, scheme);
      setStatusText(
        `Probed (${worldPt[0].toFixed(2)}, ${worldPt[1].toFixed(2)}):\n` +
          `kNN : ${NAMES[q.pk]} [${fmtVotes(q.Pk, nClasses)}]\n` +
          `wkNN: ${NAMES[q.pw]} [${fmtVotes(q.Pw, nClasses)}]\n` +
          `Press a class button (or keys 1-${nClasses}) to add this point as training data.`
      );
    }
  };

  // Hover Move Handler
  const handleHoverMove = useCallback(
    (worldPt: Point | null) => {
      if (!worldPt) {
        setHoverInfo('');
        return;
      }
      if (!focus) {
        setHoverInfo(`Cursor coordinate: (${worldPt[0].toFixed(2)}, ${worldPt[1].toFixed(2)})`);
        return;
      }

      const starPt = focus.point;
      const dToStar = dist(worldPt, starPt, metric);

      if (mode === 'wedge') {
        const L = LEVELS[levelIndex];
        if (dToStar < L.r_min - 1e-9) {
          setHoverInfo(
            `Cursor d = ${dToStar.toFixed(3)}  |  INSIDE NO-GO ZONE (d < ${L.r_min.toFixed(2)})`
          );
          return;
        }
      }

      if (cachedQuery && (revealed || mode === 'wedge')) {
        const dList = cachedQuery.d;
        // Search insertion rank
        let rank = 1;
        while (rank <= dList.length && dToStar > dList[rank - 1]) {
          rank++;
        }

        if (rank <= dList.length) {
          // If added, replaces the k-th neighbor
          const newD = [...dList.slice(0, -1), dToStar].sort((a, b) => a - b);
          const wAll = computeWeights(newD, scheme);
          const wCur = wAll[rank - 1];
          const sumW = wAll.reduce((acc, v) => acc + v, 0) || 1e-9;
          const share = Math.round((wCur / sumW) * 100);

          setHoverInfo(
            `Cursor d = ${dToStar.toFixed(3)}  |  Would enter at Rank #${rank}/${dList.length}  |  wkNN weight = ${wCur.toFixed(3)} (${share}% share)`
          );
        } else {
          setHoverInfo(
            `Cursor d = ${dToStar.toFixed(3)}  |  Outside k-th radius (d > ${dList[dList.length - 1].toFixed(3)}, ignored by top-${dList.length})`
          );
        }
      } else {
        setHoverInfo(`Cursor distance to star: d = ${dToStar.toFixed(3)} (${metric})`);
      }
    },
    [focus, metric, mode, levelIndex, cachedQuery, revealed, scheme]
  );

  // Canvas Title faithful to KNN.py
  const canvasTitle = useMemo(() => {
    if (mode === 'wedge') {
      const L = LEVELS[levelIndex];
      return `Wedge ${levelIndex + 1}/${LEVELS.length}: ${L.name}  |  k=${L.k}  |  ${L.metric}  |  wkNN=${L.scheme}`;
    }
    return `${datasetName}  |  k=${k}  |  ${metric}  |  wkNN=${scheme}`;
  }, [mode, levelIndex, datasetName, k, metric, scheme]);

  // Current predictions for Wedge Mode
  const currentPreds = useMemo(() => {
    if (cachedQuery) {
      return { pk: cachedQuery.pk, pw: cachedQuery.pw };
    }
    return null;
  }, [cachedQuery]);

  // Synchronize test pool on parameter change without wiping session data
  const handleSetK = (newK: number) => {
    setK(newK);
    if (mode === 'play') {
      const newPool = rebuildTestPool(Xte, Xtr, ytr, nClasses, newK, metric, scheme, hardMode);
      setTestPool(newPool);
    }
  };

  const handleSetMetric = (newMetric: Metric) => {
    setMetric(newMetric);
    if (mode === 'play') {
      const newPool = rebuildTestPool(Xte, Xtr, ytr, nClasses, k, newMetric, scheme, hardMode);
      setTestPool(newPool);
    }
  };

  const handleSetScheme = (newScheme: WeightingScheme) => {
    setScheme(newScheme);
    if (mode === 'play') {
      const newPool = rebuildTestPool(Xte, Xtr, ytr, nClasses, k, metric, newScheme, hardMode);
      setTestPool(newPool);
    }
  };

  const handleSetNoise = (newNoise: number) => {
    setNoise(newNoise);
    // When noise changes, compute updated noisy labels and re-order pool
    if (mode === 'play') {
      const noisy = [...ytrCleanBase];
      const frac = newNoise / 100;
      for (let i = 0; i < noisy.length; i++) {
        if (noiseU[i] < frac) {
          noisy[i] = (noisy[i] + noiseShift[i]) % nClasses;
        }
      }
      const newPool = rebuildTestPool(Xte, XtrBase, noisy, nClasses, k, metric, scheme, hardMode);
      setTestPool(newPool);
    }
  };

  const handleSetHardMode = (newHard: boolean) => {
    setHardMode(newHard);
    if (mode === 'play') {
      const newPool = rebuildTestPool(Xte, Xtr, ytr, nClasses, k, metric, scheme, newHard);
      setTestPool(newPool);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is focusing an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleNextRound();
      } else if (e.code === 'Backspace') {
        if (mode === 'wedge') {
          e.preventDefault();
          handleUndoWedge();
        }
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const c = parseInt(e.key) - 1;
        if (c >= 0 && c < nClasses) {
          e.preventDefault();
          handleClassClick(c);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextRound, handleUndoWedge, nClasses, mode, focus, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear sandbox points
  const handleClearUserPoints = useCallback(() => {
    setUserPoints([]);
    setStatusText('Cleared user-added sandbox training points. Models refitted.');
  }, []);

  return (
    <div className="h-[100dvh] bg-[#080c14] text-slate-100 flex flex-col font-sans overflow-hidden select-none">
      <Header />

      <main className="flex-1 min-h-0 min-w-0 w-full p-2.5 md:p-3 flex flex-col md:flex-row gap-2.5 md:gap-3 overflow-hidden">
        {/* Left Column: Canvas + Live Vote Table */}
        <div className="flex-1 min-h-0 min-w-0 w-full md:h-full flex flex-col gap-2.5 overflow-hidden">
          <ArenaCanvas
            mode={mode}
            Xtr={Xtr}
            ytr={ytr}
            nBase={nBase}
            C={nClasses}
            focus={focus}
            revealed={revealed}
            k={k}
            metric={metric}
            scheme={scheme}
            boundary={boundary}
            bounds={bounds}
            cachedQuery={cachedQuery}
            rMin={mode === 'wedge' ? LEVELS[levelIndex].r_min : undefined}
            ghosts={mode === 'wedge' ? wedgeGhosts : undefined}
            title={canvasTitle}
            onCanvasClick={handleCanvasClick}
            onHoverMove={handleHoverMove}
          />

          <VoteTable
            query={cachedQuery}
            revealed={revealed || mode === 'sandbox' || mode === 'wedge'}
            ytr={ytr}
            nBase={nBase}
            C={nClasses}
            hoverInfo={hoverInfo}
            baseTotals={baseTotals}
            isWedge={mode === 'wedge'}
          />
        </div>

        {/* Right Column: Full Control Panel */}
        <ControlPanel
          mode={mode}
          onSetMode={handleSetMode}
          dataset={datasetName}
          onSelectDataset={(d) => {
            setDatasetName(d);
            initDataset(d, hardMode);
          }}
          noise={noise}
          onSetNoise={handleSetNoise}
          hardMode={hardMode}
          onSetHardMode={handleSetHardMode}
          onNextRound={handleNextRound}
          onNewData={() => initDataset(datasetName, hardMode)}
          onResetScores={() =>
            setScores({
              You: { correct: 0, total: 0 },
              kNN: { correct: 0, total: 0 },
              wkNN: { correct: 0, total: 0 },
            })
          }
          scores={scores}
          levelIndex={levelIndex}
          onSelectLevel={loadWedgeLevel}
          onPrevLevel={() => loadWedgeLevel(levelIndex - 1)}
          onNextLevel={() => loadWedgeLevel(levelIndex + 1)}
          onUndoWedge={handleUndoWedge}
          onResetLevel={handleResetLevel}
          onHint={handleHint}
          wedgeStars={wedgeStars}
          placedCount={wedgePlaced.length}
          par={par}
          brush={brush}
          onSelectBrush={setBrush}
          currentPreds={currentPreds}
          k={k}
          onSetK={handleSetK}
          metric={metric}
          onSetMetric={handleSetMetric}
          scheme={scheme}
          onSetScheme={handleSetScheme}
          boundary={boundary}
          onSetBoundary={setBoundary}
          C={nClasses}
          onClassClick={handleClassClick}
          statusText={statusText}
          onClearUserPoints={handleClearUserPoints}
          userPointsCount={userPoints.length}
        />
      </main>
    </div>
  );
};

export default App;
