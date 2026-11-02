import React, { useState } from 'react';
import {
  AppMode,
  BackgroundMode,
  Metric,
  WeightingScheme,
} from '../knn/types';
import { DATASETS, DatasetName } from '../knn/datasets';
import { COLORS, NAMES } from '../knn/engine';
import { LEVELS } from '../knn/levels';
import {
  RotateCcw,
  Sparkles,
  HelpCircle,
  Undo2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Droplets,
  Sun,
  Leaf,
  Trophy,
  Swords,
  Layers,
  Crosshair,
  Sliders,
  Lock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

interface ScoreRecord {
  correct: number;
  total: number;
}

interface ControlPanelProps {
  mode: AppMode;
  onSetMode: (mode: AppMode) => void;
  // Play mode state
  dataset: DatasetName;
  onSelectDataset: (d: DatasetName) => void;
  noise: number;
  onSetNoise: (n: number) => void;
  hardMode: boolean;
  onSetHardMode: (v: boolean) => void;
  onNextRound: () => void;
  onNewData: () => void;
  onResetScores: () => void;
  scores: { You: ScoreRecord; kNN: ScoreRecord; wkNN: ScoreRecord };
  levelIndex: number;
  onSelectLevel: (lvl: number) => void;
  onPrevLevel: () => void;
  onNextLevel: () => void;
  onUndoWedge: () => void;
  onResetLevel: () => void;
  onHint: () => void;
  wedgeStars: Record<number, number>;
  placedCount: number;
  par: number | null;
  brush: number;
  onSelectBrush: (b: number) => void;
  currentPreds?: { pk: number; pw: number } | null;
  // Tunables
  k: number;
  onSetK: (k: number) => void;
  metric: Metric;
  onSetMetric: (m: Metric) => void;
  scheme: WeightingScheme;
  onSetScheme: (s: WeightingScheme) => void;
  // Background
  boundary: BackgroundMode;
  onSetBoundary: (b: BackgroundMode) => void;
  // Class buttons
  C: number;
  onClassClick: (c: number) => void;
  statusText: string;
  onClearUserPoints?: () => void;
  userPointsCount?: number;
}

const CLASS_ICONS = [Flame, Droplets, Sun, Leaf];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  mode,
  onSetMode,
  dataset,
  onSelectDataset,
  noise,
  onSetNoise,
  hardMode,
  onSetHardMode,
  onNextRound,
  onNewData,
  onResetScores,
  scores,
  levelIndex,
  onSelectLevel,
  onPrevLevel,
  onNextLevel,
  onUndoWedge,
  onResetLevel,
  onHint,
  wedgeStars,
  placedCount,
  par,
  brush,
  onSelectBrush,
  currentPreds,
  k,
  onSetK,
  metric,
  onSetMetric,
  scheme,
  onSetScheme,
  boundary,
  onSetBoundary,
  C,
  onClassClick,
  statusText,
  onClearUserPoints,
  userPointsCount = 0,
}) => {
  const currentLevel = LEVELS[levelIndex];
  const isWedge = mode === 'wedge';
  const [algoExpanded, setAlgoExpanded] = useState<boolean>(true);

  return (
    <div className="w-full lg:w-[330px] xl:w-[360px] flex-none lg:h-full bg-[#0e1420] border border-slate-800/80 rounded-lg flex flex-col overflow-hidden select-none text-xs shadow-sm">
      {/* 1. Mode Switcher (Segmented Control) */}
      <div className="flex-none p-1.5 border-b border-slate-800/70 bg-slate-950/40">
        <div className="bg-slate-950/90 border border-slate-800/80 p-0.5 rounded-md flex items-center gap-0.5">
          <button
            onClick={() => onSetMode('play')}
            className={`flex-1 py-1.5 px-2 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
              mode === 'play'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Play
          </button>
          <button
            onClick={() => onSetMode('sandbox')}
            className={`flex-1 py-1.5 px-2 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
              mode === 'sandbox'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            Sandbox
          </button>
          <button
            onClick={() => onSetMode('wedge')}
            className={`flex-1 py-1.5 px-2 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
              mode === 'wedge'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Wedge Puzzles
          </button>
        </div>
      </div>

      {/* 2. Primary Mode Section */}
      {isWedge ? (
        /* Wedge Puzzle Controls */
        <div className="flex-none p-2 border-b border-slate-800/70 flex flex-col gap-1.5">
          {/* Level Header with Stars */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Level {levelIndex + 1} of {LEVELS.length}
              </span>
              <h3 className="font-bold text-xs text-slate-100 leading-tight">
                {currentLevel.name}
              </h3>
            </div>
            {/* Stars */}
            <div className="flex items-center gap-0.5 text-amber-400 text-sm">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={i < (wedgeStars[levelIndex] || 0) ? 'opacity-100' : 'opacity-25'}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* Quick Level Selector Strip */}
          <div className="flex items-center justify-between gap-1">
            <button
              onClick={onPrevLevel}
              className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Previous Level"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 flex items-center justify-between px-1 bg-slate-950/70 rounded border border-slate-800/80 py-0.5">
              {LEVELS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSelectLevel(i)}
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold transition ${
                    i === levelIndex
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {i + 1}
                  {wedgeStars[i] ? <span className="text-amber-400 ml-0.5">★</span> : ''}
                </button>
              ))}
            </div>
            <button
              onClick={onNextLevel}
              className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Next Level"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Telemetry 2x2 HUD */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Goal</span>
              <div className="font-semibold flex items-center gap-1 mt-0.5">
                <span style={{ color: COLORS[currentLevel.goal[0]] }}>
                  {NAMES[currentLevel.goal[0]]}
                </span>
                <span className="text-slate-600">/</span>
                <span style={{ color: COLORS[currentLevel.goal[1]] }}>
                  {NAMES[currentLevel.goal[1]]}
                </span>
              </div>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Now</span>
              <div className="font-semibold flex items-center gap-1 mt-0.5">
                {currentPreds ? (
                  <>
                    <span style={{ color: COLORS[currentPreds.pk] }}>
                      {NAMES[currentPreds.pk]}
                    </span>
                    <span className="text-slate-600">/</span>
                    <span style={{ color: COLORS[currentPreds.pw] }}>
                      {NAMES[currentPreds.pw]}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Placed / Budget</span>
              <span className="font-semibold text-slate-200">
                {placedCount} / {currentLevel.budget}
                <span className="text-slate-400 font-normal ml-1">(Par {par ?? '?'})</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Protected Radius</span>
              <span className="font-semibold text-amber-400">
                d &ge; {currentLevel.r_min.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Wedge Actions */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={onUndoWedge}
              disabled={placedCount === 0}
              className="py-1 px-2 bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded text-xs font-medium flex items-center justify-center gap-1 border border-slate-700/60 transition"
            >
              <Undo2 className="w-3 h-3" />
              Undo
            </button>
            <button
              onClick={onResetLevel}
              className="py-1 px-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center justify-center gap-1 border border-slate-700/60 transition"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button
              onClick={onHint}
              className="py-1 px-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 rounded text-xs font-medium flex items-center justify-center gap-1 transition"
            >
              <HelpCircle className="w-3 h-3 text-indigo-400" />
              Hint
            </button>
          </div>
        </div>
      ) : (
        /* Play / Sandbox Controls */
        <div className="flex-none p-2 border-b border-slate-800/70 flex flex-col gap-1.5">
          {/* Dataset Selector + Live Noise Slider in 2 Columns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                Dataset
              </label>
              <select
                value={dataset}
                onChange={(e) => onSelectDataset(e.target.value as DatasetName)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
              >
                {Object.keys(DATASETS).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                <span>Label Noise</span>
                <span className="text-amber-400 font-mono font-bold">{noise}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="35"
                value={noise}
                onChange={(e) => onSetNoise(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-950 rounded"
              />
            </div>
          </div>

          {/* Hard Mode Checkbox (Play mode only) */}
          {mode === 'play' && (
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 py-0.5">
              <input
                type="checkbox"
                checked={hardMode}
                onChange={(e) => onSetHardMode(e.target.checked)}
                className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Prioritize contested / disagreement points</span>
            </label>
          )}

          {/* Play / Sandbox Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {mode === 'play' && (
              <button
                onClick={onNextRound}
                className="py-1 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
              >
                Next (Space)
              </button>
            )}
            <button
              onClick={onNewData}
              className={`py-1 px-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition flex items-center justify-center gap-1 border border-slate-700/60 ${
                mode !== 'play' ? (onClearUserPoints && userPointsCount > 0 ? 'col-span-2' : 'col-span-3') : ''
              }`}
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              New Data
            </button>
            {mode === 'play' && (
              <button
                onClick={onResetScores}
                className="py-1 px-2 bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 rounded text-xs font-medium transition flex items-center justify-center gap-1 border border-slate-700/40"
              >
                Reset Scores
              </button>
            )}
            {mode === 'sandbox' && onClearUserPoints && userPointsCount > 0 && (
              <button
                onClick={onClearUserPoints}
                className="py-1 px-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded text-xs font-medium transition flex items-center justify-center gap-1 border border-rose-800/50"
                title="Clear user-added sandbox points"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                Clear ({userPointsCount})
              </button>
            )}
          </div>

          {/* Integrated Scoreboard HUD (Play mode only) */}
          {mode === 'play' && (
            <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80 font-mono text-[11px] flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-slate-500 font-bold border-b border-slate-800/80 pb-0.5 text-[10px]">
                <span className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  SCOREBOARD
                </span>
                <span>Accuracy</span>
              </div>
              {(['You', 'kNN', 'wkNN'] as const).map((name) => {
                const s = scores[name];
                const pct = s.total ? Math.round((s.correct / s.total) * 100) : null;
                const colorClass =
                  name === 'You'
                    ? 'text-amber-400'
                    : name === 'kNN'
                    ? 'text-sky-400'
                    : 'text-indigo-400';

                return (
                  <div key={name} className="flex items-center justify-between py-0.2">
                    <span className="font-semibold text-slate-300 w-10">{name}</span>
                    <span className="text-slate-400">
                      {s.total ? `${s.correct}/${s.total}` : '-'}
                    </span>
                    <span className={`font-bold w-12 text-right ${colorClass}`}>
                      {pct !== null ? `${pct}%` : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Class Buttons (Your Answer / Brush / Add Point) */}
      <div className="flex-none p-2 border-b border-slate-800/70 flex flex-col gap-1">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>
            {mode === 'play'
              ? 'Your Answer (Keys 1-4)'
              : mode === 'sandbox'
              ? 'Add Point to Dataset'
              : 'Placement Brush (Keys 1-2)'}
          </span>
          <span className="text-slate-500 text-[9px] font-mono">1-{C}</span>
        </div>

        {/* 2 columns grid prevents label truncation even with 4 classes */}
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: C }).map((_, c) => {
            const Icon = CLASS_ICONS[c] || Sparkles;
            const isBrushActive = isWedge && brush === c;

            return (
              <button
                key={c}
                onClick={() => (isWedge ? onSelectBrush(c) : onClassClick(c))}
                style={{
                  backgroundColor: COLORS[c],
                  color: c === 2 ? '#0f172a' : '#ffffff',
                }}
                className={`py-1.5 px-2 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-sm ${
                  isBrushActive
                    ? 'ring-2 ring-white scale-[1.02]'
                    : 'hover:brightness-110 opacity-95'
                }`}
                title={`Select ${NAMES[c]} [Key ${c + 1}]`}
              >
                <Icon className="w-3.5 h-3.5 flex-none" />
                <span className="truncate">
                  [{c + 1}] {NAMES[c]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Algorithm & Background Configuration */}
      <div className="flex-none p-2 border-b border-slate-800/70 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => !isWedge && setAlgoExpanded((prev) => !prev)}
            className={`text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 transition ${
              !isWedge ? 'hover:text-slate-200' : 'cursor-default'
            }`}
          >
            <Sliders className="w-3 h-3 text-slate-400" />
            <span>Algorithm Configuration</span>
            {!isWedge && (
              algoExpanded ? (
                <ChevronUp className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-500" />
              )
            )}
          </button>
          {isWedge && (
            <span className="text-[9px] text-amber-400/90 font-mono flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" /> Locked by Level
            </span>
          )}
          {!isWedge && !algoExpanded && (
            <span className="text-[9px] font-mono text-sky-400">
              k={k} · {metric[0].toUpperCase()} · {scheme === 'inverse' ? 'inv' : scheme === 'inverse_sq' ? 'inv²' : 'gauss'}
            </span>
          )}
        </div>

        {/* Algorithm controls (k slider, Metric, Scheme) */}
        {(algoExpanded || isWedge) && (
          <div className="flex flex-col gap-1.5">
            {/* Tunables: locked in Wedge mode, editable in Play/Sandbox */}
            <div className={`flex flex-col gap-1.5 ${isWedge ? 'opacity-60 pointer-events-none' : ''}`}>
              {/* k Slider */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  <span>k (Neighbours)</span>
                  <span className="text-sky-400 font-mono font-bold">{k}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="31"
                  step="1"
                  value={k}
                  onChange={(e) => onSetK(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-950 rounded"
                />
              </div>

              {/* 2-Column: Distance Metric & wkNN Scheme */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Distance Metric
                  </label>
                  <select
                    value={metric}
                    onChange={(e) => onSetMetric(e.target.value as Metric)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
                  >
                    <option value="euclidean">Euclidean (L2)</option>
                    <option value="manhattan">Manhattan (L1)</option>
                    <option value="chebyshev">Chebyshev (L∞)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    wkNN Weighting
                  </label>
                  <select
                    value={scheme}
                    onChange={(e) => onSetScheme(e.target.value as WeightingScheme)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
                  >
                    <option value="inverse">1 / distance</option>
                    <option value="inverse_sq">1 / dist²</option>
                    <option value="gaussian">Gaussian (dk)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Decision Boundary Segmented Bar (ALWAYS INTERACTIVE, even in Wedge mode!) */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                <Layers className="w-3 h-3 text-slate-400" />
                Decision Regions
              </label>
              <div className="grid grid-cols-4 gap-1 text-[10px] font-medium">
                {[
                  { id: 'none', label: 'Off' },
                  { id: 'knn', label: 'kNN' },
                  { id: 'wknn', label: 'wkNN' },
                  { id: 'disagree', label: 'Diff (!)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSetBoundary(item.id as BackgroundMode)}
                    className={`py-1 rounded text-center transition border ${
                      boundary === item.id
                        ? 'bg-slate-800 text-sky-400 border-sky-500/60 font-bold'
                        : 'bg-slate-950/70 text-slate-400 border-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Game Feedback & Telemetry Output */}
      <div className="flex-1 min-h-[50px] p-2 bg-slate-950/60 flex flex-col overflow-hidden">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 flex-none">
          Telemetry & Feedback
        </div>
        <div className="font-mono text-[11px] whitespace-pre-line text-slate-300 leading-tight overflow-y-auto flex-1">
          {statusText || 'Select an action or probe the canvas to begin.'}
        </div>
      </div>
    </div>
  );
};
