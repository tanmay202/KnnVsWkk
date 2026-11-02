# KNN Arena — kNN vs wkNN Interactive React Application

An interactive desktop-class web application faithfully recreating and expanding upon the Python `KNN.py` desktop game.

## Overview
**KNN Arena** pits standard **k-Nearest Neighbours (kNN)** against **Weighted k-Nearest Neighbours (wkNN)** in a head-to-head machine learning lab and puzzle game.

### Features
1. **Play Mode**:
   - Guess the mystery star's class before revealing predictions.
   - Live scoreboard tracking You vs kNN vs wkNN accuracy.
   - Dynamic dataset selection: *Blobs (3)*, *Moons (2)*, *Rings (2)*, *Spirals (3)*.
   - Real-time label noise slider (0% to 35%).
   - "Hard Mode" toggle prioritizing contested / disagreement points where kNN != wkNN or high uncertainty.
2. **Sandbox Mode**:
   - Free canvas exploration.
   - Click anywhere to probe a point, inspect neighbor distances and weights.
   - Add probed points into the training dataset and watch the models and decision boundaries refit in real-time.
3. **Wedge Puzzles Mode**:
   - 7 curated brain-teaser levels (*Close Call*, *Crowd Control*, *Swap Places*, *Sealed Zone*, *Diamond Rush*, *Boxed In*, *Bandwidth Squeeze*).
   - Place points outside the protected no-go zone ($r < r_{\min}$) to force kNN and wkNN to disagree according to level objectives.
   - Built-in par solver and hint system with ghost markers.
   - Star rating system tracking solutions (★★★ par, ★★ par+1, ★ solved).
4. **Distance Metrics**:
   - **Euclidean ($L_2$)**: Circular contours $\sqrt{\Delta x^2 + \Delta y^2}$.
   - **Manhattan ($L_1$)**: Diamond contours $|\Delta x| + |\Delta y|$.
   - **Chebyshev ($L_\infty$)**: Square contours $\max(|\Delta x|, |\Delta y|)$.
5. **wkNN Weighting Schemes**:
   - **1 / distance (inverse)**: $w_i = 1 / (d_i + \epsilon)$.
   - **1 / dist² (inverse sq)**: $w_i = 1 / (d_i^2 + \epsilon)$.
   - **Gaussian (dk)**: $w_i = \exp\left(-3 \cdot (d_i / h)^2\right)$ with adaptive bandwidth $h = d_k$ (the $k$-th neighbor's distance).
6. **Visual Overlays & Decision Regions**:
   - Real-time heatmaps: *None*, *kNN regions*, *wkNN regions*, *Disagreement map* (highlighting conflicting regions in bright crimson).
   - Dynamic neighbor ray lines with line thickness proportional to wkNN weights.
   - Metric ball contours ($d_k$ and $r_{\min}$ no-go zone).
   - Live hover inspection bar calculating hypothetical insertion ranks and weight shares.
   - Detailed live vote table with tinted badges, rank ordering, distance, weight, percentage share, and source (`base` vs `yours`).

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Development
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Automated Tests
```bash
npm test
```

### Production Build
```bash
npm run build
npm run preview
```

### Keyboard Shortcuts
- `Space`: Next round in Play Mode
- `1 - 4`: Select class / guess / brush
- `Backspace`: Undo last placed point in Wedge Mode
