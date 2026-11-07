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
  k: number;
  onSetK: (k: number) => void;
  metric: Metric;
  onSetMetric: (m: Metric) => void;
  scheme: WeightingScheme;
  onSetScheme: (s: WeightingScheme) => void;
  boundary: BackgroundMode;
  onSetBoundary: (b: BackgroundMode) => void;
  C: number;
  onClassClick: (c: number) => void;
  statusText: string;
  onClearUserPoints?: () => void;
  userPointsCount?: number;
}

const CLASS_ICONS = [Flame, Droplets, Sun, Leaf];

/* ── Shared select style ── */
const selectCls =
  'w-full bg-slate-950 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all font-medium appearance-none';

/* ── Shared section divider ── */
const Divider = () => <div className="h-px bg-slate-800/60 mx-0" />;

/* ── Section label ── */
const SLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none">
    {children}
  </span>
);

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
    <div className="w-full md:w-[320px] xl:w-[348px] flex-none md:h-full bg-[#0d1424] border border-slate-800/60 rounded-xl flex flex-col overflow-hidden select-none text-xs shadow-lg ring-1 ring-white/[0.04]">

      {/* ── 1. Mode Switcher ── */}
      <div className="flex-none p-2 bg-slate-950/30">
        <div className="bg-slate-950/70 border border-slate-800/60 p-1 rounded-lg flex gap-0.5">
          {([
            { id: 'play' as AppMode, label: 'Play', icon: Swords, active: 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)]' },
            { id: 'sandbox' as AppMode, label: 'Sandbox', icon: Crosshair, active: 'bg-sky-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.3)]' },
            { id: 'wedge' as AppMode, label: 'Puzzles', icon: Sparkles, active: 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.3)]' },
          ] as const).map(({ id, label, icon: Icon, active }) => (
            <button
              key={id}
              onClick={() => onSetMode(id)}
              className={`flex-1 py-1.5 px-1 rounded-md font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all duration-200 ${
                mode === id ? active : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-3 h-3 flex-none" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── 2. Mode-specific section ── */}
      <div className="flex-none overflow-y-auto">
        {isWedge ? (
          /* Wedge Puzzle Controls */
          <div className="p-3 flex flex-col gap-3">
            {/* Level Header */}
            <div className="flex items-start justify-between">
              <div>
                <SLabel>Level {levelIndex + 1} of {LEVELS.length}</SLabel>
                <h3 className="font-bold text-[13px] text-slate-100 mt-0.5 leading-tight">
                  {currentLevel.name}
                </h3>
              </div>
              {/* Stars */}
              <div className="flex items-center gap-0.5 mt-0.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-[16px] leading-none transition-opacity ${i < (wedgeStars[levelIndex] || 0) ? 'text-amber-400 opacity-100' : 'text-slate-700 opacity-100'}`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            {/* Level Selector */}
            <div className="flex items-center gap-1">
              <button
                onClick={onPrevLevel}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border border-slate-700/40 transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 grid grid-cols-7 gap-0.5 bg-slate-900/60 rounded-lg p-1 border border-slate-800/40">
                {LEVELS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectLevel(i)}
                    className={`h-6 rounded-md font-mono font-bold text-[10px] transition-all relative ${
                      i === levelIndex
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    {i + 1}
                    {wedgeStars[i] ? (
                      <span className="absolute -top-0.5 -right-0.5 text-[8px] text-amber-400">★</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                onClick={onNextLevel}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border border-slate-700/40 transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Telemetry HUD */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: 'Goal',
                  content: (
                    <div className="flex items-center gap-1.5 font-mono text-[12px] font-semibold mt-0.5">
                      <span style={{ color: COLORS[currentLevel.goal[0]] }}>{NAMES[currentLevel.goal[0]]}</span>
                      <span className="text-slate-600">/</span>
                      <span style={{ color: COLORS[currentLevel.goal[1]] }}>{NAMES[currentLevel.goal[1]]}</span>
                    </div>
                  ),
                },
                {
                  label: 'Now',
                  content: (
                    <div className="flex items-center gap-1.5 font-mono text-[12px] font-semibold mt-0.5">
                      {currentPreds ? (
                        <>
                          <span style={{ color: COLORS[currentPreds.pk] }}>{NAMES[currentPreds.pk]}</span>
                          <span className="text-slate-600">/</span>
                          <span style={{ color: COLORS[currentPreds.pw] }}>{NAMES[currentPreds.pw]}</span>
                        </>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </div>
                  ),
                },
                {
                  label: 'Placed / Budget',
                  content: (
                    <span className="font-mono text-[12px] font-semibold text-slate-200 mt-0.5 block">
                      {placedCount} / {currentLevel.budget}
                      <span className="text-slate-500 font-normal ml-1.5 text-[11px]">Par {par ?? '?'}</span>
                    </span>
                  ),
                },
                {
                  label: 'Min Distance',
                  content: (
                    <span className="font-mono text-[12px] font-semibold text-amber-400 mt-0.5 block">
                      d ≥ {currentLevel.r_min.toFixed(2)}
                    </span>
                  ),
                },
              ].map(({ label, content }) => (
                <div key={label} className="bg-slate-900/50 rounded-lg px-2.5 py-2 border border-slate-800/40">
                  <SLabel>{label}</SLabel>
                  {content}
                </div>
              ))}
            </div>

            {/* Wedge Action Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={onUndoWedge}
                disabled={placedCount === 0}
                className="py-1.5 px-2 bg-slate-800/60 hover:bg-slate-700/80 disabled:opacity-35 disabled:cursor-not-allowed text-slate-300 hover:text-slate-100 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border border-slate-700/40 transition-all"
              >
                <Undo2 className="w-3 h-3" />
                Undo
              </button>
              <button
                onClick={onResetLevel}
                className="py-1.5 px-2 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border border-slate-700/40 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={onHint}
                className="py-1.5 px-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 border border-indigo-500/25 hover:border-indigo-500/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
              >
                <HelpCircle className="w-3 h-3 text-indigo-400" />
                Hint
              </button>
            </div>
          </div>
        ) : (
          /* Play / Sandbox Controls */
          <div className="p-3 flex flex-col gap-3">
            {/* Dataset & Noise */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <SLabel>Dataset</SLabel>
                <select
                  value={dataset}
                  onChange={(e) => onSelectDataset(e.target.value as DatasetName)}
                  className={selectCls}
                >
                  {Object.keys(DATASETS).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <SLabel>Label Noise</SLabel>
                  <span className="text-[11px] font-mono font-bold text-amber-400 leading-none">{noise}%</span>
                </div>
                <div className="flex items-center mt-1">
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={noise}
                    onChange={(e) => onSetNoise(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Hard Mode */}
            {mode === 'play' && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex-none">
                  <input
                    type="checkbox"
                    checked={hardMode}
                    onChange={(e) => onSetHardMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 rounded-full bg-slate-800 peer-checked:bg-amber-500/80 border border-slate-700/60 peer-checked:border-amber-500/60 transition-all" />
                  <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-slate-400 peer-checked:bg-white peer-checked:translate-x-4 transition-all shadow-sm" />
                </div>
                <span className="text-[12px] text-slate-400 group-hover:text-slate-300 transition-colors leading-none">
                  Prioritize contested / disagreement points
                </span>
              </label>
            )}

            {/* Action Buttons */}
            <div className="flex gap-1.5">
              {mode === 'play' && (
                <button
                  onClick={onNextRound}
                  className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[12px] font-bold transition-all duration-150 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-[0.97]"
                >
                  Next (Space)
                </button>
              )}
              <button
                onClick={onNewData}
                className={`py-2 px-3 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 border border-slate-700/40 active:scale-[0.97] ${
                  mode !== 'play' ? 'flex-1' : ''
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                New Data
              </button>
              {mode === 'play' && (
                <button
                  onClick={onResetScores}
                  className="py-2 px-3 bg-slate-900/60 hover:bg-slate-800/80 text-slate-500 hover:text-slate-300 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 border border-slate-800/60 active:scale-[0.97]"
                >
                  Reset
                </button>
              )}
              {mode === 'sandbox' && onClearUserPoints && userPointsCount > 0 && (
                <button
                  onClick={onClearUserPoints}
                  className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 border border-rose-500/20 hover:border-rose-500/30 active:scale-[0.97]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear ({userPointsCount})
                </button>
              )}
            </div>

            {/* Scoreboard — Play mode only */}
            {mode === 'play' && (
              <div className="bg-slate-900/50 rounded-lg border border-slate-800/40 overflow-hidden">
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-800/40">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SCOREBOARD</span>
                  </div>
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">Accuracy</span>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {(['You', 'kNN', 'wkNN'] as const).map((name) => {
                    const s = scores[name];
                    const pct = s.total ? Math.round((s.correct / s.total) * 100) : null;
                    const accent = name === 'You' ? 'text-amber-400' : name === 'kNN' ? 'text-sky-400' : 'text-indigo-400';
                    const bar = name === 'You' ? 'bg-amber-500' : name === 'kNN' ? 'bg-sky-500' : 'bg-indigo-500';

                    return (
                      <div key={name} className="flex items-center gap-2 px-3 py-1.5">
                        <span className={`font-bold text-[12px] w-9 ${accent}`}>{name}</span>
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          {pct !== null && (
                            <div className={`h-full ${bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono w-14 text-right">
                          {s.total ? `${s.correct}/${s.total}` : '—'}
                        </span>
                        <span className={`text-[12px] font-bold font-mono w-9 text-right ${accent}`}>
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Divider />

      {/* ── 3. Class Buttons ── */}
      <div className="flex-none p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SLabel>
            {mode === 'play' ? 'Your Answer' : mode === 'sandbox' ? 'Add Point' : 'Brush'}
          </SLabel>
          <span className="text-[10px] font-mono text-slate-600">Keys 1–{C}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: C }).map((_, c) => {
            const Icon = CLASS_ICONS[c] || Sparkles;
            const isBrushActive = isWedge && brush === c;
            const isLight = c === 2; // Sun (yellow) needs dark text

            return (
              <button
                key={c}
                onClick={() => (isWedge ? onSelectBrush(c) : onClassClick(c))}
                style={{
                  backgroundColor: isBrushActive ? COLORS[c] : `${COLORS[c]}18`,
                  borderColor: isBrushActive ? COLORS[c] : `${COLORS[c]}40`,
                  color: isBrushActive ? (isLight ? '#0f172a' : '#ffffff') : COLORS[c],
                }}
                className={`py-2 px-2 rounded-lg font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all duration-150 border active:scale-[0.97] ${
                  isBrushActive
                    ? 'shadow-md scale-[1.02]'
                    : 'hover:brightness-125'
                }`}
                title={`[${c + 1}] ${NAMES[c]}`}
              >
                <Icon className="w-3.5 h-3.5 flex-none" />
                <span className="truncate">[{c + 1}] {NAMES[c]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ── 4. Algorithm Configuration ── */}
      <div className="flex-none p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => !isWedge && setAlgoExpanded((p) => !p)}
            className={`flex items-center gap-1.5 transition-colors ${!isWedge ? 'hover:text-slate-300 cursor-pointer' : 'cursor-default'}`}
          >
            <Sliders className="w-3 h-3 text-slate-500" />
            <SLabel>Algorithm</SLabel>
            {!isWedge && (
              algoExpanded
                ? <ChevronUp className="w-3 h-3 text-slate-600" />
                : <ChevronDown className="w-3 h-3 text-slate-600" />
            )}
          </button>
          {isWedge ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-500/70 font-mono">
              <Lock className="w-2.5 h-2.5" />
              Locked by Level
            </span>
          ) : !algoExpanded ? (
            <span className="text-[10px] font-mono text-sky-500/80">
              k={k} · {metric[0].toUpperCase()} · {scheme === 'inverse' ? '1/d' : scheme === 'inverse_sq' ? '1/d²' : 'gauss'}
            </span>
          ) : null}
        </div>

        {(algoExpanded || isWedge) && (
          <div className={`flex flex-col gap-2.5 ${isWedge ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* k slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <SLabel>k (Neighbours)</SLabel>
                <span className="text-[12px] font-mono font-bold text-sky-400 leading-none">{k}</span>
              </div>
              <input
                type="range"
                min="1"
                max="31"
                step="1"
                value={k}
                onChange={(e) => onSetK(parseInt(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            {/* Metric & Scheme */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <SLabel>Distance Metric</SLabel>
                <select
                  value={metric}
                  onChange={(e) => onSetMetric(e.target.value as Metric)}
                  className={selectCls}
                >
                  <option value="euclidean">Euclidean (L2)</option>
                  <option value="manhattan">Manhattan (L1)</option>
                  <option value="chebyshev">Chebyshev (L∞)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <SLabel>wkNN Weighting</SLabel>
                <select
                  value={scheme}
                  onChange={(e) => onSetScheme(e.target.value as WeightingScheme)}
                  className={selectCls}
                >
                  <option value="inverse">1 / distance</option>
                  <option value="inverse_sq">1 / dist²</option>
                  <option value="gaussian">Gaussian (dk)</option>
                </select>
              </div>
            </div>

            {/* Decision Regions */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-slate-500" />
                <SLabel>Decision Regions</SLabel>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {([
                  { id: 'none', label: 'Off' },
                  { id: 'knn', label: 'kNN' },
                  { id: 'wknn', label: 'wkNN' },
                  { id: 'disagree', label: 'Diff (!)' },
                ] as { id: BackgroundMode; label: string }[]).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSetBoundary(item.id)}
                    className={`py-1.5 rounded-lg text-center text-[11px] font-semibold transition-all border ${
                      boundary === item.id
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                        : 'bg-slate-900/40 text-slate-500 border-slate-800/40 hover:text-slate-300 hover:border-slate-700/60'
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

      <Divider />

      {/* ── 5. Status / Telemetry ── */}
      <div className="flex-1 min-h-[48px] p-3 bg-slate-950/30 flex flex-col gap-1 overflow-hidden">
        <SLabel>Status</SLabel>
        <p className="font-mono text-[11px] text-slate-400 leading-relaxed overflow-y-auto whitespace-pre-line flex-1">
          {statusText || 'Select an action or probe the canvas to begin.'}
        </p>
      </div>
    </div>
  );
};
