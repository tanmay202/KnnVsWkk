"""
KNN Arena - kNN vs wkNN desktop game.   Run:  python knn_arena.py
Needs: numpy, matplotlib (tkinter ships with Python). No scikit-learn / TensorFlow.

PLAY    : guess the mystery star, then see how kNN and wkNN voted.
SANDBOX : click to probe a point, add training points, watch regions change.
WEDGE   : puzzle levels. You get a few training points to drop; make kNN and wkNN
          disagree with each other in a specific way. Left-click places, right-click undoes.

The vote table under the plot shows every neighbour's distance, weight and class,
plus the class totals for kNN (counts) and wkNN (summed weights).
"""

import itertools
import tkinter as tk
from tkinter import ttk

import matplotlib
import numpy as np

matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.colors import ListedColormap
from matplotlib.figure import Figure
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

EPS = 1e-9
COLORS = ["#e4572e", "#17bebb", "#f2b705", "#76b041"]
NAMES = ["Fire", "Water", "Sun", "Leaf"]


def tint(hex_color, a=0.6):
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % tuple(int(v + (255 - v) * a) for v in (r, g, b))


# ============================================================ classifiers
class KNN:
    """k-Nearest Neighbours supporting shared neighbor caching between kNN and wkNN."""

    def __init__(self, k=5, metric="euclidean", weighting="uniform"):
        self.k, self.metric, self.weighting = k, metric, weighting

    def fit(self, X, y, n_classes):
        self.X, self.y, self.C = np.asarray(X, float), np.asarray(y, int), n_classes
        return self

    def _dist(self, Q):
        diff = Q[:, None, :] - self.X[None, :, :]
        if self.metric == "euclidean":
            return np.sqrt((diff**2).sum(-1))
        if self.metric == "manhattan":
            return np.abs(diff).sum(-1)
        return np.abs(diff).max(-1)  # chebyshev

    def neighbors(self, Q):
        """Indices and distances of the k nearest training points, sorted nearest-first."""
        Q = np.atleast_2d(Q)
        k = min(self.k, len(self.X))
        idx_out, d_out = [], []
        for s in range(0, len(Q), 1024):
            D = self._dist(Q[s : s + 1024])
            part = np.argpartition(D, k - 1, axis=1)[:, :k]
            dp = np.take_along_axis(D, part, 1)
            order = np.argsort(dp, 1)
            idx_out.append(np.take_along_axis(part, order, 1))
            d_out.append(np.take_along_axis(dp, order, 1))
        return np.vstack(idx_out), np.vstack(d_out)

    def weights(self, d):
        if self.weighting == "uniform":
            return np.ones_like(d)
        if self.weighting == "inverse":
            return 1.0 / (d + EPS)
        if self.weighting == "inverse_sq":
            return 1.0 / (d**2 + EPS)
        h = d[:, -1:] + EPS  # gaussian kernel, bandwidth = distance to k-th neighbour
        return np.exp(-3.0 * (d / h) ** 2)

    def predict_from_neighbors(self, idx, d):
        """Compute (predictions, probabilities, weights) directly from precomputed (idx, d)."""
        w = self.weights(d)
        votes = np.zeros((len(idx), self.C))
        rows = np.repeat(np.arange(len(idx)), idx.shape[1])
        np.add.at(votes, (rows, self.y[idx].ravel()), w.ravel())
        proba = votes / votes.sum(1, keepdims=True)

        # Tie-break in favor of the single nearest neighbor without mutating proba
        scores = proba.copy()
        nearest = self.y[idx[:, 0]]
        scores[np.arange(len(scores)), nearest] += 1e-9
        return scores.argmax(1), proba, w

    def predict_proba(self, Q):
        idx, d = self.neighbors(Q)
        return self.predict_from_neighbors(idx, d)[1]

    def predict(self, Q):
        idx, d = self.neighbors(Q)
        return self.predict_from_neighbors(idx, d)[0]


# ============================================================ datasets
def make_blobs(rng, n):
    centers = np.array([[-1.5, -1.0], [1.5, -1.0], [0.0, 1.8]])
    X = np.vstack([rng.normal(c, 0.95, (n // 3, 2)) for c in centers])
    return X, np.repeat(np.arange(3), n // 3)


def make_moons(rng, n):
    m = n // 2
    t = rng.uniform(0, np.pi, m)
    a = np.c_[np.cos(t), np.sin(t)]
    b = np.c_[1 - np.cos(t), 0.5 - np.sin(t)]
    X = np.vstack([a, b]) + rng.normal(0, 0.17, (2 * m, 2)) - [0.5, 0.25]
    return X, np.r_[np.zeros(m), np.ones(m)].astype(int)


def make_rings(rng, n):
    m = n // 2
    t = rng.uniform(0, 2 * np.pi, (2, m))
    r = np.r_[rng.normal(1.0, 0.12, m), rng.normal(2.1, 0.15, m)]
    th = np.r_[t[0], t[1]]
    return np.c_[r * np.cos(th), r * np.sin(th)], np.r_[np.zeros(m), np.ones(m)].astype(
        int
    )


def make_spirals(rng, n):
    m = n // 3
    Xs, ys = [], []
    for c in range(3):
        r = np.linspace(0.25, 2.2, m)
        th = r * 1.6 + c * 2 * np.pi / 3 + rng.normal(0, 0.18, m)
        Xs.append(np.c_[r * np.cos(th), r * np.sin(th)])
        ys.append(np.full(m, c))
    return np.vstack(Xs), np.concatenate(ys)


DATASETS = {
    "Blobs (3)": (make_blobs, 240),
    "Moons (2)": (make_moons, 240),
    "Rings (2)": (make_rings, 240),
    "Spirals (3)": (make_spirals, 330),
}


# ============================================================ wedge: geometry, levels, solver
def mnorm(v, metric):
    v = np.abs(np.asarray(v, float))
    if metric == "euclidean":
        return np.sqrt((v**2).sum(-1))
    if metric == "manhattan":
        return v.sum(-1)
    return v.max(-1)


def at_distance(center, d, theta, metric):
    u = np.array([np.cos(theta), np.sin(theta)])
    return center + d * u / mnorm(u, metric)


def ball_poly(center, r, metric, n=181):
    """Outline of the metric ball: circle, diamond (manhattan) or square (chebyshev)."""
    th = np.linspace(0, 2 * np.pi, n)
    U = np.c_[np.cos(th), np.sin(th)]
    return center + r * U / mnorm(U, metric)[:, None]


def _pred_pair(Dk, Ck, scheme, C):
    """(kNN pred, wkNN pred) for rows of sorted top-k distances Dk and labels Ck."""
    out = []
    for w in (np.ones_like(Dk), KNN(weighting=scheme).weights(Dk)):
        votes = np.stack([(w * (Ck == c)).sum(1) for c in range(C)], 1)
        p = votes / votes.sum(1, keepdims=True)
        p[np.arange(len(p)), Ck[:, 0]] += 1e-9
        out.append(p.argmax(1))
    return out


def _wedge_ok(base_d, base_c, Dn, Cn, k, scheme, C, goal):
    """Boolean mask over rows of new placements (Dn, Cn): does the star's (kNN, wkNN) hit the goal?"""
    n = len(Dn)
    D = np.concatenate([np.broadcast_to(base_d, (n, len(base_d))), Dn], 1)
    Cc = np.concatenate([np.broadcast_to(base_c, (n, len(base_c))), Cn], 1)
    order = np.argsort(D, 1, kind="stable")[:, :k]
    pk, pw = _pred_pair(
        np.take_along_axis(D, order, 1), np.take_along_axis(Cc, order, 1), scheme, C
    )
    return (pk == goal[0]) & (pw == goal[1])


def solve_wedge(base_d, base_c, k, scheme, budget, r_min, goal, C=2, step=0.025):
    """Smallest set of (distance, class) placements that makes (kNN, wkNN) == goal
    and survives mouse-click jitter (+-0.02)."""
    base_d, base_c = np.asarray(base_d)[:k], np.asarray(base_c)[:k]
    ds = np.arange(r_min, base_d[-1] + 1e-9, step)
    if len(ds) == 0:
        return None
    opt_d, opt_c = np.repeat(ds, C), np.tile(np.arange(C), len(ds))
    rng = np.random.default_rng(0)
    for m in range(1, budget + 1):
        combos = np.array(
            list(itertools.combinations_with_replacement(range(len(opt_d)), m))
        )
        Dn, Cn = opt_d[combos], opt_c[combos]
        ok = np.flatnonzero(_wedge_ok(base_d, base_c, Dn, Cn, k, scheme, C, goal))
        if not len(ok):
            continue
        ok = ok[:3000]
        score = np.zeros(len(ok))
        for _ in range(12):
            Dj = np.maximum(Dn[ok] + rng.uniform(-0.02, 0.02, (len(ok), m)), r_min)
            score += _wedge_ok(base_d, base_c, Dj, Cn[ok], k, scheme, C, goal)
        if score.max() < 4:  # reject fragile razor-thin solutions
            continue
        best = ok[int(np.argmax(score))]
        return [(float(Dn[best, j]), int(Cn[best, j])) for j in range(m)]
    return None


# near = (distance, class) of the star's closest training points, nearest first.
# Fire=0, Water=1.
NEAR = {
    1: [
        (0.30, 1),
        (0.70, 0),
        (0.75, 0),
        (0.80, 0),
        (0.85, 0),
        (0.90, 0),
        (0.95, 0),
        (1.05, 1),
        (1.10, 0),
        (1.20, 1),
        (1.25, 0),
        (1.35, 0),
        (1.40, 1),
    ],
    2: [
        (0.25, 0),
        (0.30, 0),
        (0.60, 1),
        (0.70, 1),
        (0.80, 0),
        (0.85, 0),
        (0.90, 0),
        (1.05, 1),
        (1.10, 0),
        (1.20, 1),
        (1.25, 0),
        (1.35, 0),
        (1.40, 1),
    ],
    3: [
        (0.25, 1),
        (0.37, 1),
        (0.42, 0),
        (0.53, 1),
        (0.66, 0),
        (0.79, 0),
        (0.92, 0),
        (1.07, 0),
        (1.20, 1),
        (1.35, 0),
    ],
    4: [
        (0.58, 0),
        (0.72, 0),
        (0.86, 0),
        (0.98, 1),
        (1.10, 0),
        (1.20, 1),
        (1.30, 1),
        (1.37, 1),
        (1.47, 0),
        (1.58, 0),
        (1.70, 1),
        (1.76, 1),
    ],
    5: [
        (0.62, 0),
        (0.75, 1),
        (0.89, 1),
        (1.03, 0),
        (1.11, 1),
        (1.22, 0),
        (1.30, 1),
        (1.38, 0),
    ],
    6: [
        (0.38, 1),
        (0.50, 0),
        (0.55, 0),
        (0.60, 0),
        (0.65, 0),
        (0.85, 1),
        (1.05, 0),
        (1.25, 1),
    ],
    7: [
        (0.22, 0),
        (0.25, 0),
        (0.36, 1),
        (0.38, 1),
        (0.40, 1),
        (0.42, 1),
        (1.60, 0),
        (1.75, 1),
        (1.90, 0),
    ],
}

LEVELS = [
    dict(
        name="Close Call",
        seed=11,
        k=7,
        scheme="inverse",
        metric="euclidean",
        budget=2,
        r_min=0.20,
        goal=(0, 1),
        near=NEAR[1],
        blurb="kNN counts heads. wkNN weighs each neighbour by 1/distance.\nKeep kNN on Fire, flip wkNN to Water.",
    ),
    dict(
        name="Crowd Control",
        seed=12,
        k=7,
        scheme="inverse",
        metric="euclidean",
        budget=3,
        r_min=0.20,
        goal=(1, 0),
        near=NEAR[2],
        blurb="The reverse: flip kNN to Water, keep wkNN on Fire.\nA new point evicts the k-th neighbour, while far points carry small weight.",
    ),
    dict(
        name="Swap Places",
        seed=13,
        k=7,
        scheme="inverse",
        metric="euclidean",
        budget=3,
        r_min=0.20,
        goal=(1, 0),
        near=NEAR[3],
        blurb="Currently kNN=Fire and wkNN=Water. Swap both: make kNN=Water and wkNN=Fire.\nNotice who sits at ranks #5, #6, #7!",
    ),
    dict(
        name="Sealed Zone",
        seed=14,
        k=9,
        scheme="inverse_sq",
        metric="euclidean",
        budget=3,
        r_min=0.45,
        goal=(0, 1),
        near=NEAR[4],
        blurb="The no-go zone blocks point-blank placement, and 1/d^2 weights fall off fast.\nKeep kNN on Fire, flip wkNN to Water.",
    ),
    dict(
        name="Diamond Rush",
        seed=15,
        k=5,
        scheme="inverse",
        metric="manhattan",
        budget=3,
        r_min=0.30,
        goal=(0, 1),
        near=NEAR[5],
        blurb="Manhattan (L1) distance: equidistant contours are diamonds, not circles.\nBoth models say Water. Flip kNN to Fire, keep wkNN on Water.",
    ),
    dict(
        name="Boxed In",
        seed=16,
        k=5,
        scheme="inverse",
        metric="chebyshev",
        budget=2,
        r_min=0.25,
        goal=(0, 1),
        near=NEAR[6],
        blurb="Chebyshev (L_inf) distance: max(|dx|, |dy|) forms square shells whose corners reach far.\nKeep kNN on Fire, flip wkNN to Water.",
    ),
    dict(
        name="Bandwidth Squeeze",
        seed=17,
        k=7,
        scheme="gaussian",
        metric="euclidean",
        budget=2,
        r_min=0.35,
        goal=(1, 0),
        near=NEAR[7],
        blurb="Gaussian wkNN uses bandwidth h = d_k (the k-th neighbour's distance!).\nEvict distant #7 (d=1.60) to shrink h and crush the middle Water cluster's weights!",
    ),
]


def make_level(L):
    rng = np.random.default_rng(L["seed"])
    star, metric = np.zeros(2), L["metric"]
    ang0 = rng.uniform(0, 2 * np.pi)
    pts = [
        at_distance(star, d, ang0 + i * 2.39996, metric)
        for i, (d, _) in enumerate(L["near"])
    ]
    labs = [c for _, c in L["near"]]
    bg_r = max(d for d, _ in L["near"]) + 0.35
    n_bg = 0
    while n_bg < 110:
        p = rng.uniform(-3, 3, 2)
        if mnorm(p, metric) < bg_r:
            continue
        c = int(p[0] > 0)
        if rng.random() < 0.12:
            c = 1 - c
        pts.append(p)
        labs.append(c)
        n_bg += 1
    return np.array(pts), np.array(labs, int), star


# ============================================================ the game window
class App:
    def __init__(self, root):
        self._ready = False
        self.root = root
        root.title("KNN Arena - kNN vs wkNN")
        root.geometry("1240x880")
        self.rng = np.random.default_rng()
        self.knn, self.wknn = KNN(), KNN()
        self.scores = {"You": [0, 0], "kNN": [0, 0], "wkNN": [0, 0]}
        self.focus, self.revealed, self.pool = None, False, []
        self._cached_q = None
        self.n_base, self.C = 0, 3
        self.in_wedge, self.level_i, self.stars = False, 0, {}
        self.placed, self.ghosts, self.par, self.par_solution = [], [], None, None
        self.solved = self.hint_used = False
        self.brush, self.class_btns, self._base_tot = 0, [], None

        # ---- left column: plot on top, live hover bar + vote table below
        left = ttk.Frame(root)
        left.pack(side="left", fill="both", expand=True)
        tbl = ttk.Frame(left, padding=(6, 2))
        tbl.pack(side="bottom", fill="x")

        self.hover_var = tk.StringVar(
            value="Move cursor over the plot to inspect distance & neighbour rank."
        )
        ttk.Label(
            tbl, textvariable=self.hover_var, font=("Courier", 9), foreground="#333"
        ).pack(anchor="w", pady=(0, 2))

        self.tot_k, self.tot_w = tk.StringVar(), tk.StringVar()
        ttk.Label(tbl, textvariable=self.tot_k, font=("Courier", 10, "bold")).pack(
            anchor="w"
        )
        ttk.Label(tbl, textvariable=self.tot_w, font=("Courier", 10, "bold")).pack(
            anchor="w", pady=(0, 3)
        )
        cols = (
            ("rank", "#", 40),
            ("cls", "Class", 90),
            ("dist", "Distance", 90),
            ("w", "wkNN weight", 110),
            ("share", "Share of wkNN", 110),
            ("note", "Source", 80),
        )
        trow = ttk.Frame(tbl)
        trow.pack(fill="x")
        self.tree = ttk.Treeview(
            trow, columns=[c[0] for c in cols], show="headings", height=7
        )
        for key, text, width in cols:
            self.tree.heading(key, text=text)
            self.tree.column(key, width=width, anchor="center")
        sb = ttk.Scrollbar(trow, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=sb.set)
        self.tree.pack(side="left", fill="x", expand=True)
        sb.pack(side="right", fill="y")
        for c in range(4):
            self.tree.tag_configure(f"c{c}", background=tint(COLORS[c]))

        self.fig = Figure(figsize=(7, 5.4), dpi=100)
        self.fig.subplots_adjust(left=0.06, right=0.98, top=0.93, bottom=0.06)
        self.ax = self.fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.fig, master=left)
        self.canvas.get_tk_widget().pack(side="top", fill="both", expand=True)
        self.canvas.mpl_connect("button_press_event", self.on_click)
        self.canvas.mpl_connect("motion_notify_event", self.on_motion)

        # ---- control panel (right)
        p = ttk.Frame(root, padding=10)
        p.pack(side="right", fill="y")
        self.dataset = tk.StringVar(value="Moons (2)")
        self.metric = tk.StringVar(value="euclidean")
        self.scheme = tk.StringVar(value="inverse")
        self.boundary = tk.StringVar(value="none")
        self.mode = tk.StringVar(value="play")
        self.hard_mode = tk.BooleanVar(value=True)
        self.k = tk.IntVar(value=7)
        self.noise = tk.IntVar(value=10)
        self.class_lbl = tk.StringVar(value="Your answer (keys 1-4)")

        def row(parent, label, widget):
            ttk.Label(parent, text=label).pack(anchor="w", pady=(6, 0))
            widget.pack(fill="x")
            return widget

        ttk.Label(p, text="Mode").pack(anchor="w")
        mrow = ttk.Frame(p)
        mrow.pack(fill="x")
        for text, val in [
            ("Play", "play"),
            ("Sandbox", "sandbox"),
            ("Wedge puzzles", "wedge"),
        ]:
            ttk.Radiobutton(
                mrow, text=text, value=val, variable=self.mode, command=self.on_mode
            ).pack(side="left", padx=(0, 8))

        slot = ttk.Frame(p)
        slot.pack(fill="x", pady=(4, 0))
        self.arena_box, self.wedge_box = ttk.Frame(slot), ttk.Frame(slot)

        a = self.arena_box
        ds = row(
            a,
            "Dataset",
            ttk.Combobox(
                a, textvariable=self.dataset, values=list(DATASETS), state="readonly"
            ),
        )
        ds.bind("<<ComboboxSelected>>", lambda _: self.new_dataset())
        n_scale = row(
            a,
            "Label noise % (live)",
            tk.Scale(a, from_=0, to=35, orient="horizontal", variable=self.noise),
        )
        n_scale.bind("<ButtonRelease-1>", lambda _: self.apply_noise())
        ttk.Checkbutton(
            a,
            text="Prioritize contested/disagreement points",
            variable=self.hard_mode,
            command=self.rebuild_pool,
        ).pack(anchor="w", pady=(4, 0))
        brow = ttk.Frame(a)
        brow.pack(fill="x", pady=(6, 0))
        for text, cmd in (
            ("Next (Space)", self.next_round),
            ("New data", self.new_dataset),
            ("Reset scores", self.reset_scores),
        ):
            ttk.Button(brow, text=text, command=cmd).pack(
                side="left", expand=True, fill="x", padx=1
            )
        self.score_var = tk.StringVar()
        ttk.Label(
            a, textvariable=self.score_var, font=("Courier", 10), justify="left"
        ).pack(anchor="w", pady=6)

        w = self.wedge_box
        self.wedge_var = tk.StringVar()
        ttk.Label(
            w, textvariable=self.wedge_var, font=("Courier", 10), justify="left"
        ).pack(anchor="w")
        w1, w2 = ttk.Frame(w), ttk.Frame(w)
        w1.pack(fill="x", pady=(6, 0))
        w2.pack(fill="x", pady=(3, 0))
        for text, cmd in (
            ("Undo", self.undo),
            ("Reset", self.reset_level),
            ("Hint", self.hint),
        ):
            ttk.Button(w1, text=text, command=cmd).pack(
                side="left", expand=True, fill="x", padx=1
            )
        for text, cmd in (
            ("< Prev", lambda: self.load_level(self.level_i - 1)),
            ("Next >", lambda: self.load_level(self.level_i + 1)),
        ):
            ttk.Button(w2, text=text, command=cmd).pack(
                side="left", expand=True, fill="x", padx=1
            )
        self.arena_box.pack(fill="x")

        k_scale = row(
            p,
            "k (neighbours)",
            tk.Scale(p, from_=1, to=31, orient="horizontal", variable=self.k),
        )
        k_scale.bind("<ButtonRelease-1>", lambda _: self.on_params())
        cbs = []
        for label, var, vals in (
            ("Distance metric", self.metric, ["euclidean", "manhattan", "chebyshev"]),
            ("wkNN weighting", self.scheme, ["inverse", "inverse_sq", "gaussian"]),
        ):
            cb = row(
                p,
                label,
                ttk.Combobox(p, textvariable=var, values=vals, state="readonly"),
            )
            cb.bind("<<ComboboxSelected>>", lambda _: self.on_params())
            cbs.append(cb)
        self.tunables = [
            (k_scale, "normal"),
            (cbs[0], "readonly"),
            (cbs[1], "readonly"),
        ]

        ttk.Label(p, text="Background").pack(anchor="w", pady=(8, 0))
        grid = ttk.Frame(p)
        grid.pack(fill="x")
        for i, (text, val) in enumerate(
            [
                ("None", "none"),
                ("kNN regions", "knn"),
                ("wkNN regions", "wknn"),
                ("Disagreement", "disagree"),
            ]
        ):
            ttk.Radiobutton(
                grid, text=text, value=val, variable=self.boundary, command=self.redraw
            ).grid(row=i // 2, column=i % 2, sticky="w", padx=(0, 8))

        ttk.Label(p, textvariable=self.class_lbl).pack(anchor="w", pady=(8, 0))
        self.btn_frame = ttk.Frame(p)
        self.btn_frame.pack(fill="x")
        self.status = tk.StringVar(value="")
        ttk.Label(p, textvariable=self.status, wraplength=260, justify="left").pack(
            anchor="w", pady=(8, 0)
        )

        # Keyboard shortcuts
        root.bind("<space>", lambda _: self.next_round())
        root.bind("<BackSpace>", lambda _: self.undo())
        for c in range(4):
            root.bind(
                str(c + 1), lambda _, c=c: self.on_class(c) if c < self.C else None
            )

        self._ready = True
        self.new_dataset()

    # ------------------------------------------------------------ data / models
    def _set_equal_bounds(self, X, pad=0.6, aspect=1.28):
        """Pad data bounds so X and Y spans match the figure aspect ratio (true circles in all modes)."""
        lo, hi = X.min(0) - pad, X.max(0) + pad
        center = 0.5 * (lo + hi)
        span = hi - lo
        if span[0] / span[1] < aspect:
            span[0] = span[1] * aspect
        else:
            span[1] = span[0] / aspect
        self.lo, self.hi = center - 0.5 * span, center + 0.5 * span

    def _build_class_buttons(self, C):
        for b in self.btn_frame.winfo_children():
            b.destroy()
        self.class_btns = []
        for c in range(C):
            b = tk.Button(
                self.btn_frame,
                text=f"[{c + 1}] {NAMES[c]}",
                bg=COLORS[c],
                fg="black",
                command=lambda c=c: self.on_class(c),
            )
            b.pack(fill="x", pady=1)
            self.class_btns.append(b)

    def new_dataset(self):
        gen, n = DATASETS[self.dataset.get()]
        X, y = gen(self.rng, n)
        perm = self.rng.permutation(len(X))
        X, y = X[perm], y[perm]
        cut = int(0.75 * len(X))
        self.Xtr, self.ytr_clean, self.Xte, self.yte = (
            X[:cut],
            y[:cut].copy(),
            X[cut:],
            y[cut:],
        )
        self.n_base = len(self.Xtr)
        self.C = int(y.max()) + 1
        self.noise_u = self.rng.random(len(self.ytr_clean))
        self.noise_shift = self.rng.integers(1, self.C, len(self.ytr_clean))

        self._set_equal_bounds(X, pad=0.55)
        self.focus, self.revealed = None, False
        self._build_class_buttons(self.C)
        self.apply_noise(reset_round=True)

    def apply_noise(self, reset_round=False):
        if not self._ready or self.in_wedge:
            return
        flip = self.noise_u < (self.noise.get() / 100.0)
        self.ytr = self.ytr_clean.copy()
        self.ytr[flip] = (self.ytr[flip] + self.noise_shift[flip]) % self.C
        self.sync_models()
        self.rebuild_pool()
        if reset_round:
            self.on_mode()
        else:
            self.redraw()

    def sync_models(self):
        for m, w in ((self.knn, "uniform"), (self.wknn, self.scheme.get())):
            m.k, m.metric, m.weighting = self.k.get(), self.metric.get(), w
            m.fit(self.Xtr, self.ytr, self.C)

    def rebuild_pool(self):
        """Order the test pool so disagreed or high-uncertainty points come first if Hard Mode is on."""
        if self.in_wedge:
            return
        if not self.hard_mode.get():
            self.pool = list(self.rng.permutation(len(self.Xte)))
            return
        idx, d = self.knn.neighbors(self.Xte)
        pk, Pk, _ = self.knn.predict_from_neighbors(idx, d)
        pw, Pw, _ = self.wknn.predict_from_neighbors(idx, d)
        disagree = (pk != pw).astype(float)
        uncertainty = 1.0 - 0.5 * (Pk.max(1) + Pw.max(1))
        priority = (
            disagree * 2.0 + uncertainty + self.rng.uniform(0, 0.05, len(self.Xte))
        )
        self.pool = list(np.argsort(priority))

    def query(self, pt):
        pt = np.asarray(pt, float)[None]
        idx, d = self.knn.neighbors(pt)
        pk, Pk, _ = self.knn.predict_from_neighbors(idx, d)
        pw, Pw, w = self.wknn.predict_from_neighbors(idx, d)
        return idx[0], d[0], pk[0], pw[0], Pk[0], Pw[0], w[0]

    def _totals_from_q(self, q):
        """(kNN vote counts, wkNN weight sums) per class from a cached query tuple."""
        idx, _, _, _, _, _, w = q
        lab = self.ytr[idx]
        return np.bincount(lab, minlength=self.C), np.bincount(
            lab, weights=w, minlength=self.C
        )

    # ------------------------------------------------------------ events
    def on_params(self):
        if not self._ready or self.in_wedge:
            return
        self.sync_models()
        self.rebuild_pool()
        self.redraw()

    def on_mode(self):
        m = self.mode.get()
        if m == "wedge":
            if not self.in_wedge:
                self._enter_wedge()
            return
        if self.in_wedge:
            self._leave_wedge()
            return
        self.focus, self.revealed = None, False
        if m == "play":
            self.class_lbl.set("Your answer (keys 1-4)")
            self.next_round()
        else:
            self.class_lbl.set("Add probed point as training data")
            self.status.set(
                "Sandbox: click the plot to probe a point. Press a class button to add it to training data."
            )
            self.redraw()

    def next_round(self):
        if self.mode.get() != "play":
            return
        if not self.pool:
            self.rebuild_pool()
        i = self.pool.pop()
        self.focus, self.revealed = (self.Xte[i], int(self.yte[i])), False
        self.status.set("Which class does the star belong to?")
        self.redraw()

    def on_class(self, c):
        if c >= self.C:
            return
        m = self.mode.get()
        if m == "play":
            self.guess(c)
        elif m == "wedge":
            self.brush = c
            self.set_brush(c)
            self.status.set(
                f"Brush: {NAMES[c]}. Left-click the plot to place a {NAMES[c]} point."
            )
        elif self.focus is not None:
            pt = self.focus[0]
            self.Xtr = np.vstack([self.Xtr, pt])
            self.ytr_clean = np.append(self.ytr_clean, c)
            self.ytr = np.append(self.ytr, c)
            self.noise_u = np.append(self.noise_u, 1.0)
            self.noise_shift = np.append(self.noise_shift, 1)
            self.sync_models()
            self.status.set(f"Added a {NAMES[c]} point. Models refit.")
            self.redraw()

    def set_brush(self, c):
        self.brush = c
        for i, b in enumerate(self.class_btns):
            b.configure(relief="sunken" if i == c else "raised")

    def _fmt_votes(self, P):
        return " ".join(f"{NAMES[c][0]}:{P[c]:.0%}" for c in range(self.C))

    def guess(self, c):
        if self.focus is None or self.revealed:
            return
        pt, truth = self.focus
        _, _, pk, pw, Pk, Pw, _ = self.query(pt)
        for name, pred in (("You", c), ("kNN", pk), ("wkNN", pw)):
            self.scores[name][1] += 1
            self.scores[name][0] += int(pred == truth)
        self.revealed = True
        tick = lambda ok: "OK" if ok else "X"
        self.status.set(
            f"Truth: {NAMES[truth]}\n"
            f"You : {NAMES[c]} ({tick(c == truth)})\n"
            f"kNN : {NAMES[pk]} ({tick(pk == truth)}) [{self._fmt_votes(Pk)}]\n"
            f"wkNN: {NAMES[pw]} ({tick(pw == truth)}) [{self._fmt_votes(Pw)}]"
        )
        self.redraw()

    def on_motion(self, ev):
        if ev.inaxes is not self.ax or ev.xdata is None or self.focus is None:
            return
        pt = np.array([ev.xdata, ev.ydata])
        star = self.focus[0]
        dist = float(mnorm(pt - star, self.knn.metric))
        if self.in_wedge:
            L = LEVELS[self.level_i]
            if dist < L["r_min"] - 1e-9:
                self.hover_var.set(
                    f"Cursor d = {dist:.3f}  |  INSIDE NO-GO ZONE (d < {L['r_min']:.2f})"
                )
                return
        if self._cached_q is not None and (self.revealed or self.in_wedge):
            _, d, *_ = self._cached_q
            rank = int(np.searchsorted(d, dist)) + 1
            if rank <= len(d):
                d_new = np.sort(np.append(d[:-1], dist))
                w_all = self.wknn.weights(d_new[None])[0]
                w_cur = w_all[rank - 1]
                self.hover_var.set(
                    f"Cursor d = {dist:.3f}  |  Would enter at Rank #{rank}/{len(d)}  |  "
                    f"wkNN weight = {w_cur:.3f} ({w_cur / w_all.sum():.0%} share)"
                )
            else:
                self.hover_var.set(
                    f"Cursor d = {dist:.3f}  |  Outside k-th radius (d > {d[-1]:.3f}, ignored by top-{len(d)})"
                )
        else:
            self.hover_var.set(
                f"Cursor distance to star: d = {dist:.3f} ({self.knn.metric})"
            )

    def on_click(self, ev):
        if ev.inaxes is not self.ax or ev.xdata is None:
            return
        m = self.mode.get()
        if m == "wedge":
            if ev.button == 3:
                self.undo()
            else:
                self.place(np.array([ev.xdata, ev.ydata]))
            return
        if m != "sandbox":
            return
        self.focus, self.revealed = (np.array([ev.xdata, ev.ydata]), None), True
        _, _, pk, pw, Pk, Pw, _ = self.query(self.focus[0])
        self.status.set(
            f"kNN : {NAMES[pk]} [{self._fmt_votes(Pk)}]\n"
            f"wkNN: {NAMES[pw]} [{self._fmt_votes(Pw)}]\n"
            "Press a class button (or 1-4) to add this point."
        )
        self.redraw()

    def reset_scores(self):
        self.scores = {k: [0, 0] for k in self.scores}
        self.redraw()

    # ------------------------------------------------------------ wedge mode
    def _set_tunables(self, on):
        for widget, normal in self.tunables:
            widget.configure(state=normal if on else "disabled")

    def _enter_wedge(self):
        self.in_wedge = True
        self._saved = (self.k.get(), self.metric.get(), self.scheme.get())
        self._set_tunables(False)
        self.arena_box.pack_forget()
        self.wedge_box.pack(fill="x")
        self.class_lbl.set("Placement brush (keys 1-2, left-click plot)")
        self.load_level(self.level_i)

    def _leave_wedge(self):
        self.in_wedge = False
        self.k.set(self._saved[0])
        self.metric.set(self._saved[1])
        self.scheme.set(self._saved[2])
        self._set_tunables(True)
        self.wedge_box.pack_forget()
        self.arena_box.pack(fill="x")
        self.placed, self.ghosts = [], []
        self.new_dataset()

    def load_level(self, i):
        self.level_i = i % len(LEVELS)
        L = LEVELS[self.level_i]
        self.base_X, self.base_y, self.star = make_level(L)
        self.C = 2
        self.Xtr, self.ytr = self.base_X.copy(), self.base_y.copy()
        self.n_base = len(self.Xtr)
        self.lo, self.hi = np.array([-3.2, -2.5]), np.array([3.2, 2.5])
        self.k.set(L["k"])
        self.metric.set(L["metric"])
        self.scheme.set(L["scheme"])
        self.placed, self.ghosts, self.solved, self.hint_used = [], [], False, False
        self.focus, self.revealed = (self.star, None), True
        self.sync_models()
        q0 = self.query(self.star)
        idx, d = q0[0], q0[1]
        self.par_solution = solve_wedge(
            d, self.ytr[idx], L["k"], L["scheme"], L["budget"], L["r_min"], L["goal"]
        )
        self.par = len(self.par_solution) if self.par_solution else None
        self._base_tot = self._totals_from_q(q0)
        self._build_class_buttons(2)
        self.set_brush(self.brush if self.brush < 2 else 0)
        self.status.set(L["blurb"])
        self.redraw()

    def _rebuild_wedge(self):
        if self.placed:
            self.Xtr = np.vstack([self.base_X, np.array([pt for pt, _ in self.placed])])
            self.ytr = np.concatenate(
                [self.base_y, [c for _, c in self.placed]]
            ).astype(int)
        else:
            self.Xtr, self.ytr = self.base_X.copy(), self.base_y.copy()
        self.sync_models()

    def place(self, pt):
        L = LEVELS[self.level_i]
        if self.solved:
            self.status.set("Solved already. Undo / Reset to retry, or press Next >.")
            return
        if len(self.placed) >= L["budget"]:
            self.status.set("Out of points. Undo (or right-click) or Reset.")
            return
        dist = float(mnorm(pt - self.star, L["metric"]))
        if dist < L["r_min"] - 1e-9:  # tolerance: a point exactly on the rim is legal
            self.status.set(
                f"Too close: the star is protected inside the grey zone (distance < {L['r_min']:.2f})."
            )
            return
        self.placed.append((pt, self.brush))
        self._rebuild_wedge()
        _, _, pk, pw, _, _, _ = self.query(self.star)
        self.solved = (int(pk), int(pw)) == L["goal"]
        used = len(self.placed)
        if self.solved:
            par = self.par or used
            s = 3 if used <= par else 2 if used == par + 1 else 1
            if self.hint_used:
                s = min(s, 1)
            self.stars[self.level_i] = max(self.stars.get(self.level_i, 0), s)
            self.status.set(
                f"SOLVED with {used} point(s), par {par}.  Rating: {'*' * s}\n"
                f"kNN -> {NAMES[pk]}, wkNN -> {NAMES[pw]}. Check the table: who changed, and why?"
            )
        else:
            self.status.set(
                f"Placed {NAMES[self.brush]} at distance {dist:.2f}.  "
                f"Now kNN -> {NAMES[pk]}, wkNN -> {NAMES[pw]}.  Points left: {L['budget'] - used}."
            )
        self.redraw()

    def undo(self):
        if self.in_wedge and self.placed:
            self.placed.pop()
            self.solved = False
            self._rebuild_wedge()
            self.status.set("Undone.")
            self.redraw()

    def reset_level(self):
        if self.in_wedge:
            self.load_level(self.level_i)

    def hint(self):
        if not (self.in_wedge and self.par_solution):
            return
        L = LEVELS[self.level_i]
        rng = np.random.default_rng(self.level_i)
        self.ghosts = [
            (at_distance(self.star, d, rng.uniform(0, 2 * np.pi), L["metric"]), c)
            for d, c in self.par_solution
        ]
        self.hint_used = True
        sol = ", ".join(f"{NAMES[c]} at d={d:.2f}" for d, c in self.par_solution)
        self.status.set(
            f"One par-{self.par} solution: {sol}.\nOnly the distance matters, not the angle. "
            "Rating for this level is now capped at 1."
        )
        self.redraw()

    def _wedge_info(self, q):
        L = LEVELS[self.level_i]
        _, _, pk, pw, _, _, _ = q
        prog = " ".join(
            f"{i + 1}:{'*' * self.stars.get(i, 0) or '-'}" for i in range(len(LEVELS))
        )
        self.wedge_var.set(
            f"LEVEL {self.level_i + 1}/{len(LEVELS)}: {L['name']}\n"
            f"Goal: kNN->{NAMES[L['goal'][0]]:5s} wkNN->{NAMES[L['goal'][1]]}\n"
            f"Now : kNN->{NAMES[pk]:5s} wkNN->{NAMES[pw]}\n"
            f"Points {len(self.placed)}/{L['budget']}  par {self.par}  no-go d<{L['r_min']:.2f}\n"
            f"Stars {prog}\nLeft-click place, right-click undo"
        )

    # ------------------------------------------------------------ vote table
    def _tot_line(self, label, vals, base, is_int, pred):
        parts = []
        for c in range(self.C):
            s = f"{NAMES[c]} {vals[c]:.0f}" if is_int else f"{NAMES[c]} {vals[c]:.2f}"
            if base is not None and abs(vals[c] - base[c]) > 1e-9:
                s += (
                    f" ({vals[c] - base[c]:+.0f})"
                    if is_int
                    else f" ({vals[c] - base[c]:+.2f})"
                )
            parts.append(s)
        return f"{label} {'  |  '.join(parts)}   ->  {NAMES[pred]}"

    def update_table(self, q):
        self.tree.delete(*self.tree.get_children())
        if q is None or not self.revealed:
            self.tot_k.set("")
            self.tot_w.set("")
            return
        idx, d, pk, pw, _, _, w = q
        share = w / w.sum()
        for r, (i, dist, wt, sh) in enumerate(zip(idx, d, w, share), 1):
            c = int(self.ytr[i])
            self.tree.insert(
                "",
                "end",
                tags=(f"c{c}",),
                values=(
                    r,
                    NAMES[c],
                    f"{dist:.3f}",
                    f"{wt:.3f}",
                    f"{sh:.0%}",
                    "yours" if i >= self.n_base else "base",
                ),
            )
        cnt, wsum = self._totals_from_q(q)
        base = self._base_tot if self.in_wedge else None
        bc, bw = base if base else (None, None)
        self.tot_k.set(self._tot_line("kNN  votes :", cnt, bc, True, pk))
        self.tot_w.set(self._tot_line("wkNN weight:", wsum, bw, False, pw))

    # ------------------------------------------------------------ drawing
    def redraw(self):
        if not self._ready:
            return
        ax = self.ax
        ax.clear()
        cmap = ListedColormap(COLORS[: self.C])
        bg_mode = self.boundary.get()
        handles = [Patch(color=COLORS[c], label=NAMES[c]) for c in range(self.C)]

        can_show_bg = (self.mode.get() == "sandbox") or self.in_wedge or self.revealed
        if bg_mode != "none" and can_show_bg:
            g = 110
            xx, yy = np.meshgrid(
                np.linspace(self.lo[0], self.hi[0], g),
                np.linspace(self.lo[1], self.hi[1], g),
            )
            grid = np.c_[xx.ravel(), yy.ravel()]
            ext = (self.lo[0], self.hi[0], self.lo[1], self.hi[1])
            idx, d = self.knn.neighbors(grid)
            if bg_mode == "disagree":
                pk, _, _ = self.knn.predict_from_neighbors(idx, d)
                pw, _, _ = self.wknn.predict_from_neighbors(idx, d)
                diff = (pk != pw).reshape(g, g)
                ax.imshow(
                    np.ma.masked_where(~diff, diff),
                    extent=ext,
                    origin="lower",
                    aspect="auto",
                    cmap=ListedColormap(["#d00000"]),
                    alpha=0.45,
                )
            else:
                model = self.knn if bg_mode == "knn" else self.wknn
                Z = model.predict_from_neighbors(idx, d)[0].reshape(g, g)
                ax.imshow(
                    Z,
                    extent=ext,
                    origin="lower",
                    aspect="auto",
                    cmap=cmap,
                    vmin=0,
                    vmax=self.C - 1,
                    alpha=0.25,
                )

        mine = np.arange(len(self.Xtr)) >= self.n_base
        ax.scatter(
            self.Xtr[~mine, 0],
            self.Xtr[~mine, 1],
            c=[COLORS[i] for i in self.ytr[~mine]],
            edgecolor="k",
            linewidth=0.5,
            s=32,
            zorder=3,
        )
        if mine.any():
            ax.scatter(
                self.Xtr[mine, 0],
                self.Xtr[mine, 1],
                c=[COLORS[i] for i in self.ytr[mine]],
                marker="D",
                edgecolor="k",
                linewidth=1.6,
                s=75,
                zorder=5,
            )
            handles.append(
                Line2D([], [], marker="D", ls="", mfc="w", mec="k", label="your points")
            )

        self._cached_q = self.query(self.focus[0]) if self.focus is not None else None
        if self.focus is not None:
            pt, truth = self.focus
            if self.revealed and self._cached_q is not None:
                idx, d, _, _, _, _, w = self._cached_q
                w_norm = w / w.max()
                for rank, (j, i) in enumerate(zip(range(len(idx)), idx), 1):
                    ax.plot(
                        [pt[0], self.Xtr[i, 0]],
                        [pt[1], self.Xtr[i, 1]],
                        color="k",
                        lw=0.6 + 3.2 * w_norm[j],
                        alpha=0.55,
                        zorder=4,
                    )
                    ax.annotate(
                        str(rank),
                        self.Xtr[i],
                        xytext=(4, 4),
                        textcoords="offset points",
                        fontsize=8,
                        weight="bold",
                        color="#111",
                        zorder=7,
                    )
                ring = ball_poly(pt, d[-1], self.knn.metric)
                ax.plot(ring[:, 0], ring[:, 1], "k--", lw=0.9, alpha=0.7, zorder=2)
                handles.append(
                    Line2D(
                        [],
                        [],
                        color="k",
                        ls="--",
                        lw=0.9,
                        label="k-th neighbour radius",
                    )
                )
            face = COLORS[truth] if (self.revealed and truth is not None) else "white"
            ax.scatter(
                pt[0],
                pt[1],
                marker="*",
                s=380,
                c=[face],
                edgecolor="k",
                linewidth=1.5,
                zorder=6,
            )
            if not self.revealed:
                ax.annotate(
                    "?",
                    pt,
                    xytext=(10, 10),
                    textcoords="offset points",
                    fontsize=16,
                    weight="bold",
                )

        if self.in_wedge:
            L = LEVELS[self.level_i]
            zone = ball_poly(self.star, L["r_min"], L["metric"])
            ax.fill(zone[:, 0], zone[:, 1], color="#888", alpha=0.20, zorder=1)
            ax.plot(zone[:, 0], zone[:, 1], color="#666", ls=":", lw=1.2, zorder=2)
            handles.append(Patch(color="#888", alpha=0.3, label="no-go zone"))
            for gpt, gc in self.ghosts:
                ax.scatter(
                    gpt[0],
                    gpt[1],
                    marker="D",
                    s=90,
                    facecolor="none",
                    edgecolor=COLORS[gc],
                    linewidth=2.2,
                    zorder=5,
                )
            title = f"Wedge {self.level_i + 1}/{len(LEVELS)}: {L['name']}  |  k={L['k']}  |  {L['metric']}  |  wkNN={L['scheme']}"
        else:
            title = f"{self.dataset.get()}  |  k={self.k.get()}  |  {self.metric.get()}  |  wkNN={self.scheme.get()}"

        ax.set_xlim(self.lo[0], self.hi[0])
        ax.set_ylim(self.lo[1], self.hi[1])
        ax.set_aspect("equal", adjustable="box")
        ax.set_title(title, fontsize=10)
        ax.legend(handles=handles, loc="upper right", fontsize=8)
        self.canvas.draw_idle()

        lines = [
            f"{n:5s} {a}/{t}  {a / t:4.0%}" if t else f"{n:5s} -"
            for n, (a, t) in self.scores.items()
        ]
        self.score_var.set("SCOREBOARD\n" + "\n".join(lines))
        if self.in_wedge and self._cached_q is not None:
            self._wedge_info(self._cached_q)
        self.update_table(self._cached_q)


if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()