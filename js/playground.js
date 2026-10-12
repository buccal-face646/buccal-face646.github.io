/* ============================================================================
 * playground.js - wires the from-scratch algorithms in ml.js to canvases,
 * plus the RAG and agent demos.
 *
 * Nothing here is precomputed. Every frame runs a real forward pass.
 * ==========================================================================*/

(function (global) {
  "use strict";

  const COLORS = { c0: "#2f5d6e", c1: "#d98a1e", grid: "rgba(23,21,17,.06)", bg: "#f4f2ed" };
  const CLUSTER_COLORS = ["#d98a1e", "#2f5d6e", "#6b7a2f", "#b0452c", "#6e4a7e", "#3a3631"];

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Canvas is CSS-scaled, so a click in page pixels has to be mapped back
  // into the canvas's own coordinate space before it means anything.
  function canvasPos(canvas, evt) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - r.left) * (canvas.width / r.width),
      y: (evt.clientY - r.top) * (canvas.height / r.height)
    };
  }

  function drawGrid(ctx, w, h, step) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
    for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
    ctx.stroke();
  }

  /* ======================================================================
   * 1. NEURAL NETWORK TRAINER
   * ==================================================================== */

  const NN = {
    canvas: null, ctx: null, lossCanvas: null, archCanvas: null,
    net: null, points: [], running: false, raf: null,
    dataset: "spiral", layers: [8, 8], act: "tanh", lr: 0.08,
    boundary: null, boundaryAge: 0
  };

  function nnToPx(p) {
    return { x: (p.x + 1) / 2 * NN.canvas.width, y: (1 - (p.y + 1) / 2) * NN.canvas.height };
  }
  function nnToWorld(px, py) {
    return { x: (px / NN.canvas.width) * 2 - 1, y: (1 - py / NN.canvas.height) * 2 - 1 };
  }

  function nnBuild() {
    const sizes = [2].concat(NN.layers).concat([1]);
    NN.net = new global.ML.MLP(sizes, {
      activation: NN.act, lr: NN.lr, momentum: 0.9,
      seed: Math.floor(Math.random() * 100000)
    });
    NN.boundary = null;
    $("nn-params").textContent = NN.net.paramCount();
    nnUpdateStats();
    nnDrawArch();
  }

  function nnGenerate() {
    NN.points = global.ML.DATASETS[NN.dataset](220, Math.floor(Math.random() * 9999));
    NN.boundary = null;
  }

  // Recompute the decision surface on a coarse grid. A real forward pass per
  // cell - the expensive part, so it runs every few epochs, not every frame.
  function nnComputeBoundary() {
    const res = 46;
    const w = NN.canvas.width, h = NN.canvas.height;
    const cw = w / res, rows = Math.round(res * h / w), ch = h / rows;
    const grid = [];
    for (let j = 0; j < rows; j++) {
      const row = new Float32Array(res);
      for (let i = 0; i < res; i++) {
        const wpt = nnToWorld((i + 0.5) * cw, (j + 0.5) * ch);
        row[i] = NN.net.predict([wpt.x, wpt.y])[0];
      }
      grid.push(row);
    }
    NN.boundary = { grid: grid, cw: cw, ch: ch, cols: res, rows: rows };
  }

  function nnDraw() {
    const ctx = NN.ctx, w = NN.canvas.width, h = NN.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    if (NN.boundary) {
      const b = NN.boundary;
      for (let j = 0; j < b.rows; j++) {
        for (let i = 0; i < b.cols; i++) {
          const p = b.grid[j][i];
          // distance from the 0.5 boundary drives opacity, so the transition
          // band reads as a visible frontier
          const alpha = 0.05 + Math.abs(p - 0.5) * 2 * 0.24;
          ctx.fillStyle = p < 0.5
            ? "rgba(47,93,110," + alpha + ")"
            : "rgba(217,138,30," + alpha + ")";
          ctx.fillRect(i * b.cw, j * b.ch, b.cw + 1, b.ch + 1);
        }
      }
    }

    drawGrid(ctx, w, h, 40);

    NN.points.forEach(function (p) {
      const q = nnToPx(p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 4.4, 0, Math.PI * 2);
      ctx.fillStyle = p.label === 0 ? COLORS.c0 : COLORS.c1;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(247,245,240,.95)";
      ctx.stroke();
    });
  }

  function nnDrawLoss() {
    const c = NN.lossCanvas, ctx = c.getContext("2d");
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const hist = NN.net ? NN.net.lossHistory : [];
    if (hist.length < 2) return;

    const max = Math.max.apply(null, hist), min = Math.min.apply(null, hist);
    const range = (max - min) || 1;

    ctx.beginPath();
    hist.forEach(function (v, i) {
      const x = (i / (hist.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 10) - 5;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#2f5d6e"); g.addColorStop(1, "#d98a1e");
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke();

    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = "rgba(217,138,30,.12)";
    ctx.fill();
  }

  function nnDrawArch() {
    const c = NN.archCanvas, ctx = c.getContext("2d");
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    if (!NN.net) return;

    const sizes = NN.net.sizes;
    const padX = 22, padY = 12;
    const colW = (w - padX * 2) / Math.max(1, sizes.length - 1);

    const coords = sizes.map(function (n, li) {
      const x = padX + li * colW;
      const spacing = (h - padY * 2) / Math.max(1, n - 1 || 1);
      const arr = [];
      for (let i = 0; i < n; i++) arr.push({ x: x, y: n === 1 ? h / 2 : padY + i * spacing });
      return arr;
    });

    // edges tinted by weight sign and magnitude
    for (let l = 0; l < sizes.length - 1; l++) {
      const nIn = sizes[l], nOut = sizes[l + 1], W = NN.net.W[l];
      let maxAbs = 0.0001;
      for (let i = 0; i < W.length; i++) maxAbs = Math.max(maxAbs, Math.abs(W[i]));

      for (let o = 0; o < nOut; o++) {
        for (let i = 0; i < nIn; i++) {
          const wv = W[o * nIn + i];
          const strength = Math.abs(wv) / maxAbs;
          if (strength < 0.12) continue;
          ctx.beginPath();
          ctx.moveTo(coords[l][i].x, coords[l][i].y);
          ctx.lineTo(coords[l + 1][o].x, coords[l + 1][o].y);
          ctx.strokeStyle = wv > 0
            ? "rgba(47,93,110," + (strength * 0.6).toFixed(3) + ")"
            : "rgba(217,138,30," + (strength * 0.7).toFixed(3) + ")";
          ctx.lineWidth = 0.4 + strength * 1.5;
          ctx.stroke();
        }
      }
    }

    coords.forEach(function (layer) {
      layer.forEach(function (n) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#f7f5f0"; ctx.fill();
        ctx.strokeStyle = "rgba(23,21,17,.55)"; ctx.lineWidth = 1.3; ctx.stroke();
      });
    });
  }

  function nnUpdateStats() {
    if (!NN.net) return;
    $("nn-epoch").textContent = NN.net.epoch;
    const hist = NN.net.lossHistory;
    $("nn-loss-val").textContent = hist.length ? hist[hist.length - 1].toFixed(4) : "—";
    const X = NN.points.map(function (p) { return [p.x, p.y]; });
    const Y = NN.points.map(function (p) { return [p.label]; });
    $("nn-acc").textContent = NN.points.length ? (NN.net.accuracy(X, Y) * 100).toFixed(1) + "%" : "—";
  }

  function nnLoop() {
    if (!NN.running) return;
    const X = NN.points.map(function (p) { return [p.x, p.y]; });
    const Y = NN.points.map(function (p) { return [p.label]; });

    // several gradient steps per frame so training is visibly fast
    for (let i = 0; i < 5; i++) NN.net.trainStep(X, Y);

    NN.boundaryAge++;
    if (NN.boundaryAge >= 2) { nnComputeBoundary(); NN.boundaryAge = 0; }

    nnDraw(); nnDrawLoss();
    if (NN.net.epoch % 15 === 0) nnDrawArch();
    nnUpdateStats();

    NN.raf = requestAnimationFrame(nnLoop);
  }

  function nnInit() {
    NN.canvas = $("nn-canvas");
    if (!NN.canvas) return;
    NN.ctx = NN.canvas.getContext("2d");
    NN.lossCanvas = $("nn-loss");
    NN.archCanvas = $("nn-arch");

    nnGenerate(); nnBuild(); nnComputeBoundary(); nnDraw();

    $("nn-play").addEventListener("click", function () {
      NN.running = !NN.running;
      this.textContent = NN.running ? "❚❚ Pause" : "▶ Train";
      if (NN.running) nnLoop(); else cancelAnimationFrame(NN.raf);
    });

    $("nn-reset").addEventListener("click", function () {
      NN.running = false;
      $("nn-play").textContent = "▶ Train";
      cancelAnimationFrame(NN.raf);
      nnBuild(); nnComputeBoundary(); nnDraw(); nnDrawLoss();
    });

    $("nn-regen").addEventListener("click", function () {
      nnGenerate(); nnBuild(); nnComputeBoundary(); nnDraw(); nnDrawLoss();
    });

    $("nn-dataset").addEventListener("change", function () {
      NN.dataset = this.value;
      nnGenerate(); nnBuild(); nnComputeBoundary(); nnDraw(); nnDrawLoss();
    });

    $("nn-layers").addEventListener("change", function () {
      NN.layers = this.value.split(",").map(Number);
      $("nn-arch-val").textContent = NN.layers.join(" → ");
      nnBuild(); nnComputeBoundary(); nnDraw(); nnDrawLoss();
    });

    $("nn-act").addEventListener("change", function () {
      NN.act = this.value;
      nnBuild(); nnComputeBoundary(); nnDraw(); nnDrawLoss();
    });

    $("nn-lr").addEventListener("input", function () {
      NN.lr = this.value / 100;
      $("nn-lr-val").textContent = NN.lr.toFixed(3);
      if (NN.net) NN.net.lr = NN.lr;
    });

    // click to add a training point; shift-click adds the other class
    NN.canvas.addEventListener("click", function (e) {
      const p = canvasPos(NN.canvas, e);
      const wpt = nnToWorld(p.x, p.y);
      NN.points.push({ x: wpt.x, y: wpt.y, label: e.shiftKey ? 1 : 0 });
      $("nn-badge").textContent = "shift+click for class 1 · " + NN.points.length + " points";
      nnDraw();
    });
  }

  /* ======================================================================
   * 2. RAG PIPELINE PLAYGROUND
   * ==================================================================== */

  const SAMPLE_DOC =
    "Our remote work policy allows employees to work from home up to three days per week. " +
    "Requests must be approved by a direct manager and reviewed quarterly. " +
    "Employees are expected on site for team planning days, which happen every second Tuesday. " +
    "The annual leave allowance is 24 days plus public holidays, accruing monthly from the start date. " +
    "Unused leave may be carried over up to a maximum of five days into the following year. " +
    "Expense claims must be submitted within 30 days of purchase with an itemised receipt attached. " +
    "Equipment budgets are set at 1200 per employee on a two year refresh cycle.";

  function ragInit() {
    const doc = $("rag-doc");
    if (!doc) return;
    doc.value = SAMPLE_DOC;

    const cs = $("rag-cs"), ov = $("rag-ov");

    function updateStats() { $("rag-doc-stats").textContent = doc.value.length + " chars"; }
    updateStats();
    doc.addEventListener("input", updateStats);

    cs.addEventListener("input", function () { $("rag-cs-val").textContent = this.value + " chars"; });
    ov.addEventListener("input", function () { $("rag-ov-val").textContent = this.value + " chars"; });

    $("rag-run").addEventListener("click", runRag);
    $("rag-q").addEventListener("keydown", function (e) { if (e.key === "Enter") runRag(); });

    function runRag() {
      const text = doc.value.trim();
      const question = $("rag-q").value.trim();
      const out = $("rag-out");

      if (!text) { out.innerHTML = '<div class="insp-empty">Add some text to ingest first.</div>'; return; }
      if (!question) { out.innerHTML = '<div class="insp-empty">Ask a question about the text.</div>'; return; }

      const chunkSize = +cs.value, overlap = +ov.value;
      const chunks = global.RAG.chunkText(text, chunkSize, overlap);

      const docs = chunks.map(function (c, i) {
        return { id: "c" + i, title: "Chunk " + (i + 1), text: c, tags: [], source: "Your document" };
      });

      const t0 = performance.now();
      const ix = global.RAG.createIndex(docs);
      const tIndex = performance.now() - t0;

      const t1 = performance.now();
      const res = ix.search(question, Math.min(5, docs.length));
      const tSearch = performance.now() - t1;

      const reranked = global.RAG.rerank(question, res.results);
      const kept = reranked.slice(0, 2);

      let html = "";

      html += '<div class="stage"><div class="stage-label">1 · Chunked into ' + chunks.length +
              " passages (" + chunkSize + " chars, " + overlap + " overlap)</div>";
      chunks.forEach(function (c, i) {
        html += '<div class="chunk"><div class="chunk-head"><span class="chunk-title">Chunk ' + (i + 1) +
                '</span><span class="chunk-src">' + c.length + " chars</span></div>" +
                '<div class="chunk-text">' + escapeHtml(c) + "</div></div>";
      });
      html += "</div>";

      html += '<div class="stage"><div class="stage-label">2 · Indexed</div><div class="timing-row">' +
              '<span class="timing">' + ix.idf.size + " unique stems</span>" +
              '<span class="timing">' + global.RAG.EMBED_DIM + "-d vectors</span>" +
              '<span class="timing">built in ' + tIndex.toFixed(2) + "ms</span></div></div>";

      html += '<div class="stage"><div class="stage-label">3 · Query terms</div><div class="pill-row">';
      res.queryTerms.forEach(function (t) { html += '<span class="pill cyan">' + escapeHtml(t) + "</span>"; });
      if (!res.queryTerms.length) html += '<span class="pill">no content terms</span>';
      html += "</div></div>";

      html += '<div class="stage"><div class="stage-label">4 · Retrieved &amp; reranked</div>';
      const keptSet = new Set(kept.map(function (k) { return k.doc.id; }));
      reranked.forEach(function (r) {
        const isKept = keptSet.has(r.doc.id) && r.rerankScore > 0.05;
        html += '<div class="chunk ' + (isKept ? "top" : "dropped") + '">' +
                '<div class="chunk-head"><span class="chunk-title">' + escapeHtml(r.doc.title) +
                (isKept ? " ✓ sent to the model" : " · dropped") + "</span>" +
                '<span class="chunk-score">' + r.rerankScore.toFixed(3) + "</span></div>" +
                '<div class="chunk-src">cosine ' + r.score.toFixed(3) +
                " · covers " + Math.round(r.signals.coverage * 100) + "%</div>" +
                '<div class="chunk-text">' + escapeHtml(r.doc.text) + "</div></div>";
      });
      html += "</div>";

      const top = kept.filter(function (k) { return k.rerankScore > 0.05; });
      html += '<div class="stage"><div class="stage-label">5 · Grounded answer</div>';
      if (!top.length) {
        html += '<div class="note">Nothing scored above threshold. A production system refuses here rather than guessing — exactly the behaviour you want.</div>';
      } else {
        const sentences = global.RAG.splitSentences(top[0].doc.text);
        const qTerms = new Set(global.RAG.tokenize(question));
        const best = sentences.map(function (s) {
          const st = new Set(global.RAG.tokenize(s));
          let o = 0; qTerms.forEach(function (t) { if (st.has(t)) o++; });
          return { s: s.trim(), o: o };
        }).sort(function (a, b) { return b.o - a.o; })[0];

        html += '<div class="chunk top"><div class="chunk-text" style="-webkit-line-clamp:none;font-size:13.5px;color:var(--text)">' +
                escapeHtml(best.s) + ' <span class="cite">1</span></div>' +
                '<div class="chunk-src" style="margin-top:8px">grounded in ' + escapeHtml(top[0].doc.title) +
                " · retrieve " + tSearch.toFixed(2) + "ms</div></div>";
      }
      html += "</div>";

      out.innerHTML = html;
    }
  }

  /* ======================================================================
   * 3. AGENT DEMO
   * ==================================================================== */

  const AGENT_EXAMPLES = [
    "list my langgraph projects",
    "what are my strongest skills and how do I get in touch",
    "explain Sahakar Sahayak in detail",
    "what is 0.84 minus 0.46 divided by 0.46 times 100"
  ];

  const ICONS = { plan: "P", thought: "T", action: "A", observation: "O", answer: "✓" };
  const LABELS = {
    plan: "Plan", thought: "Thought", action: "Action · tool call",
    observation: "Observation", answer: "Final answer"
  };

  function agentInit() {
    const goal = $("agent-goal");
    if (!goal) return;
    const trace = $("agent-trace");
    const agent = new global.AGENT.Agent();

    const ex = $("agent-examples");
    AGENT_EXAMPLES.forEach(function (e) {
      const p = document.createElement("span");
      p.className = "pill cyan";
      p.style.cursor = "pointer";
      p.textContent = e;
      p.addEventListener("click", function () { goal.value = e; run(); });
      ex.appendChild(p);
    });

    const tools = $("agent-tools");
    global.AGENT.toolSchemas().forEach(function (t) {
      const d = document.createElement("div");
      d.style.cssText = "border:1px solid var(--border);border-radius:9px;padding:9px 11px;background:var(--surface)";
      d.innerHTML =
        '<div style="font-family:var(--mono);font-size:12px;color:var(--cyan)">' + escapeHtml(t.name) + "()</div>" +
        '<div style="font-size:11.5px;color:var(--dim);line-height:1.5;margin-top:3px">' +
        escapeHtml(t.description) + "</div>";
      tools.appendChild(d);
    });

    $("agent-run").addEventListener("click", run);
    $("agent-clear").addEventListener("click", function () {
      trace.innerHTML = '<div class="insp-empty">Give the agent a goal to watch it reason.</div>';
    });
    goal.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });

    let running = false;

    async function run() {
      if (running) return;
      const g = goal.value.trim();
      if (!g) return;
      running = true;
      trace.innerHTML = "";
      $("agent-run").disabled = true;

      await agent.run(g, async function (step) {
        const node = document.createElement("div");
        node.className = "trace-step";
        node.dataset.type = step.type;

        let html =
          '<div class="trace-icon">' + (ICONS[step.type] || "·") + "</div>" +
          '<div class="trace-kind">' + LABELS[step.type] + "</div>" +
          '<div class="trace-text">' + escapeHtml(step.text) + "</div>";

        if (step.detail) {
          html += '<span class="trace-toggle">show raw ▾</span>' +
                  '<div class="trace-detail" hidden>' + escapeHtml(step.detail) + "</div>";
        }
        node.innerHTML = html;

        const toggle = node.querySelector(".trace-toggle");
        if (toggle) {
          toggle.addEventListener("click", function () {
            const d = node.querySelector(".trace-detail");
            d.hidden = !d.hidden;
            toggle.textContent = d.hidden ? "show raw ▾" : "hide raw ▴";
          });
        }

        trace.appendChild(node);
        node.scrollIntoView({ behavior: "smooth", block: "nearest" });
        await new Promise(function (r) { setTimeout(r, 420); });
      });

      running = false;
      $("agent-run").disabled = false;
    }
  }

  /* ======================================================================
   * 4. SELF-ATTENTION HEATMAP
   * ==================================================================== */

  function attnInit() {
    const input = $("attn-text");
    if (!input) return;
    const head = $("attn-head");

    function render() {
      const tokens = input.value.trim().split(/\s+/).filter(Boolean).slice(0, 14);
      const out = $("attn-out");
      if (tokens.length < 2) {
        out.innerHTML = '<div class="insp-empty">Type at least two words.</div>';
        return;
      }

      const r = global.ML.selfAttention(tokens, { head: +head.value });
      $("attn-n").textContent = tokens.length;

      let html = '<table class="attn-table"><tr><th></th>';
      tokens.forEach(function (t) { html += "<th>" + escapeHtml(t) + "</th>"; });
      html += "</tr>";

      r.weights.forEach(function (row, i) {
        html += '<tr><th class="row-h">' + escapeHtml(tokens[i]) + "</th>";
        row.forEach(function (w, j) {
          // perceptual scaling: raw softmax over many tokens is mostly flat,
          // so a sqrt curve makes the structure visible without faking it
          const alpha = Math.min(1, Math.pow(w, 0.55) * 2.1);
          html += '<td class="attn-cell" title="' + escapeHtml(tokens[i]) + " → " +
                  escapeHtml(tokens[j]) + ": " + w.toFixed(4) + '" ' +
                  'style="background:rgba(217,138,30,' + alpha.toFixed(3) + ')">' +
                  (w > 0.14 ? (w * 100).toFixed(0) : "") + "</td>";
        });
        html += "</tr>";
      });
      html += "</table>";
      out.innerHTML = html;
    }

    head.addEventListener("input", function () { $("attn-head-val").textContent = this.value; render(); });
    $("attn-run").addEventListener("click", render);
    input.addEventListener("input", function () {
      clearTimeout(input._t);
      input._t = setTimeout(render, 420);
    });

    render();
  }

  /* ======================================================================
   * 5. K-MEANS
   * ==================================================================== */

  const KM = { canvas: null, ctx: null, points: [], model: null, running: false, timer: null, k: 3 };

  function kmSeedPoints() {
    KM.points = [];
    const rng = global.ML.mulberry32(21);
    const centres = [[180, 130], [520, 160], [340, 350], [600, 380], [140, 360], [430, 90]];
    for (let c = 0; c < KM.k + 1; c++) {
      const cc = centres[c % centres.length];
      for (let i = 0; i < 26; i++) {
        KM.points.push([cc[0] + global.ML.randn(rng) * 48, cc[1] + global.ML.randn(rng) * 44]);
      }
    }
  }

  function kmDraw() {
    const ctx = KM.ctx, w = KM.canvas.width, h = KM.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);

    const m = KM.model;

    // connect each point to its centroid - makes the assignment step legible
    if (m && m.assignments.length === KM.points.length) {
      KM.points.forEach(function (p, i) {
        const c = m.centroids[m.assignments[i]];
        if (!c) return;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]); ctx.lineTo(c[0], c[1]);
        ctx.strokeStyle = CLUSTER_COLORS[m.assignments[i] % CLUSTER_COLORS.length] + "33";
        ctx.lineWidth = 1; ctx.stroke();
      });
    }

    KM.points.forEach(function (p, i) {
      const ci = m && m.assignments.length ? m.assignments[i] : -1;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4.2, 0, Math.PI * 2);
      ctx.fillStyle = ci >= 0 ? CLUSTER_COLORS[ci % CLUSTER_COLORS.length] : "rgba(23,21,17,.3)";
      ctx.fill();
    });

    if (m) {
      m.centroids.forEach(function (c, i) {
        const col = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
        ctx.beginPath(); ctx.arc(c[0], c[1], 13, 0, Math.PI * 2);
        ctx.fillStyle = col + "26"; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c[0] - 6, c[1]); ctx.lineTo(c[0] + 6, c[1]);
        ctx.moveTo(c[0], c[1] - 6); ctx.lineTo(c[0], c[1] + 6);
        ctx.strokeStyle = "#171511"; ctx.lineWidth = 1.6; ctx.stroke();
      });
    }
  }

  function kmStats() {
    const m = KM.model;
    $("km-iter").textContent = m ? m.iteration : 0;
    $("km-inertia").textContent = m && m.inertia ? Math.round(m.inertia).toLocaleString() : "—";
    $("km-n").textContent = KM.points.length;
    $("km-state").textContent = !m ? "idle" : (m.converged ? "converged" : (KM.running ? "running" : "paused"));
  }

  function kmReset() {
    KM.model = new global.ML.KMeans(KM.k, { seed: Math.floor(Math.random() * 99999) });
    KM.model.seed(KM.points);
    kmDraw(); kmStats();
  }

  function kmInit() {
    KM.canvas = $("km-canvas");
    if (!KM.canvas) return;
    KM.ctx = KM.canvas.getContext("2d");

    kmSeedPoints(); kmReset();

    $("km-k").addEventListener("input", function () {
      KM.k = +this.value;
      $("km-k-val").textContent = this.value;
      kmSeedPoints(); kmReset();
    });

    $("km-step").addEventListener("click", function () {
      if (!KM.model) kmReset();
      KM.model.step(KM.points);
      kmDraw(); kmStats();
    });

    $("km-play").addEventListener("click", function () {
      KM.running = !KM.running;
      this.textContent = KM.running ? "❚❚ Pause" : "▶ Run";
      if (KM.running) {
        KM.timer = setInterval(function () {
          if (!KM.model) kmReset();
          KM.model.step(KM.points);
          kmDraw(); kmStats();
          if (KM.model.converged) {
            clearInterval(KM.timer);
            KM.running = false;
            $("km-play").textContent = "▶ Run";
            kmStats();
          }
        }, 620);
      } else {
        clearInterval(KM.timer);
        kmStats();
      }
    });

    $("km-reset").addEventListener("click", function () {
      clearInterval(KM.timer);
      KM.running = false;
      $("km-play").textContent = "▶ Run";
      kmSeedPoints(); kmReset();
    });

    KM.canvas.addEventListener("click", function (e) {
      const p = canvasPos(KM.canvas, e);
      KM.points.push([p.x, p.y]);
      kmDraw(); kmStats();
    });
  }

  /* ======================================================================
   * 6. POLYNOMIAL REGRESSION
   * ==================================================================== */

  const REG = { canvas: null, ctx: null, points: [], model: null, running: false, raf: null, degree: 3 };

  function regToPx(x, y) {
    return { x: (x + 1) / 2 * REG.canvas.width, y: (1 - (y + 1) / 2) * REG.canvas.height };
  }
  function regToWorld(px, py) {
    return { x: (px / REG.canvas.width) * 2 - 1, y: (1 - py / REG.canvas.height) * 2 - 1 };
  }

  function regSeed() {
    REG.points = [];
    const rng = global.ML.mulberry32(9);
    for (let i = 0; i < 24; i++) {
      const x = -0.92 + (i / 23) * 1.84;
      // a wave with noise - degree 1 underfits, degree 8 overfits
      const y = 0.55 * Math.sin(x * 3.1) - 0.25 * x + global.ML.randn(rng) * 0.09;
      REG.points.push({ x: x, y: Math.max(-0.95, Math.min(0.95, y)) });
    }
  }

  function regBuild() {
    REG.model = new global.ML.LinReg(REG.degree, { lr: +$("reg-lr").value / 100 });
  }

  function regDraw() {
    const ctx = REG.ctx, w = REG.canvas.width, h = REG.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);

    const o = regToPx(0, 0);
    ctx.strokeStyle = "rgba(23,21,17,.22)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, o.y); ctx.lineTo(w, o.y);
    ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h);
    ctx.stroke();

    if (REG.model) {
      ctx.beginPath();
      let started = false;
      for (let px = 0; px <= w; px += 3) {
        const wx = (px / w) * 2 - 1;
        const wy = REG.model.predict(wx);
        if (!isFinite(wy)) continue;
        const p = regToPx(wx, Math.max(-3, Math.min(3, wy)));
        started ? ctx.lineTo(p.x, p.y) : (ctx.moveTo(p.x, p.y), started = true);
      }
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "#2f5d6e"); g.addColorStop(1, "#d98a1e");
      ctx.strokeStyle = g; ctx.lineWidth = 2.6; ctx.stroke();
    }

    REG.points.forEach(function (pt) {
      const p = regToPx(pt.x, pt.y);
      if (REG.model) {
        const pred = regToPx(pt.x, Math.max(-3, Math.min(3, REG.model.predict(pt.x))));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(pred.x, pred.y);
        ctx.strokeStyle = "rgba(217,138,30,.5)"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.6, 0, Math.PI * 2);
      ctx.fillStyle = "#171511"; ctx.fill();
      ctx.strokeStyle = "rgba(247,245,240,.95)"; ctx.lineWidth = 1.6; ctx.stroke();
    });
  }

  function regLoop() {
    if (!REG.running) return;
    const X = REG.points.map(function (p) { return p.x; });
    const Y = REG.points.map(function (p) { return p.y; });
    for (let i = 0; i < 6; i++) REG.model.trainStep(X, Y);

    regDraw();
    $("reg-steps").textContent = REG.model.steps;
    const h = REG.model.lossHistory;
    $("reg-mse").textContent = h.length ? h[h.length - 1].toFixed(5) : "—";

    REG.raf = requestAnimationFrame(regLoop);
  }

  function regInit() {
    REG.canvas = $("reg-canvas");
    if (!REG.canvas) return;
    REG.ctx = REG.canvas.getContext("2d");

    regSeed(); regBuild(); regDraw();

    $("reg-deg").addEventListener("input", function () {
      REG.degree = +this.value;
      $("reg-deg-val").textContent = this.value;
      regBuild(); regDraw();
      $("reg-steps").textContent = "0";
      $("reg-mse").textContent = "—";
    });

    $("reg-lr").addEventListener("input", function () {
      $("reg-lr-val").textContent = (this.value / 100).toFixed(3);
      if (REG.model) REG.model.lr = this.value / 100;
    });

    $("reg-play").addEventListener("click", function () {
      REG.running = !REG.running;
      this.textContent = REG.running ? "❚❚ Pause" : "▶ Fit";
      if (REG.running) regLoop(); else cancelAnimationFrame(REG.raf);
    });

    $("reg-reset").addEventListener("click", function () {
      REG.running = false;
      $("reg-play").textContent = "▶ Fit";
      cancelAnimationFrame(REG.raf);
      regBuild(); regDraw();
      $("reg-steps").textContent = "0";
      $("reg-mse").textContent = "—";
    });

    $("reg-clear").addEventListener("click", function () {
      REG.points = [];
      regBuild(); regDraw();
    });

    REG.canvas.addEventListener("click", function (e) {
      const p = canvasPos(REG.canvas, e);
      const wpt = regToWorld(p.x, p.y);
      REG.points.push({ x: wpt.x, y: wpt.y });
      regDraw();
    });
  }

  /* -- Tabs --------------------------------------------------------------- */

  function tabsInit() {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
        document.querySelectorAll(".tab-panel").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        const panel = document.querySelector('[data-panel="' + t.dataset.tab + '"]');
        if (panel) panel.classList.add("active");
      });
    });
  }

  function init() {
    tabsInit(); nnInit(); ragInit(); agentInit(); attnInit(); kmInit(); regInit();
  }

  global.PLAYGROUND = { init: init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
