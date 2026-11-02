import React, { useState } from 'react';
import { Swords, BookOpen, X, Sparkles, Command } from 'lucide-react';

export const Header: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <header className="w-full h-[66px] flex-none bg-[#0e1420] border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-20 select-none">
        <div className="flex items-center gap-3">
          {/* Logo badge with restrained amber styling */}
          <div className="w-8 h-8 rounded-md bg-slate-950 border border-amber-500/30 flex items-center justify-center shadow-inner">
            <Swords className="w-4 h-4 text-amber-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                <span>KNN Arena</span>
                <span className="text-amber-400 font-semibold font-mono text-xs sm:text-sm">
                  kNN vs wkNN
                </span>
              </h1>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800/90 text-slate-300 border border-slate-700/70">
                v1.2 Desktop
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block leading-none mt-0.5 font-normal">
              Head-to-head machine learning game · Uniform voting vs distance-weighted voting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Subtle keyboard shortcuts hint for desktop users */}
          <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-md border border-slate-800/80">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-slate-800 text-slate-200 rounded text-[10px] border border-slate-700">Space</kbd> Next
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-slate-800 text-slate-200 rounded text-[10px] border border-slate-700">1-4</kbd> Guess
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-slate-800 text-slate-200 rounded text-[10px] border border-slate-700">Bksp</kbd> Undo
            </span>
          </div>

          {/* Guide & Math button */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors shadow-sm active:scale-[0.98]"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Guide &amp; Math</span>
          </button>
        </div>
      </header>

      {/* Guide & Mathematical Reference Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full p-5 max-h-[85vh] overflow-y-auto text-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close guide"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4 text-amber-400 border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-base sm:text-lg font-bold">KNN Arena — Master Guide & Reference</h2>
            </div>

            <div className="space-y-3.5 text-xs leading-relaxed text-slate-300">
              <section className="bg-slate-950/70 p-3 rounded-md border border-slate-800/80">
                <h3 className="font-semibold text-amber-400 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  1. Uniform kNN vs Weighted kNN (wkNN)
                </h3>
                <p>
                  <strong className="text-slate-100">Standard kNN:</strong> Counts votes uniformly among the $k$ nearest training points.
                  Every neighbor receives an identical vote weight ($w_i = 1.0$), regardless of whether it is 0.05 or 2.5 distance units away.
                </p>
                <p className="mt-1">
                  <strong className="text-slate-100">Weighted kNN (wkNN):</strong> Scales voting influence inversely with distance.
                  A single close neighbor can easily outvote several distant neighbors belonging to another class!
                </p>
              </section>

              <section className="bg-slate-950/70 p-3 rounded-md border border-slate-800/80">
                <h3 className="font-semibold text-sky-400 text-xs uppercase tracking-wider mb-1">
                  2. Weighting Schemes for wkNN
                </h3>
                <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
                  <li>
                    <strong className="text-slate-100">1 / distance (inverse):</strong> $w_i = 1 / (d_i + \epsilon)$
                  </li>
                  <li>
                    <strong className="text-slate-100">1 / dist² (inverse sq):</strong> $w_i = 1 / (d_i^2 + \epsilon)$ — steep falloff with distance.
                  </li>
                  <li>
                    <strong className="text-slate-100">Gaussian (dk):</strong> $w_i = \exp\left(-3 \cdot (d_i / h)^2\right)$, where bandwidth $h = d_k$ (the distance to the $k$-th neighbor).
                  </li>
                </ul>
              </section>

              <section className="bg-slate-950/70 p-3 rounded-md border border-slate-800/80">
                <h3 className="font-semibold text-rose-400 text-xs uppercase tracking-wider mb-1">
                  3. Distance Metrics & Ball Contours
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-white block">Euclidean (L2)</strong>
                    <span className="font-mono text-[10px]">&radic;(dx&sup2; + dy&sup2;)</span>
                    <span className="block text-slate-400 mt-0.5 text-[10px]">Contours: Circles</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-white block">Manhattan (L1)</strong>
                    <span className="font-mono text-[10px]">|dx| + |dy|</span>
                    <span className="block text-slate-400 mt-0.5 text-[10px]">Contours: Diamonds</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-white block">Chebyshev (L&infin;)</strong>
                    <span className="font-mono text-[10px]">max(|dx|, |dy|)</span>
                    <span className="block text-slate-400 mt-0.5 text-[10px]">Contours: Squares</span>
                  </div>
                </div>
              </section>

              <section className="bg-slate-950/70 p-3 rounded-md border border-slate-800/80">
                <h3 className="font-semibold text-emerald-400 text-xs uppercase tracking-wider mb-1">
                  4. Game Modes
                </h3>
                <p>
                  <strong className="text-slate-100">PLAY:</strong> Guess the mystery star's true class! See how kNN and wkNN vote, and test your intuition against both models.
                </p>
                <p className="mt-1">
                  <strong className="text-slate-100">SANDBOX:</strong> Click anywhere on the arena to probe a point, inspect neighbor distances, and add custom points to watch decision boundaries react.
                </p>
                <p className="mt-1">
                  <strong className="text-slate-100">WEDGE PUZZLES:</strong> 7 brain-teaser puzzle levels where you strategically place points outside the protected no-go zone to force kNN and wkNN to disagree in specific target configurations!
                </p>
              </section>

              <section className="bg-slate-950/70 p-3 rounded-md border border-slate-800/80 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                    <Command className="w-3.5 h-3.5 text-amber-400" />
                    Keyboard Shortcuts
                  </h3>
                  <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                    <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white">Space</kbd> Next Round</span>
                    <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white">1 - 4</kbd> Choose Class</span>
                    <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white">Backspace</kbd> Undo</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-3.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                >
                  Got It
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
