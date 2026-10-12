/* ============================================================================
 * main.js - renders PROFILE into the page, plus all the ambient UI:
 * animated neural background, typing effect, scroll reveals, nav state,
 * cursor spotlight, and a Ctrl+K command palette.
 * ==========================================================================*/

(function (global) {
  "use strict";

  const P = global.PROFILE;
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  const reduceMotion = global.matchMedia &&
    global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -- Link safety ---------------------------------------------------------
   * A "View code" button that 404s is worse than no button: the whole page
   * argues the work is real and checkable, so one dead link undoes it.
   * Anything holding a placeholder returns null and isn't rendered. Fill the
   * URL in and the button reappears on its own.
   * --------------------------------------------------------------------- */
  const PLACEHOLDERS = ["yourhandle", "yourusername", "example.com", "TODO"];

  function safeLink(url) {
    if (!url || typeof url !== "string") return null;
    const u = url.trim();
    if (!u || u === "#") return null;
    for (const bad of PLACEHOLDERS) {
      if (u.toLowerCase().indexOf(bad.toLowerCase()) >= 0) return null;
    }
    return u;
  }

  // neura-skills.js builds links inside Neura's answers; one guard, not two.
  global.SITE = { safeLink: safeLink };

  // Tell the owner (not the visitor) what's still missing.
  function warnMissingLinks() {
    const missing = [];
    if (!safeLink(P.links.github)) missing.push("PROFILE.links.github");
    (P.projects || []).forEach(function (pr) {
      if (!safeLink(pr.links && pr.links.github)) missing.push('project "' + pr.name + '" repo link');
    });
    if (missing.length) {
      console.warn(
        "%c" + missing.length + " link(s) missing — hidden rather than shipped broken:\n  " +
        missing.join("\n  ") + "\n\nFill them in js/profile.js and they appear automatically.",
        "color:#fbbf24;line-height:1.6"
      );
    }
  }

  /* -- Toast -------------------------------------------------------------- */
  let toastTimer;
  global.toast = function (msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  };

  /* ======================================================================
   * FIBRE-STRAND FIELD
   *
   * The hero's one dramatic visual, after the reference: bundles of dark
   * filaments sweeping down through the card and ending in glowing amber
   * tips. Each strand is a cubic Bezier whose tip and second control point
   * drift on slow, phase-offset sine waves, so the bundle breathes rather
   * than looping. Nearer (thicker, darker) strands move more under the
   * pointer, which gives the field depth without any 3D.
   * ==================================================================== */

  function strandField() {
    const canvas = $("strand-canvas");
    if (!canvas) return;
    const card = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, strands = [], sparks = [], raf = null, running = false;
    let mx = 0, my = 0, tmx = 0, tmy = 0;   // smoothed pointer parallax

    function rand(a, b) { return a + Math.random() * (b - a); }

    function makeStrand(baseX, tipX, tipY) {
      const depth = Math.random();   // 0 = far, 1 = near
      return {
        bx: baseX, by: -0.08,
        tx: tipX, ty: tipY,
        // drop down out of the corner, then run in almost level to the tip -
        // the long sweep of a fibre bundle under its own weight
        c1x: baseX + rand(0.12, 0.3), c1y: rand(0.14, 0.26),
        c2x: tipX - rand(0.14, 0.3),  c2y: tipY - rand(-0.04, 0.08),
        depth: depth,
        width: 0.6 + depth * 2.6,
        ph: rand(0, Math.PI * 2),
        f: rand(0.25, 0.6),
        amp: rand(4, 11),
        glow: rand(0.55, 1)
      };
    }

    function build() {
      strands = [];
      // One bundle, entering tight at the top-left corner and fanning out to
      // the right. Tip height is tied to each strand's position across the
      // bundle (u), so neighbouring fibres stay neighbours and the bundle
      // splays instead of tangling. Random tips per strand made it look like
      // an explosion around Neura's head.
      const N = 72;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        strands.push(makeStrand(
          -0.16 + u * 0.3 + rand(-0.03, 0.03),
          0.6 + rand(0, 0.38) * (0.55 + u * 0.45),
          0.16 + u * 0.32 + rand(-0.035, 0.035)
        ));
      }
      // far strands first so near ones overlap them
      strands.sort(function (a, b) { return a.depth - b.depth; });

      sparks = [];
      for (let i = 0; i < 26; i++) {
        sparks.push({ x: rand(0.04, 0.96), y: rand(0, 1), r: rand(0.6, 1.8), ph: rand(0, 6.28), sp: rand(0.012, 0.03) });
      }
    }

    function resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      w = card.clientWidth;
      h = card.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t) {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;

      for (const s of strands) {
        const sway = Math.sin(t * s.f + s.ph);
        const sway2 = Math.cos(t * s.f * 0.7 + s.ph * 1.3);
        const par = 6 + s.depth * 14;
        const tx = s.tx * w + sway * s.amp + mx * par;
        const ty = s.ty * h + sway2 * s.amp * 0.6 + my * par * 0.6;
        const c2x = s.c2x * w + sway * s.amp * 0.6 + mx * par * 0.6;
        const c2y = s.c2y * h + sway2 * s.amp * 0.4;
        const c1x = s.c1x * w + sway2 * 3;
        const c1y = s.c1y * h;
        const bx = s.bx * w, by = s.by * h;

        // dark fibre that warms into amber as it nears the tip
        const a = 0.22 + s.depth * 0.62;
        const g = ctx.createLinearGradient(bx, by, tx, ty);
        g.addColorStop(0,    "rgba(30,22,15,0)");
        g.addColorStop(0.35, "rgba(38,26,16," + (a * 0.8).toFixed(3) + ")");
        g.addColorStop(0.82, "rgba(96,58,22," + a.toFixed(3) + ")");
        g.addColorStop(1,    "rgba(226,150,44," + Math.min(1, a + 0.25).toFixed(3) + ")");

        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
        ctx.strokeStyle = g;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.stroke();

        s._tx = tx; s._ty = ty;
      }

      // tips go on after every fibre, so no strand ever crosses a light
      for (const s of strands) {
        const pulse = 0.78 + 0.22 * Math.sin(t * 1.6 + s.ph * 2);
        const r = (4 + s.depth * 7) * pulse;
        const halo = ctx.createRadialGradient(s._tx, s._ty, 0, s._tx, s._ty, r * 2.1);
        halo.addColorStop(0,    "rgba(255,214,120," + (0.72 * s.glow).toFixed(3) + ")");
        halo.addColorStop(0.35, "rgba(242,170,60," + (0.36 * s.glow).toFixed(3) + ")");
        halo.addColorStop(1,    "rgba(217,138,30,0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(s._tx, s._ty, r * 2.1, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "rgba(255,247,220," + (0.9 * s.glow).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(s._tx, s._ty, 1 + s.depth * 1.8, 0, Math.PI * 2); ctx.fill();
      }

      // drifting sparks, rising slowly and twinkling
      for (const p of sparks) {
        const y = (((p.y - t * p.sp) % 1) + 1) % 1 * h * 0.62;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + p.ph));
        ctx.fillStyle = "rgba(242,178,72," + (0.7 * tw).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p.x * w + Math.sin(t * 0.5 + p.ph) * 6, y, p.r, 0, Math.PI * 2); ctx.fill();
      }

      // Erase everything below the stage so the bubble, chips and input sit on
      // a clean ground. destination-out removes pixels in proportion to alpha.
      ctx.globalCompositeOperation = "destination-out";
      const fade = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.7);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);
      ctx.globalCompositeOperation = "source-over";
    }

    function loop(now) {
      if (!running) return;
      draw(now / 1000);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    build();
    resize();
    draw(2.2);   // paint a frame straight away, before any animation starts

    if (reduceMotion) return;   // the still frame is the whole effect

    // only animate while the card is actually on screen
    if ("IntersectionObserver" in global) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
      }).observe(card);
    } else {
      start();
    }

    // the card grows and shrinks as Neura's answers change length
    if ("ResizeObserver" in global) {
      new ResizeObserver(function () { resize(); if (!running) draw(2.2); }).observe(card);
    } else {
      global.addEventListener("resize", resize);
    }

    card.addEventListener("mousemove", function (e) {
      const r = card.getBoundingClientRect();
      tmx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      tmy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    card.addEventListener("mouseleave", function () { tmx = 0; tmy = 0; });
  }

  /* ======================================================================
   * HERO: typing effect + terminal boot sequence
   * ==================================================================== */

  function typeEffect() {
    const target = $("typed");
    if (!target) return;
    const phrases = [P.role, "Generative AI · LLM systems", "RAG & retrieval", "Multi-agent orchestration"];
    if (reduceMotion) { target.textContent = phrases[0]; return; }

    let pi = 0, ci = 0, deleting = false;

    function tick() {
      const full = phrases[pi];
      ci += deleting ? -1 : 1;
      target.textContent = full.slice(0, ci);

      let delay = deleting ? 34 : 68;
      if (!deleting && ci === full.length) { delay = 1900; deleting = true; }
      else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 380; }
      setTimeout(tick, delay);
    }
    tick();
  }

  const TERM_LINES = [
    { cls: "t-prompt", text: "$ ", cmd: "python -m eval.run --suite sahakar --k 5" },
    { cls: "t-out",  text: "  loading embeddings ....... bge-m3 (multilingual)" },
    { cls: "t-out",  text: "  connecting vectorstore ... qdrant" },
    { cls: "t-ok",   text: "  ✓ 23 documents · 673 pages · 4 languages" },
    { cls: "t-out",  text: "" },
    { cls: "t-key",  text: "  [baseline]   TF-IDF            recall@5  0.46" },
    { cls: "t-key",  text: "  [hybrid]     bge-m3+BM25/RRF   recall@5  0.72" },
    { cls: "t-key",  text: "  [+reranker]  cross-encoder     recall@5  0.84" },
    { cls: "t-out",  text: "" },
    { cls: "t-out",  text: "  The reranker alone accounts for +0.12 (p < 0.001)." },
    { cls: "t-out",  text: "  Dense catches paraphrase, BM25 catches exact legal" },
    { cls: "t-out",  text: "  terminology, and the cross-encoder scores the pair" },
    { cls: "t-out",  text: "  jointly instead of each side alone." },
    { cls: "t-out",  text: "" },
    { cls: "t-key",  text: "  [guardrails] false blocks  8/16  →  0/16" },
    { cls: "t-key",  text: "  [red team]   attacks through     0/32" },
    { cls: "t-warn", text: "  304 questions · 99.3% language match" },
    { cls: "t-ok",   text: "  ✓ 90% of unanswerables correctly refused" }
  ];

  function terminalBoot() {
    const body = $("term-body");
    if (!body) return;

    if (reduceMotion) {
      TERM_LINES.forEach(function (l) {
        const d = document.createElement("div");
        d.className = "term-line " + l.cls;
        d.style.animation = "none";
        d.style.opacity = 1;
        d.textContent = (l.cmd ? "$ " + l.cmd : l.text);
        body.appendChild(d);
      });
      return;
    }

    let i = 0;
    function next() {
      if (i >= TERM_LINES.length) {
        setTimeout(function () { body.innerHTML = ""; i = 0; next(); }, 7000);
        return;
      }
      const l = TERM_LINES[i];
      const d = document.createElement("div");
      d.className = "term-line " + l.cls;
      body.appendChild(d);

      if (l.cmd) {
        d.innerHTML = '<span class="t-prompt">$ </span><span class="t-cmd"></span>';
        const span = d.querySelector(".t-cmd");
        let ci = 0;
        (function typeCmd() {
          span.textContent = l.cmd.slice(0, ++ci);
          if (ci < l.cmd.length) setTimeout(typeCmd, 22);
          else { i++; setTimeout(next, 360); }
        })();
      } else {
        d.textContent = l.text || " ";
        i++;
        setTimeout(next, l.text ? 170 : 90);
      }
    }
    next();
  }

  /* ======================================================================
   * RENDER PROFILE DATA
   * ==================================================================== */

  function renderIdentity() {
    document.title = P.name + " — " + P.role;
    $("logo-name").textContent = P.name.toUpperCase().replace(/\s+/g, "_");
    $("logo-role").textContent = "[ " + P.role.toLowerCase() + " ]";
    $("avail-text").textContent = P.availableText;
    $("hero-desc").textContent = P.tagline;
    $("year").textContent = new Date().getFullYear();
    $("foot-name").textContent = P.name;

    const heroName = $("hero-name");
    if (heroName) heroName.textContent = P.name + " · " + P.location;

    const resumeUrl = safeLink(P.links.resume);
    [$("resume-link"), $("nav-resume")].forEach(function (a) {
      if (!a) return;
      if (resumeUrl) { a.href = resumeUrl; a.setAttribute("download", ""); }
      else a.style.display = "none";
    });

    const gh = safeLink(P.links.github);
    const src = $("foot-source");
    if (gh) src.href = gh; else src.style.display = "none";
  }

  /* -- At a glance: the block a non-technical screener actually reads ----- */
  function renderGlance() {
    const box = $("glance");
    const q = P.quickFacts;
    if (!box || !q) return;

    const rows = [
      ["Seeking",      q.seeking,      "target"],
      ["Looking for",  q.employment,   "briefcase"],
      ["Based in",     q.location + " · " + q.relocation, "pin"],
      ["Availability", q.availability, "clock"],
      ["Education",    q.education,    "cap"]
    ];

    const ICONS = {
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
      briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      pin:    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
      clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      cap:    '<path d="M22 9 12 4 2 9l10 5 10-5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>'
    };

    box.innerHTML =
      rows.map(function (r) {
        return '<div class="glance-item">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
            ICONS[r[2]] + "</svg>" +
          "<div><span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></div>" +
        "</div>";
      }).join("") +
      '<div class="glance-item glance-core"><div><span>Core stack</span><b>' +
        q.core.map(function (c) { return "<i>" + esc(c) + "</i>"; }).join("") +
      "</b></div></div>";
  }

  function renderMetrics() {
    $("metrics").innerHTML = P.metrics.map(function (m) {
      // Only a single number with optional prefix/suffix counts up ("0.84",
      // "~70%", "673"). Something like "0/32" stays as written.
      const parts = String(m.value).match(/^([^\d]*)(\d+(?:\.\d+)?)([^\d]*)$/);
      const data = parts
        ? ' data-num="' + parts[2] + '" data-dec="' + ((parts[2].split(".")[1] || "").length) +
          '" data-pre="' + esc(parts[1]) + '" data-suf="' + esc(parts[3]) + '" data-final="' + esc(m.value) + '"'
        : "";
      return '<div class="metric"><div class="metric-v"' + data + ">" + esc(m.value) + "</div>" +
             '<div class="metric-l">' + esc(m.label) + "</div>" +
             '<div class="metric-s">' + esc(m.sub) + "</div></div>";
    }).join("");
  }

  // Count the headline numbers up from zero when they first appear. The real
  // value is already in the HTML, and a timeout restores it, so a hidden tab
  // (where rAF never fires) or reduced motion can never leave a number at 0.
  function countUp() {
    const els = document.querySelectorAll(".metric-v[data-num]");
    if (!els.length || reduceMotion || !("IntersectionObserver" in global)) return;
    const io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      if (document.visibilityState !== "visible") return;
      els.forEach(function (el) {
        const target = parseFloat(el.dataset.num), dec = +el.dataset.dec;
        const t0 = performance.now(), dur = 1400;
        (function tick(now) {
          const k = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          el.textContent = el.dataset.pre + (target * eased).toFixed(dec) + el.dataset.suf;
          if (k < 1) requestAnimationFrame(tick);
        })(t0);
        setTimeout(function () { el.textContent = el.dataset.final; }, dur + 250);
      });
    }, { threshold: 0.3 });
    io.observe($("metrics"));
  }

  // Two identical halves: the track slides by exactly -50% and loops seamlessly.
  function renderMarquee() {
    const track = $("marquee-track");
    if (!track || !P.marquee) return;
    const items = P.marquee.map(function (t, i) {
      return '<span class="mq-item' + (i % 2 ? " mq-outline" : "") + '">' + esc(t) + "</span>" +
             '<span class="mq-star">&#10022;</span>';
    }).join("");
    track.innerHTML = '<div class="mq-half">' + items + '</div><div class="mq-half">' + items + "</div>";
  }

  const SKILL_ICONS = {
    brain: '<path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 3 3 3 3 0 0 0 6 0 3 3 0 0 0 3-3v-1a3 3 0 0 0 0-6V9a3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 8h.01M7 17h.01"/>'
  };

  function renderSkills() {
    $("skills-grid").innerHTML = P.skills.map(function (g) {
      const rows = g.items.map(function (s) {
        return '<div class="skill-row">' +
                 '<div class="skill-meta"><span>' + esc(s.name) + "</span><span>" + s.level + "</span></div>" +
                 '<div class="skill-track"><div class="skill-fill" data-level="' + s.level + '"></div></div>' +
               "</div>";
      }).join("");

      return '<div class="card">' +
               '<div class="skill-cat-head">' +
                 '<div class="skill-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                 (SKILL_ICONS[g.icon] || SKILL_ICONS.cpu) + "</svg></div>" +
                 "<h3>" + esc(g.category) + "</h3>" +
               "</div>" + rows +
             "</div>";
    }).join("");
  }

  function renderAlsoSkills() {
    const box = $("also-skills");
    if (!box) return;
    box.innerHTML = (P.skillsAlso || []).map(function (s) { return '<span class="tech">' + esc(s) + "</span>"; }).join("");
  }

  function projLinks(p, small) {
    const out = [];
    const demo = safeLink(p.links && p.links.demo);
    const gh = safeLink(p.links && p.links.github);
    const cls = small ? "btn btn-sm" : "btn btn-sm";
    if (demo && demo.charAt(0) !== "#") {
      out.push('<a class="' + cls + ' btn-primary" href="' + esc(demo) + '" target="_blank" rel="noopener">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>' +
        " See it live</a>");
    } else if (demo) {
      out.push('<a class="' + cls + '" href="' + esc(demo) + '">Try it below</a>');
    }
    if (gh) out.push('<a class="' + cls + '" href="' + esc(gh) + '" target="_blank" rel="noopener">View code</a>');
    return out;
  }

  function renderProjects() {
    const featured = P.projects.filter(function (p) { return p.featured; });
    const rest = P.projects.filter(function (p) { return !p.featured; });

    $("proj-featured").innerHTML = featured.map(function (p) {
      const links = projLinks(p);
      return '<div class="card proj-featured">' +
        '<div class="proj-head"><div>' +
          '<div class="proj-title">' + esc(p.name) + "</div>" +
          (p.subtitle ? '<div class="proj-sub">' + esc(p.subtitle) + "</div>" : "") +
          '<div class="proj-year">' + esc(p.year) + "</div>" +
        "</div>" +
        '<span class="status-tag">' + esc(p.status) + "</span></div>" +
        '<p class="proj-blurb">' + esc(p.blurb) + "</p>" +
        '<div class="hl-list">' + p.highlights.map(function (h) {
          return '<div class="hl">' + esc(h) + "</div>";
        }).join("") + "</div>" +
        '<div class="stack-row">' + p.stack.map(function (t) {
          return '<span class="tech">' + esc(t) + "</span>";
        }).join("") + "</div>" +
        (links.length ? '<div class="btn-row" style="margin-top:20px">' + links.join("") + "</div>" : "") +
      "</div>";
    }).join("");

    $("proj-grid").innerHTML = rest.map(function (p) {
      const links = projLinks(p, true);
      return '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">' +
          "<div><div class=\"proj-card-title\">" + esc(p.name) + "</div>" +
          (p.subtitle ? '<div class="proj-sub">' + esc(p.subtitle) + "</div>" : "") + "</div>" +
          '<span class="proj-year">' + esc(p.year) + "</span>" +
        "</div>" +
        '<span class="status-tag" style="font-size:10px">' + esc(p.status) + "</span>" +
        '<p class="proj-card-blurb">' + esc(p.blurb) + "</p>" +
        '<div class="stack-row">' + p.stack.map(function (t) {
          return '<span class="tech">' + esc(t) + "</span>";
        }).join("") + "</div>" +
        (links.length ? '<div class="btn-row" style="margin-top:16px">' + links.join("") + "</div>" : "") +
      "</div>";
    }).join("");
  }

  function renderAbout() {
    $("about-text").innerHTML = P.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    $("now-list").innerHTML = P.now.map(function (n) {
      return '<div class="hl" style="font-size:13.5px">' + esc(n) + "</div>";
    }).join("");

    const exp = P.experience.map(function (e) {
      return '<div class="tl-item">' +
        '<div class="tl-period">' + esc(e.period) + "</div>" +
        '<div class="tl-role">' + esc(e.role) + "</div>" +
        '<div class="tl-org">' + esc(e.org) + "</div>" +
        '<ul class="tl-points" style="list-style:none;padding:0">' +
          e.points.map(function (pt) { return '<li class="hl">' + esc(pt) + "</li>"; }).join("") +
        "</ul></div>";
    }).join("");

    const edu = P.education.map(function (e) {
      return '<div class="tl-item">' +
        '<div class="tl-period">' + esc(e.period) + "</div>" +
        '<div class="tl-role">' + esc(e.degree) + "</div>" +
        '<div class="tl-org">' + esc(e.org) + "</div>" +
        '<div style="font-size:14px;color:var(--muted)">' + esc(e.detail) + "</div>" +
      "</div>";
    }).join("");

    $("timeline").innerHTML = exp + edu;

    const certs = $("cert-list");
    if (certs) {
      certs.innerHTML = (P.certifications || []).map(function (c) {
        return '<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;' +
               'padding-bottom:9px;border-bottom:1px solid var(--border)">' +
               '<span style="font-size:14px">' + esc(c.name) + "</span>" +
               '<span class="chunk-src">' + esc(c.issuer) + "</span></div>";
      }).join("");
    }

    const leads = $("lead-list");
    if (leads) {
      leads.innerHTML = (P.leadership || []).map(function (l) {
        return "<div>" +
          '<div style="font-size:14.5px;font-weight:570">' + esc(l.role) + "</div>" +
          '<div style="font-size:12.5px;color:var(--cyan);font-family:var(--mono);margin:2px 0 6px">' +
            esc(l.org) + "</div>" +
          '<div style="font-size:13.5px;color:var(--muted);line-height:1.55">' + esc(l.detail) + "</div>" +
        "</div>";
      }).join("");
    }
  }

  function renderContact() {
    $("contact-blurb").textContent =
      P.availableText + ". The fastest way to reach me is email — or ask Neura above, she knows my background better than a résumé does.";

    const acts = [];
    acts.push('<a class="btn btn-primary" href="mailto:' + esc(P.email) + '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg> ' +
      esc(P.email) + "</a>");

    const liUrl = safeLink(P.links.linkedin);
    const ghUrl = safeLink(P.links.github);
    const cvUrl = safeLink(P.links.resume);
    const twUrl = safeLink(P.links.twitter);
    if (liUrl) acts.push('<a class="btn" href="' + esc(liUrl) + '" target="_blank" rel="noopener">LinkedIn</a>');
    if (ghUrl) acts.push('<a class="btn" href="' + esc(ghUrl) + '" target="_blank" rel="noopener">GitHub</a>');
    if (cvUrl) acts.push('<a class="btn" href="' + esc(cvUrl) + '" download>Download résumé</a>');
    if (twUrl) acts.push('<a class="btn" href="' + esc(twUrl) + '" target="_blank" rel="noopener">Twitter</a>');
    if (P.phone) acts.push('<a class="btn btn-ghost" href="tel:' + esc(P.phone.replace(/\s/g, "")) + '">' + esc(P.phone) + "</a>");

    $("contact-actions").innerHTML = acts.join("");
  }

  /* ======================================================================
   * SCROLL: progress, reveals, nav state, skill bars
   * ==================================================================== */

  function scrollBehaviour() {
    const nav = $("nav");
    const bar = $("scroll-progress");
    const sections = Array.prototype.slice.call(document.querySelectorAll("section[id], header[id]"));
    const links = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));

    // rAF-throttled: scroll fires far more often than the screen repaints, and
    // reading offsetTop on every event forces a layout each time
    let queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        const y = global.scrollY;
        nav.classList.toggle("scrolled", y > 24);

        if (bar) {
          const max = document.documentElement.scrollHeight - global.innerHeight;
          bar.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + "%";
        }

        let current = "";
        sections.forEach(function (s) { if (y >= s.offsetTop - 140) current = s.id; });
        links.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + current);
        });
      });
    }
    global.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Reveal on enter.
    //
    // threshold must be 0, not a fraction: a percentage threshold on a tall
    // element (the 620px chat panel) means it can be clearly on screen and
    // still sit at opacity 0 while the reader waits for it.
    const revealTargets = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in global)) {
      revealTargets.forEach(function (n) { n.classList.add("in"); });
    } else {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: 0, rootMargin: "0px 0px -80px 0px" });

      revealTargets.forEach(function (n) { io.observe(n); });

      // Belt and braces: nothing should ever be left invisible.
      setTimeout(function () {
        revealTargets.forEach(function (n) {
          const r = n.getBoundingClientRect();
          if (r.top < global.innerHeight && r.bottom > 0) n.classList.add("in");
        });
      }, 1200);
    }

    // fill skill bars once visible
    const skillIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll(".skill-fill").forEach(function (f, i) {
          setTimeout(function () { f.style.width = f.dataset.level + "%"; }, i * 60);
        });
        skillIo.unobserve(e.target);
      });
    }, { threshold: 0.1 });

    const sg = $("skills-grid");
    if (sg) skillIo.observe(sg);
  }

  /* -- Cursor spotlight on cards ------------------------------------------ */
  function cardSpotlight() {
    if (reduceMotion) return;
    if (global.matchMedia && global.matchMedia("(hover: none)").matches) return;

    document.addEventListener("mousemove", function (e) {
      const card = e.target.closest(".card, .step, .hero-bot, .glance-item");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
  }

  /* ======================================================================
   * COMMAND PALETTE (Ctrl/Cmd + K)
   * ==================================================================== */

  function palette() {
    const bg = $("palette-bg");
    const input = $("palette-input");
    const list = $("palette-list");
    if (!bg) return;

    const NAV_ITEMS = [
      { icon: "◈", label: "Assistant", hint: "section", action: function () { go("#assistant"); } },
      { icon: "▤", label: "Projects", hint: "section", action: function () { go("#projects"); } },
      { icon: "⚡", label: "Playground", hint: "section", action: function () { go("#playground"); } },
      { icon: "◆", label: "Skills", hint: "section", action: function () { go("#skills"); } },
      { icon: "☰", label: "About", hint: "section", action: function () { go("#about"); } },
      { icon: "✉", label: "Contact", hint: "section", action: function () { go("#contact"); } },
      { icon: "✓", label: "Match a job description", hint: "neura", action: function () {
          close(); global.NEURA && global.NEURA.openMatcher();
        } },
      { icon: "✦", label: "Pitch me", hint: "neura", action: function () {
          close(); global.NEURA && global.NEURA.pitch();
        } },
      { icon: "→", label: "Take the tour", hint: "neura", action: function () {
          close(); global.NEURA && global.NEURA.startTour();
        } },
      { icon: "⧉", label: "Copy email address", hint: "action", action: function () {
          navigator.clipboard.writeText(P.email).then(function () {
            global.toast("Email copied: " + P.email);
          }).catch(function () { global.toast(P.email); });
        } },
      { icon: "↗", label: "Open GitHub", hint: "link", action: function () {
          const u = safeLink(P.links.github);
          if (u) global.open(u, "_blank", "noopener");
        } },
      { icon: "↗", label: "Open LinkedIn", hint: "link", action: function () {
          const u = safeLink(P.links.linkedin);
          if (u) global.open(u, "_blank", "noopener");
        } }
    ];

    let items = [], sel = 0;

    function go(hash) {
      close();
      const t = document.querySelector(hash);
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function askAssistant(q) {
      close();
      if (global.NEURA && global.NEURA.looksLikeJD(q)) { global.NEURA.openMatcher(q); return; }
      const s = document.querySelector("#assistant");
      if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(function () { global.CHAT && global.CHAT.ask(q); }, 520);
    }

    function render(query) {
      const q = query.trim().toLowerCase();
      items = NAV_ITEMS.filter(function (i) { return !q || i.label.toLowerCase().includes(q); });

      if (q.length > 2) {
        items = items.concat([{
          icon: "✦", label: 'Ask Neura: "' + query.trim() + '"', hint: "enter",
          action: function () { askAssistant(query.trim()); }
        }]);
      }

      sel = 0;
      if (!items.length) { list.innerHTML = '<div class="palette-empty">Nothing matched.</div>'; return; }
      list.innerHTML = items.map(function (i, idx) {
        return '<div class="palette-item' + (idx === 0 ? " sel" : "") + '" data-i="' + idx + '">' +
          '<span class="pi-icon">' + i.icon + "</span><span>" + esc(i.label) + "</span>" +
          '<span class="pi-hint">' + i.hint + "</span></div>";
      }).join("");

      list.querySelectorAll(".palette-item").forEach(function (n) {
        n.addEventListener("click", function () { items[+n.dataset.i].action(); });
      });
    }

    function highlight() {
      list.querySelectorAll(".palette-item").forEach(function (n, i) {
        n.classList.toggle("sel", i === sel);
        if (i === sel) n.scrollIntoView({ block: "nearest" });
      });
    }

    function open() {
      bg.classList.add("open");
      input.value = "";
      render("");
      setTimeout(function () { input.focus(); }, 40);
    }
    function close() { bg.classList.remove("open"); }

    $("palette-open").addEventListener("click", open);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    input.addEventListener("input", function () { render(this.value); });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % items.length; highlight(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; highlight(); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) items[sel].action(); }
      else if (e.key === "Escape") close();
    });

    global.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        bg.classList.contains("open") ? close() : open();
      }
      if (e.key === "Escape") close();
    });
  }

  /* -- Misc UI ------------------------------------------------------------ */

  function miscUI() {
    const toggle = $("nav-toggle");
    const links = $("nav-links");
    if (toggle) {
      toggle.addEventListener("click", function () { links.classList.toggle("open"); });
      links.addEventListener("click", function (e) {
        if (e.target.tagName === "A") links.classList.remove("open");
      });
    }

    const fab = $("fab");
    if (fab) {
      fab.addEventListener("click", function () {
        const s = document.querySelector("#assistant");
        if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(function () {
          const inp = $("chat-input");
          if (inp) inp.focus();
        }, 700);
      });
    }
  }

  /* -- Boot --------------------------------------------------------------- */

  function init() {
    if (!P) { console.error("PROFILE not loaded"); return; }
    renderIdentity();
    renderGlance();
    renderMetrics();
    renderMarquee();
    renderSkills();
    renderAlsoSkills();
    renderProjects();
    renderAbout();
    renderContact();

    // containers whose children animate in one after another
    ["skills-grid", "proj-grid", "metrics", "extras-row"].forEach(function (id) {
      const n = $(id);
      if (n) n.classList.add("reveal", "reveal-stagger");
    });
    document.querySelectorAll(".steps").forEach(function (n) {
      n.classList.add("reveal", "reveal-stagger");
    });

    scrollBehaviour();
    palette();
    miscUI();
    cardSpotlight();
    countUp();
    typeEffect();
    terminalBoot();
    strandField();
    warnMissingLinks();

    console.log("%c" + P.name + " — " + P.role, "font-size:15px;font-weight:600;color:#22d3ee");
    console.log(
      "%cThis site's demos are real. Try:\n  RAG.query('how did you prove retrieval worked')\n  ML.MLP  ·  AGENT.TOOLS  ·  AGENT.runTool('list_projects', {})",
      "color:#98a2ba;font-family:monospace;line-height:1.7"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
