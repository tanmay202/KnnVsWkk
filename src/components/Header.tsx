import React, { useState } from 'react';
import { Swords, BookOpen, X, Sparkles, Command, FileText } from 'lucide-react';

export const Header: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <header className="w-full h-14 flex-none bg-[#0d1424] border-b border-slate-800/60 px-4 md:px-6 flex items-center justify-between z-20 select-none shadow-[0_1px_0_0_rgba(148,163,184,0.06)]">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/25 flex items-center justify-center shadow-inner">
            <Swords className="w-4 h-4 text-amber-400" />
          </div>

          <div className="flex items-baseline gap-2.5">
            <h1 className="text-[15px] font-bold tracking-tight text-white leading-none">
              KNN Arena
            </h1>
            <span className="text-amber-400/90 font-mono text-[11px] font-medium leading-none hidden sm:block">
              kNN vs wkNN
            </span>
            <span className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700/60 leading-none">
              v1.2
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Keyboard hint — desktop only */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono text-slate-500 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
            {[
              { key: 'Space', label: 'Next' },
              { key: '1–4', label: 'Guess' },
              { key: 'Bksp', label: 'Undo' },
            ].map(({ key, label }, i, arr) => (
              <React.Fragment key={key}>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] border border-slate-700/80 font-sans leading-none">
                    {key}
                  </kbd>
                  <span className="text-slate-400">{label}</span>
                </span>
                {i < arr.length - 1 && <span className="text-slate-700">·</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Documentation button */}
          <a
            href="./knnwknn.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 text-[12px] font-medium border border-slate-700/60 hover:border-slate-600/60 transition-all duration-150 shadow-sm active:scale-[0.97]"
            title="Open Documentation PDF"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Documentation</span>
            <span className="sm:hidden">Docs</span>
          </a>

          {/* Guide button */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 text-[12px] font-medium border border-slate-700/60 hover:border-slate-600/60 transition-all duration-150 shadow-sm active:scale-[0.97]"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Guide &amp; Math</span>
            <span className="sm:hidden">Guide</span>
          </button>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowHelp(false)}
        >
          <div className="bg-[#0d1424] border border-slate-700/60 rounded-2xl max-w-2xl w-full p-6 max-h-[88vh] overflow-y-auto text-slate-200 shadow-2xl relative ring-1 ring-white/5">
            {/* Close */}
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-all duration-150"
              title="Close guide"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title */}
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800/80">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-base font-bold text-white">KNN Arena — Master Guide</h2>
            </div>

            <div className="space-y-3 text-[13px] leading-relaxed">
              {/* Algorithms section */}
              <section className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
                <h3 className="font-semibold text-amber-400 text-[11px] uppercase tracking-wider mb-2">
                  1 · Uniform kNN vs Weighted kNN
                </h3>
                <p className="text-slate-300 text-[13px]">
                  <span className="font-semibold text-white">Standard kNN</span> counts votes equally. <span className="font-semibold text-white">Weighted kNN (wkNN)</span> scales influence by proximity — a close neighbor outvotes several distant ones!
                </p>
              </section>

              <section className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
                <h3 className="font-semibold text-sky-400 text-[11px] uppercase tracking-wider mb-2">
                  2 · Weighting Schemes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[12px]">
                  {[
                    { name: '1 / distance', formula: 'w = 1/(d + ε)', desc: 'inverse' },
                    { name: '1 / dist²', formula: 'w = 1/(d² + ε)', desc: 'steep falloff' },
                    { name: 'Gaussian', formula: 'w = e^(−3·(d/h)²)', desc: 'h = d_k' },
                  ].map(item => (
                    <div key={item.name} className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/60">
                      <span className="font-semibold text-white block text-[11px] mb-1">{item.name}</span>
                      <code className="text-sky-400 text-[10px] block">{item.formula}</code>
                      <span className="text-slate-500 text-[10px] mt-0.5 block">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
                <h3 className="font-semibold text-rose-400 text-[11px] uppercase tracking-wider mb-2">
                  3 · Distance Metrics &amp; Ball Contours
                </h3>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  {[
                    { name: 'Euclidean (L2)', formula: '√(dx²+dy²)', shape: 'Circles' },
                    { name: 'Manhattan (L1)', formula: '|dx|+|dy|', shape: 'Diamonds' },
                    { name: 'Chebyshev (L∞)', formula: 'max(|dx|,|dy|)', shape: 'Squares' },
                  ].map(item => (
                    <div key={item.name} className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/60">
                      <span className="font-semibold text-white block text-[11px] mb-1">{item.name}</span>
                      <code className="text-slate-400 font-mono text-[10px] block">{item.formula}</code>
                      <span className="text-slate-500 text-[10px] mt-0.5 block">→ {item.shape}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
                <h3 className="font-semibold text-emerald-400 text-[11px] uppercase tracking-wider mb-2">
                  4 · Game Modes
                </h3>
                <div className="space-y-2 text-[13px] text-slate-300">
                  <p><span className="font-semibold text-amber-400">PLAY</span> — Guess the mystery star's class. See how kNN and wkNN vote and test your intuition.</p>
                  <p><span className="font-semibold text-sky-400">SANDBOX</span> — Click anywhere to probe, inspect neighbors, and add custom training points.</p>
                  <p><span className="font-semibold text-emerald-400">WEDGE PUZZLES</span> — 7 brain-teasers: strategically place points outside the no-go zone to force kNN and wkNN to disagree!</p>
                </div>
              </section>

              <section className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Command className="w-3.5 h-3.5 text-amber-400" />
                    Keyboard Shortcuts
                  </h3>
                  <div className="flex items-center gap-4 text-slate-400 text-[12px]">
                    {[
                      { key: 'Space', label: 'Next Round' },
                      { key: '1–4', label: 'Choose Class' },
                      { key: 'Backspace', label: 'Undo' },
                    ].map(({ key, label }) => (
                      <span key={key} className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">{key}</kbd>
                        <span>{label}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="flex-none px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[13px] transition-all duration-150 shadow-sm active:scale-[0.97]"
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
