/* ============================================================================
 * ml.js - Machine learning algorithms implemented from scratch.
 *
 * No TensorFlow.js, no libraries. Every gradient here was derived by hand and
 * written out in array math, because the point is to show the mechanics
 * rather than hide them behind model.fit().
 *
 *   MLP        multi-layer perceptron + backpropagation + SGD with momentum
 *   KMeans     Lloyd's algorithm with k-means++ seeding
 *   LinReg     polynomial regression trained by gradient descent
 *   Attention  scaled dot-product self-attention, softmax(QK^T / sqrt(d))V
 *
 * All of it is on window.ML - poke at it in the console.
 * ==========================================================================*/

(function (global) {
  "use strict";

  /* -- Seeded RNG so demos are reproducible ------------------------------ */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Box-Muller: uniform -> standard normal, for weight initialisation
  function randn(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ======================================================================
   * ACTIVATIONS - each paired with its true derivative, expressed in terms
   * of the already-computed activation where possible. That's the standard
   * trick that makes backprop cheap.
   * ==================================================================== */

  const ACT = {
    tanh: {
      f: function (z) { return Math.tanh(z); },
      df: function (a) { return 1 - a * a; }          // 1 - tanh(z)^2
    },
    relu: {
      f: function (z) { return z > 0 ? z : 0; },
      df: function (a) { return a > 0 ? 1 : 0; }      // subgradient at 0 = 0
    },
    sigmoid: {
      f: function (z) { return 1 / (1 + Math.exp(-z)); },
      df: function (a) { return a * (1 - a); }        // sigma(1 - sigma)
    }
  };

  /* ======================================================================
   * MULTI-LAYER PERCEPTRON
   *
   * Sizes e.g. [2, 8, 8, 1]: 2 in -> 8 -> 8 -> 1 sigmoid out.
   * Trained with binary cross-entropy. The output delta is simply
   * (prediction - target) because the sigmoid derivative in the chain rule
   * cancels exactly against the BCE derivative. Deriving that by hand is the
   * whole reason this file exists.
   * ==================================================================== */

  function MLP(sizes, opts) {
    opts = opts || {};
    this.sizes = sizes.slice();
    this.L = sizes.length - 1;
    this.hidden = ACT[opts.activation || "tanh"];
    this.lr = opts.lr != null ? opts.lr : 0.08;
    this.momentum = opts.momentum != null ? opts.momentum : 0.9;
    this.l2 = opts.l2 != null ? opts.l2 : 0.0001;
    this.epoch = 0;
    this.lossHistory = [];

    const rng = mulberry32(opts.seed || 42);
    this.W = []; this.b = []; this.vW = []; this.vb = [];

    for (let l = 0; l < this.L; l++) {
      const nIn = sizes[l], nOut = sizes[l + 1];
      // Xavier/Glorot: variance 1/nIn keeps signal magnitude stable with depth
      const scale = Math.sqrt(1 / nIn);
      const w = new Float64Array(nOut * nIn);
      for (let i = 0; i < w.length; i++) w[i] = randn(rng) * scale;
      this.W.push(w);
      this.b.push(new Float64Array(nOut));
      this.vW.push(new Float64Array(nOut * nIn));
      this.vb.push(new Float64Array(nOut));
    }
  }

  // Forward pass. Returns every layer's activation because backprop needs them.
  MLP.prototype.forward = function (x) {
    const acts = [Float64Array.from(x)];
    for (let l = 0; l < this.L; l++) {
      const nIn = this.sizes[l], nOut = this.sizes[l + 1];
      const prev = acts[l];
      const out = new Float64Array(nOut);
      const W = this.W[l], b = this.b[l];
      const isLast = l === this.L - 1;

      for (let i = 0; i < nOut; i++) {
        let z = b[i];
        const row = i * nIn;
        for (let j = 0; j < nIn; j++) z += W[row + j] * prev[j];
        out[i] = isLast ? ACT.sigmoid.f(z) : this.hidden.f(z);
      }
      acts.push(out);
    }
    return acts;
  };

  MLP.prototype.predict = function (x) {
    const a = this.forward(x);
    return a[a.length - 1];
  };

  // One full-batch gradient descent step.
  MLP.prototype.trainStep = function (X, Y) {
    const n = X.length;
    if (n === 0) return 0;

    const gW = this.W.map(function (w) { return new Float64Array(w.length); });
    const gb = this.b.map(function (b) { return new Float64Array(b.length); });
    let loss = 0;

    for (let s = 0; s < n; s++) {
      const acts = this.forward(X[s]);
      const yhat = acts[this.L];
      const y = Y[s];

      // ---- binary cross-entropy ----
      for (let i = 0; i < yhat.length; i++) {
        const p = Math.min(1 - 1e-9, Math.max(1e-9, yhat[i]));
        loss += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
      }

      // ---- output delta: (yhat - y). Sigmoid' cancels with BCE'. ----
      let delta = new Float64Array(yhat.length);
      for (let i = 0; i < yhat.length; i++) delta[i] = yhat[i] - y[i];

      // ---- backward ----
      for (let l = this.L - 1; l >= 0; l--) {
        const nIn = this.sizes[l], nOut = this.sizes[l + 1];
        const prev = acts[l];

        // dL/dW = delta (outer) prev,  dL/db = delta
        for (let i = 0; i < nOut; i++) {
          const d = delta[i], row = i * nIn;
          gb[l][i] += d;
          for (let j = 0; j < nIn; j++) gW[l][row + j] += d * prev[j];
        }

        if (l === 0) break;

        // delta_prev = (W^T . delta) * act'(a_prev)
        const dPrev = new Float64Array(nIn);
        for (let j = 0; j < nIn; j++) {
          let acc = 0;
          for (let i = 0; i < nOut; i++) acc += this.W[l][i * nIn + j] * delta[i];
          dPrev[j] = acc * this.hidden.df(prev[j]);
        }
        delta = dPrev;
      }
    }

    // ---- apply: SGD with momentum + L2 weight decay ----
    for (let l = 0; l < this.L; l++) {
      const W = this.W[l], b = this.b[l], vW = this.vW[l], vb = this.vb[l];
      for (let i = 0; i < W.length; i++) {
        const grad = gW[l][i] / n + this.l2 * W[i];
        vW[i] = this.momentum * vW[i] - this.lr * grad;
        W[i] += vW[i];
      }
      for (let i = 0; i < b.length; i++) {
        const grad = gb[l][i] / n;
        vb[i] = this.momentum * vb[i] - this.lr * grad;
        b[i] += vb[i];
      }
    }

    this.epoch++;
    const avg = loss / n;
    this.lossHistory.push(avg);
    if (this.lossHistory.length > 600) this.lossHistory.shift();
    return avg;
  };

  MLP.prototype.accuracy = function (X, Y) {
    if (!X.length) return 0;
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      if ((this.predict(X[i])[0] >= 0.5 ? 1 : 0) === Y[i][0]) correct++;
    }
    return correct / X.length;
  };

  MLP.prototype.paramCount = function () {
    return this.W.reduce(function (a, w) { return a + w.length; }, 0) +
           this.b.reduce(function (a, b) { return a + b.length; }, 0);
  };

  /* ======================================================================
   * K-MEANS with k-means++ seeding
   *
   * Random seeding routinely collapses two centroids into one cluster.
   * k-means++ picks each new seed with probability proportional to its
   * squared distance from the nearest existing centroid.
   * ==================================================================== */

  function KMeans(k, opts) {
    opts = opts || {};
    this.k = k;
    this.rng = mulberry32(opts.seed || 7);
    this.centroids = [];
    this.assignments = [];
    this.iteration = 0;
    this.inertia = 0;
    this.converged = false;
  }

  function dist2(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
    return s;
  }

  KMeans.prototype.seed = function (points) {
    this.centroids = [];
    this.iteration = 0;
    this.converged = false;
    if (!points.length) return;

    this.centroids.push(points[Math.floor(this.rng() * points.length)].slice());

    while (this.centroids.length < this.k) {
      const d2 = points.map(function (p) {
        let best = Infinity;
        for (const c of this.centroids) best = Math.min(best, dist2(p, c));
        return best;
      }, this);

      const total = d2.reduce(function (a, b) { return a + b; }, 0);
      if (total === 0) {
        this.centroids.push(points[Math.floor(this.rng() * points.length)].slice());
        continue;
      }
      let r = this.rng() * total, idx = 0;
      for (let i = 0; i < d2.length; i++) {
        r -= d2[i];
        if (r <= 0) { idx = i; break; }
      }
      this.centroids.push(points[idx].slice());
    }
  };

  // One Lloyd iteration: assign, then move.
  KMeans.prototype.step = function (points) {
    if (!this.centroids.length) this.seed(points);
    if (!points.length) return { moved: 0, inertia: 0 };

    this.assignments = points.map(function (p) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < this.centroids.length; c++) {
        const d = dist2(p, this.centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    }, this);

    const sums = [], counts = [];
    for (let c = 0; c < this.k; c++) { sums.push([0, 0]); counts.push(0); }

    points.forEach(function (p, i) {
      const c = this.assignments[i];
      sums[c][0] += p[0]; sums[c][1] += p[1];
      counts[c]++;
    }, this);

    let moved = 0;
    for (let c = 0; c < this.k; c++) {
      if (counts[c] === 0) continue;   // empty cluster: leave it alone
      const nx = sums[c][0] / counts[c], ny = sums[c][1] / counts[c];
      moved += Math.sqrt(dist2([nx, ny], this.centroids[c]));
      this.centroids[c] = [nx, ny];
    }

    // inertia = within-cluster sum of squares, the objective being minimised
    this.inertia = points.reduce(function (acc, p, i) {
      return acc + dist2(p, this.centroids[this.assignments[i]]);
    }.bind(this), 0);

    this.iteration++;
    this.converged = moved < 0.0001;
    return { moved: moved, inertia: this.inertia };
  };

  /* ======================================================================
   * POLYNOMIAL REGRESSION by gradient descent on MSE.
   * Inputs normalised to [-1, 1] - without that, x^8 terms explode and the
   * whole thing diverges on the first step.
   * ==================================================================== */

  function LinReg(degree, opts) {
    opts = opts || {};
    this.degree = degree;
    this.lr = opts.lr != null ? opts.lr : 0.12;
    this.w = new Float64Array(degree + 1);
    this.steps = 0;
    this.lossHistory = [];
  }

  LinReg.prototype.features = function (x) {
    const f = new Float64Array(this.degree + 1);
    f[0] = 1;
    for (let d = 1; d <= this.degree; d++) f[d] = f[d - 1] * x;
    return f;
  };

  LinReg.prototype.predict = function (x) {
    const f = this.features(x);
    let y = 0;
    for (let i = 0; i < f.length; i++) y += this.w[i] * f[i];
    return y;
  };

  LinReg.prototype.trainStep = function (X, Y) {
    const n = X.length;
    if (!n) return 0;
    const grad = new Float64Array(this.degree + 1);
    let loss = 0;

    for (let i = 0; i < n; i++) {
      const f = this.features(X[i]);
      let pred = 0;
      for (let d = 0; d < f.length; d++) pred += this.w[d] * f[d];
      const err = pred - Y[i];
      loss += err * err;
      // dMSE/dw_d = 2/n * sum(err * x^d)
      for (let d = 0; d < f.length; d++) grad[d] += err * f[d];
    }

    for (let d = 0; d <= this.degree; d++) this.w[d] -= this.lr * (2 * grad[d] / n);

    this.steps++;
    const mse = loss / n;
    this.lossHistory.push(mse);
    if (this.lossHistory.length > 400) this.lossHistory.shift();
    return mse;
  };

  /* ======================================================================
   * SCALED DOT-PRODUCT SELF-ATTENTION
   *
   *   Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V
   *
   * Token vectors come from hashed character trigrams, so morphologically
   * related words genuinely start close together rather than being noise.
   * Sinusoidal positional encoding is added exactly as in "Attention Is All
   * You Need". Projections use fixed seeded weights - untrained, but the
   * mechanism and the maths are the real thing.
   * ==================================================================== */

  const ATT_DIM = 32;

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // char-trigram hashed embedding: "learning" and "learner" share trigrams,
  // so they land near each other without any training
  function tokenEmbedding(token, dim) {
    const v = new Float64Array(dim);
    const padded = "^" + token.toLowerCase() + "$";
    for (let i = 0; i < padded.length - 2; i++) {
      const h = hash32(padded.slice(i, i + 3));
      v[h % dim] += (h >>> 31) & 1 ? -1 : 1;
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) v[i] /= norm;
    return v;
  }

  function positionalEncoding(pos, dim) {
    const p = new Float64Array(dim);
    for (let i = 0; i < dim; i += 2) {
      const freq = 1 / Math.pow(10000, i / dim);
      p[i] = Math.sin(pos * freq);
      if (i + 1 < dim) p[i + 1] = Math.cos(pos * freq);
    }
    return p;
  }

  function randomMatrix(rows, cols, seed) {
    const rng = mulberry32(seed);
    const m = [];
    const scale = Math.sqrt(1 / rows);
    for (let i = 0; i < rows; i++) {
      const row = new Float64Array(cols);
      for (let j = 0; j < cols; j++) row[j] = randn(rng) * scale;
      m.push(row);
    }
    return m;
  }

  function matVec(M, v) {
    const out = new Float64Array(M[0].length);
    for (let i = 0; i < M.length; i++) {
      const vi = v[i];
      if (vi === 0) continue;
      const row = M[i];
      for (let j = 0; j < row.length; j++) out[j] += vi * row[j];
    }
    return out;
  }

  function softmax(arr) {
    const max = Math.max.apply(null, Array.from(arr));
    let sum = 0;
    const out = new Float64Array(arr.length);
    for (let i = 0; i < arr.length; i++) { out[i] = Math.exp(arr[i] - max); sum += out[i]; }
    for (let i = 0; i < arr.length; i++) out[i] /= sum || 1;
    return out;
  }

  function selfAttention(tokens, opts) {
    opts = opts || {};
    const dim = ATT_DIM;
    const head = opts.head || 0;
    const n = tokens.length;

    // different heads = different projection seeds, which is what makes heads
    // in a real transformer specialise on different relations
    const Wq = randomMatrix(dim, dim, 1000 + head * 37);
    const Wk = randomMatrix(dim, dim, 2000 + head * 37);
    const Wv = randomMatrix(dim, dim, 3000 + head * 37);

    const X = tokens.map(function (t, i) {
      const e = tokenEmbedding(t, dim);
      const p = positionalEncoding(i, dim);
      const x = new Float64Array(dim);
      for (let d = 0; d < dim; d++) x[d] = e[d] + 0.35 * p[d];
      return x;
    });

    const Q = X.map(function (x) { return matVec(Wq, x); });
    const K = X.map(function (x) { return matVec(Wk, x); });
    const V = X.map(function (x) { return matVec(Wv, x); });

    // scores = QK^T / sqrt(d_k). The sqrt stops dot products growing with
    // dimension and pushing softmax into one-hot saturation.
    const scale = 1 / Math.sqrt(dim);
    const scores = [];
    for (let i = 0; i < n; i++) {
      const row = new Float64Array(n);
      for (let j = 0; j < n; j++) {
        let dot = 0;
        for (let d = 0; d < dim; d++) dot += Q[i][d] * K[j][d];
        row[j] = dot * scale;
      }
      scores.push(row);
    }

    const weights = scores.map(softmax);

    const output = [];
    for (let i = 0; i < n; i++) {
      const o = new Float64Array(dim);
      for (let j = 0; j < n; j++) {
        const w = weights[i][j];
        for (let d = 0; d < dim; d++) o[d] += w * V[j][d];
      }
      output.push(o);
    }

    return { tokens: tokens, scores: scores, weights: weights, output: output, dim: dim };
  }

  /* -- Dataset generators for the playground ----------------------------- */

  const DATASETS = {
    // two interleaved spirals - not linearly separable, needs real depth
    spiral: function (n, seed) {
      const rng = mulberry32(seed || 3);
      const pts = [];
      const per = Math.floor(n / 2);
      for (let c = 0; c < 2; c++) {
        for (let i = 0; i < per; i++) {
          const r = (i / per) * 0.85;
          const t = (c * Math.PI) + (i / per) * 3.2 + (rng() - 0.5) * 0.35;
          pts.push({ x: r * Math.sin(t), y: r * Math.cos(t), label: c });
        }
      }
      return pts;
    },
    circles: function (n, seed) {
      const rng = mulberry32(seed || 5);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const c = i % 2;
        const r = c === 0 ? 0.15 + rng() * 0.25 : 0.6 + rng() * 0.25;
        const t = rng() * Math.PI * 2;
        pts.push({ x: r * Math.cos(t), y: r * Math.sin(t), label: c });
      }
      return pts;
    },
    xor: function (n, seed) {
      const rng = mulberry32(seed || 11);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = rng() * 1.7 - 0.85;
        const y = rng() * 1.7 - 0.85;
        pts.push({ x: x, y: y, label: (x > 0) === (y > 0) ? 1 : 0 });
      }
      return pts;
    },
    blobs: function (n, seed) {
      const rng = mulberry32(seed || 13);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const c = i % 2;
        const cx = c === 0 ? -0.4 : 0.4, cy = c === 0 ? -0.3 : 0.35;
        pts.push({ x: cx + randn(rng) * 0.18, y: cy + randn(rng) * 0.18, label: c });
      }
      return pts;
    }
  };

  global.ML = {
    MLP: MLP, KMeans: KMeans, LinReg: LinReg,
    selfAttention: selfAttention, tokenEmbedding: tokenEmbedding,
    positionalEncoding: positionalEncoding, softmax: softmax,
    ACT: ACT, DATASETS: DATASETS, mulberry32: mulberry32, randn: randn
  };
})(window);
