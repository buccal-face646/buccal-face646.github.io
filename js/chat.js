/* ============================================================================
 * chat.js - the portfolio assistant ("Neura").
 *
 * Retrieval is always local and always real (see rag.js). Generation has two
 * modes:
 *   LOCAL - extractive synthesis over the retrieved chunks. It can only say
 *           what the corpus says, so it cannot hallucinate. When retrieval
 *           finds nothing above threshold it says so.
 *   LLM   - if a visitor supplies their own key, the same retrieved context
 *           is sent to a real model as a grounded prompt.
 *
 * Retrieval is identical in both modes. That is the point of the design.
 * ==========================================================================*/

(function (global) {
  "use strict";

  const els = {};
  let busy = false;

  // Held in memory only. Never localStorage, never sent anywhere but the
  // provider the visitor picked.
  const llm = { provider: null, key: null, model: null };

  /* -- Small helpers ------------------------------------------------------ */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function scrollLog() { els.log.scrollTop = els.log.scrollHeight; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  const BOT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 3 3 3 3 0 0 0 6 0 3 3 0 0 0 3-3v-1a3 3 0 0 0 0-6V9a3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z"/></svg>';

  /* -- Message rendering -------------------------------------------------- */

  function addMessage(role, html) {
    const msg = el("div", "msg " + role);
    msg.appendChild(el("div", "msg-av", role === "bot" ? BOT_ICON : "You"));
    msg.appendChild(el("div", "msg-body", html));
    els.log.appendChild(msg);
    scrollLog();
    return msg;
  }

  function showTyping() {
    const msg = el("div", "msg bot");
    msg.id = "typing-indicator";
    msg.innerHTML = '<div class="msg-av">' + BOT_ICON + "</div>" +
      '<div class="msg-body" style="padding:0"><div class="typing"><span></span><span></span><span></span></div></div>';
    els.log.appendChild(msg);
    scrollLog();
    return msg;
  }

  function removeTyping() {
    const t = document.getElementById("typing-indicator");
    if (t) t.remove();
  }

  /* -- Retrieval inspector ------------------------------------------------ */

  function renderInspector(r) {
    const box = els.inspector;
    if (!box) return;
    box.innerHTML = "";

    // stage 1
    const s1 = el("div", "stage");
    s1.appendChild(el("div", "stage-label", "1 · Your question, broken into keywords"));
    const terms = el("div", "pill-row");
    if (r.queryTerms.length) {
      r.queryTerms.forEach(function (t) { terms.appendChild(el("span", "pill", esc(t))); });
    } else {
      terms.appendChild(el("span", "pill", "no content terms"));
    }
    s1.appendChild(terms);
    box.appendChild(s1);

    // stage 2
    const s2 = el("div", "stage");
    s2.appendChild(el("div", "stage-label", "2 · Best " + r.stats.topK + " matches, scored"));
    const maxScore = Math.max.apply(null, r.retrieved.map(function (x) { return x.score; }).concat([0.0001]));
    r.retrieved.slice(0, 5).forEach(function (item) {
      const c = el("div", "chunk");
      c.innerHTML =
        '<div class="chunk-head"><span class="chunk-title">' + esc(item.doc.title) + "</span>" +
        '<span class="chunk-score">' + item.score.toFixed(3) + "</span></div>" +
        '<div class="chunk-src">' + esc(item.doc.source) +
        " · exact-word " + item.sparseScore.toFixed(2) +
        " · similar-meaning " + item.denseScore.toFixed(2) + "</div>" +
        '<div class="score-bar"><div class="score-fill" style="width:0"></div></div>';
      s2.appendChild(c);
      requestAnimationFrame(function () {
        const f = c.querySelector(".score-fill");
        if (f) f.style.width = Math.max(2, (item.score / maxScore) * 100) + "%";
      });
    });
    box.appendChild(s2);

    // stage 3
    const s3 = el("div", "stage");
    s3.appendChild(el("div", "stage-label", "3 · Re-checked closely, kept " + r.stats.keptN));
    const keptIds = new Set(r.context.map(function (c) { return c.doc.id; }));
    r.reranked.slice(0, 5).forEach(function (item, i) {
      const kept = keptIds.has(item.doc.id);
      const c = el("div", "chunk " + (kept ? (i === 0 ? "top" : "") : "dropped"));
      const sg = item.signals;
      c.innerHTML =
        '<div class="chunk-head">' +
          '<span class="chunk-title">' + (kept ? "[" + (i + 1) + "] " : "") + esc(item.doc.title) + "</span>" +
          '<span class="chunk-score">' + item.rerankScore.toFixed(3) + "</span>" +
        "</div>" +
        '<div class="chunk-src">covers ' + Math.round(sg.coverage * 100) + "% of your words" +
          " · phrase match " + sg.adjacency.toFixed(2) +
          (kept ? " · used" : " · dropped") + "</div>" +
        '<div class="chunk-text">' + esc(item.doc.text) + "</div>";
      s3.appendChild(c);
    });
    box.appendChild(s3);

    // stage 4
    const s4 = el("div", "stage");
    s4.appendChild(el("div", "stage-label", "4 · How fast it ran"));
    const row = el("div", "timing-row");
    row.innerHTML =
      '<span class="timing">retrieve ' + r.timing.retrieve.toFixed(2) + "ms</span>" +
      '<span class="timing">rerank ' + r.timing.rerank.toFixed(2) + "ms</span>" +
      '<span class="timing">searched ' + r.stats.corpusSize + " facts</span>" +
      '<span class="timing">' + r.stats.vocabSize + " word index</span>" +
      '<span class="timing">' + (llm.key ? esc(llm.provider) : "runs offline") + "</span>";
    s4.appendChild(row);
    box.appendChild(s4);
  }

  /* -- Local (extractive) answer synthesis -------------------------------- */

  function splitSentences(text) {
    // shared splitter - keeps "0.84" intact instead of breaking it in half
    return global.RAG.splitSentences(text, 26);
  }

  // A sentence opening with a backward-referring word ("The strongest of these
  // are...") is unreadable once lifted out of its paragraph, because the thing
  // it refers to got left behind. Extractive summarisation penalises these.
  const ANAPHORA = /^(the strongest|these|those|this|that|it|they|them|he|she|such|both|either|here)\b/i;

  function synthesiseLocal(question, ctx) {
    if (!ctx.length) return null;

    const qTerms = new Set(global.RAG.tokenize(question));
    const picked = [];
    const seen = new Set();

    ctx.forEach(function (c, ci) {
      const sentences = splitSentences(c.doc.text);
      const scored = sentences.map(function (s, si) {
        const st = new Set(global.RAG.tokenize(s));
        let overlap = 0;
        qTerms.forEach(function (t) { if (st.has(t)) overlap++; });
        // normalise by length so a long rambling sentence doesn't win just by
        // containing more words
        let score = overlap / Math.sqrt(st.size || 1);
        if (ANAPHORA.test(s.trim())) score *= 0.35;
        if (si === 0) score *= 1.15;   // opening sentence carries the topic
        return { s: s, score: score };
      }).sort(function (a, b) { return b.score - a.score; });

      const take = ci === 0 ? 2 : 1;
      scored.slice(0, take).forEach(function (x) {
        const key = x.s.slice(0, 45).toLowerCase();
        if (x.score > 0 && !seen.has(key)) {
          seen.add(key);
          picked.push({ text: x.s, cite: ci + 1, score: x.score });
        }
      });

      if (ci === 0 && picked.length === 0 && sentences.length) {
        picked.push({ text: sentences[0], cite: 1, score: 0 });
      }
    });

    if (!picked.length) return null;

    const body = picked.slice(0, 5).map(function (p) {
      return esc(p.text) + ' <span class="cite" data-cite="' + p.cite + '">' + p.cite + "</span>";
    }).join(" ");

    const sources = ctx.map(function (c, i) {
      return "[" + (i + 1) + "] " + c.doc.source + " — " + c.doc.title;
    }).join("<br>");

    return "<p>" + body + "</p>" +
           '<p style="font-size:12px;color:var(--dim);font-family:var(--mono);margin-top:12px;line-height:1.6">' +
           esc("Grounded in " + ctx.length + " retrieved chunk" + (ctx.length === 1 ? "" : "s") + ":") +
           "<br>" + sources + "</p>";
  }

  /* -- LLM generation (optional) ------------------------------------------ */

  async function generateWithLLM(question, ctx, history) {
    const contextBlock = ctx.map(function (c, i) {
      return "[" + (i + 1) + "] (" + c.doc.source + " — " + c.doc.title + ")\n" + c.doc.text;
    }).join("\n\n");

    const system =
      "You are Neura, the portfolio assistant for " + global.PROFILE.name + ", an " +
      global.PROFILE.role + ". Answer using ONLY the numbered context below. " +
      "Cite sources inline using [1], [2] markers matching the context numbers. " +
      "If the context does not contain the answer, say so plainly instead of guessing. " +
      "Write in first person as " + global.PROFILE.name + ". Be concise and concrete - " +
      "two short paragraphs at most.\n\nCONTEXT:\n" + contextBlock;

    const messages = [{ role: "system", content: system }]
      .concat(history.slice(-4))
      .concat([{ role: "user", content: question }]);

    const endpoint = llm.provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + llm.key },
      body: JSON.stringify({ model: llm.model, messages: messages, temperature: 0.3, max_tokens: 600 })
    });

    if (!res.ok) {
      const txt = await res.text().catch(function () { return ""; });
      throw new Error("HTTP " + res.status + (txt ? ": " + txt.slice(0, 160) : ""));
    }

    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    if (!content) throw new Error("Empty response from provider.");
    return content;
  }

  function formatLLMText(text) {
    return esc(text)
      .replace(/\[(\d+)\]/g, '<span class="cite" data-cite="$1">$1</span>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .split(/\n{2,}/)
      .map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; })
      .join("");
  }

  /* -- Conversation ------------------------------------------------------- */

  const history = [];

  function smallTalk(q) {
    const s = q.toLowerCase().trim();
    if (/^(hi|hey|hello|yo|sup|hola|namaste)\b/.test(s)) {
      return "<p>Hey. I'm Neura — I run a real retrieval pipeline over " +
             esc(global.PROFILE.name.split(" ")[0]) + "'s work, so ask me something specific " +
             "and watch the panel on the right show you exactly which facts I pulled and why.</p>" +
             "<p>Good openers: <em>how did you prove retrieval worked</em>, <em>what's Sahakar Sahayak</em>, " +
             "or <em>what are you still learning</em>.</p>";
    }
    if (/^(thanks|thank you|ty|cheers|nice|cool|awesome)\b/.test(s)) {
      return "<p>Anytime. If you want to go deeper, the Playground below lets you train the neural network yourself and watch the agent call real tools.</p>";
    }
    // Questions about Neura herself. They're all stopwords ("what can you
    // do", "who are you"), so retrieval has nothing to search on.
    if (/\b(what can you do|what do you do|who are you|what are you|how can you help|your (skills|features|abilities))\b/.test(s) || s === "help") {
      return "<p>Besides answering questions about " + esc(global.PROFILE.name.split(" ")[0]) +
             ", I have three skills: <strong>Match a job</strong> scores him against any job description, " +
             "with honest gaps; <strong>Pitch me</strong> gives you the version of him that matters to you; " +
             "and <strong>Tour</strong> walks you through this page.</p>" +
             '<div class="pitch-actions">' +
               '<button type="button" class="btn btn-sm btn-primary" data-skill="match">Match a job</button>' +
               '<button type="button" class="btn btn-sm" data-skill="pitch">Pitch me</button>' +
               '<button type="button" class="btn btn-sm" data-skill="tour">Take the tour</button>' +
             "</div>";
    }
    // "How can I contact you?" leaves one search term ("contact") that no
    // sentence contains, so retrieval answered with an opening line and no
    // email address. It's the most important question a recruiter asks.
    if (/\b(contact|reach (you|him|out)|get in touch|e-?mail|hire (you|him)|talk to (you|him))\b/.test(s)) {
      const P = global.PROFILE;
      const li = global.SITE && global.SITE.safeLink(P.links.linkedin);
      const gh = global.SITE && global.SITE.safeLink(P.links.github);
      return "<p>The fastest way to reach " + esc(P.name.split(" ")[0]) + " is email: <strong>" + esc(P.email) +
             "</strong>. " + esc(P.availableText) + ".</p>" +
             '<div class="pitch-actions">' +
               '<a class="btn btn-sm btn-primary" href="mailto:' + esc(P.email) + '">Email him</a>' +
               (li ? '<a class="btn btn-sm" href="' + esc(li) + '" target="_blank" rel="noopener">LinkedIn</a>' : "") +
               (gh ? '<a class="btn btn-sm" href="' + esc(gh) + '" target="_blank" rel="noopener">GitHub</a>' : "") +
             "</div>";
    }
    if (/^(bye|goodbye|see ya|later)\b/.test(s)) {
      return "<p>Take care. The contact section at the bottom has the fastest way to reach " +
             esc(global.PROFILE.name.split(" ")[0]) + " directly.</p>";
    }
    return null;
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    // a pasted job posting is a job for the matcher, not one long question
    if (global.NEURA && global.NEURA.looksLikeJD(question)) {
      els.input.value = "";
      global.NEURA.openMatcher(question);
      return;
    }
    busy = true;
    els.send.disabled = true;
    try {
      await answer(question);
    } catch (e) {
      // An error after `busy = true` used to leave the chat locked for the
      // rest of the visit, silently ignoring every later question.
      removeTyping();
      addMessage("bot", "<p>Something went wrong on my side answering that — try asking another way?</p>");
      console.error(e);
    } finally {
      busy = false;
      els.send.disabled = false;
    }
  }

  async function answer(question) {
    els.input.value = "";

    addMessage("user", "<p>" + esc(question) + "</p>");
    history.push({ role: "user", content: question });

    const small = smallTalk(question);
    if (small) {
      showTyping();
      await sleep(360);
      removeTyping();
      addMessage("bot", small);
      history.push({ role: "assistant", content: "(greeting)" });
      return;
    }

    const r = global.RAG.query(question, { topK: 8, finalN: 4 });
    renderInspector(r);
    showTyping();

    let html;
    try {
      if (!r.context.length) {
        html = "<p>Nothing in my knowledge base scored above the relevance threshold for that, so I'd rather say <strong>I don't know</strong> than invent something. That refusal path is deliberate — it's the same guardrail Ritesh builds into production RAG.</p>" +
               "<p>Try asking about his projects, how he evaluates retrieval, what he's currently learning, or how to get in touch.</p>";
        await sleep(420);
      } else if (llm.key) {
        html = formatLLMText(await generateWithLLM(question, r.context, history));
      } else {
        await sleep(430 + Math.random() * 260);
        html = synthesiseLocal(question, r.context) ||
               "<p>I retrieved some passages but none of them actually answer that. Try rephrasing?</p>";
      }
    } catch (e) {
      html = (synthesiseLocal(question, r.context) || "<p>Something went wrong.</p>") +
             '<p style="font-size:12px;color:var(--amber);margin-top:10px">LLM call failed (' + esc(e.message) +
             ") — answered from local retrieval instead.</p>";
    }

    removeTyping();
    addMessage("bot", html);
    history.push({ role: "assistant", content: question });
    els.input.focus();
  }

  /* -- Suggestions -------------------------------------------------------- */

  const SUGGESTIONS = [
    "What can you do?",
    "How did you prove retrieval worked?",
    "What is Sahakar Sahayak?",
    "Tell me about the guardrail bug",
    "Why hybrid retrieval?",
    "What are you still learning?",
    "How can I contact you?"
  ];

  /* -- Hero chat (the anime character on the landing page) ---------------- */

  // Kept to three: the skill buttons above them are the main actions now.
  const HERO_CHIPS = [
    "Who is Ritesh?",
    "Show me real numbers",
    "What can you do?"
  ];

  function condense(html, maxChars) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const ps = tmp.querySelectorAll("p");
    const text = ps.length ? ps[0].innerHTML : tmp.innerHTML;

    const plain = document.createElement("div");
    plain.innerHTML = text;
    if (plain.textContent.length <= maxChars) return text;

    const sentences = global.RAG.splitSentences(plain.textContent);
    let out = "";
    for (const s of sentences) {
      if ((out + s).length > maxChars && out) break;
      out += s + " ";
    }
    return esc(out.trim() || plain.textContent.slice(0, maxChars) + "…");
  }

  let heroBusy = false;

  async function heroAsk(question) {
    if (heroBusy || !question.trim()) return;
    if (global.NEURA && global.NEURA.looksLikeJD(question)) {
      document.getElementById("hero-input").value = "";
      global.NEURA.openMatcher(question);
      return;
    }
    heroBusy = true;
    try {
      await heroAnswer(question);
    } catch (e) {
      // same rule as ask(): an error must not leave Neura frozen mid-thought
      global.AVATAR && global.AVATAR.setState("idle");
      document.getElementById("hero-bubble-text").textContent = "Something went wrong on my side — try asking another way?";
      document.getElementById("hero-bubble-meta").textContent = "";
      console.error(e);
    } finally {
      heroBusy = false;
    }
  }

  async function heroAnswer(question) {
    const bubble = document.getElementById("hero-bubble-text");
    const meta = document.getElementById("hero-bubble-meta");
    const input = document.getElementById("hero-input");
    if (input) input.value = "";

    global.AVATAR && global.AVATAR.setState("thinking");
    bubble.innerHTML = '<span class="bubble-typing"><span></span><span></span><span></span></span>';
    meta.textContent = "retrieving…";

    await sleep(560);

    const small = smallTalk(question);
    let html, ctxCount = 0, timing = 0;

    if (small) {
      html = small;
    } else {
      const r = global.RAG.query(question, { topK: 8, finalN: 4 });
      ctxCount = r.context.length;
      timing = r.timing.total;

      // keep the full assistant's inspector in sync, so scrolling down shows
      // the pipeline for whatever was just asked up here
      renderInspector(r);

      if (!r.context.length) {
        html = "Nothing in my knowledge base scored above the relevance threshold, so I'd rather say <b>I don't know</b> than make something up. Try asking about his projects, results, or how to reach him.";
      } else if (llm.key) {
        try { html = formatLLMText(await generateWithLLM(question, r.context, history)); }
        catch (e) { html = synthesiseLocal(question, r.context) || "Something went wrong."; }
      } else {
        html = synthesiseLocal(question, r.context) || "I found passages but none of them answer that.";
      }
    }

    global.AVATAR && global.AVATAR.setState("talking");
    bubble.innerHTML = condense(html, 340);
    meta.textContent = ctxCount
      ? ctxCount + " facts retrieved · " + timing.toFixed(1) + "ms · scroll down for the full pipeline"
      : "";

    const talkMs = Math.min(2600, 700 + bubble.textContent.length * 11);
    await sleep(talkMs);
    global.AVATAR && (ctxCount || small ? global.AVATAR.celebrate(1500) : global.AVATAR.setState("idle"));
  }

  function initHero() {
    const mount = document.getElementById("avatar-mount");
    if (!mount || !global.AVATAR) return;

    global.AVATAR.mount(mount);

    const chips = document.getElementById("hero-chips");
    HERO_CHIPS.forEach(function (c) {
      const b = el("button", "chip", esc(c));
      b.type = "button";
      b.addEventListener("click", function () { heroAsk(c); });
      chips.appendChild(b);
    });

    const form = document.getElementById("hero-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      heroAsk(document.getElementById("hero-input").value);
    });

    mount.addEventListener("click", function () {
      if (heroBusy) return;
      global.AVATAR.celebrate(1200);
      document.getElementById("hero-input").focus();
    });
  }

  /* -- Init --------------------------------------------------------------- */

  function init() {
    els.log = document.getElementById("chat-log");
    els.input = document.getElementById("chat-input");
    els.send = document.getElementById("chat-send");
    els.form = document.getElementById("chat-form");
    els.inspector = document.getElementById("inspector");
    els.suggest = document.getElementById("chat-suggest");
    if (!els.log) return;

    // same character in the section header, so the assistant has one identity
    const headAvatar = document.querySelector(".chat-avatar");
    if (headAvatar && global.AVATAR) {
      headAvatar.classList.add("as-char");
      global.AVATAR.mount(headAvatar, { compact: true });
    }
    const headTitle = document.querySelector(".chat-title");
    if (headTitle) headTitle.textContent = "Neura — " + global.PROFILE.name.split(" ")[0] + "'s assistant";

    global.RAG.init();
    const size = global.RAG.index.docs.length;
    const cs = document.getElementById("corpus-size");
    if (cs) cs.textContent = size + " facts indexed";

    addMessage("bot",
      "<p>Hi, I'm <strong>Neura</strong> — " + esc(global.PROFILE.name.split(" ")[0]) +
        " built me to answer questions about his work.</p>" +
      "<p>I've read <strong>" + size + " facts</strong> about him. Ask me anything, and the panel on " +
        "the right will show you which ones I used and how well each one matched.</p>"
    );

    SUGGESTIONS.forEach(function (s) {
      const c = el("button", "chip", esc(s));
      c.type = "button";
      c.addEventListener("click", function () { ask(s); });
      els.suggest.appendChild(c);
    });

    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      ask(els.input.value);
    });

    // clicking a citation highlights that chunk in the inspector
    els.log.addEventListener("click", function (e) {
      const cite = e.target.closest(".cite");
      if (!cite) return;
      const n = parseInt(cite.dataset.cite, 10);
      const target = els.inspector.querySelectorAll(".stage")[2];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        const c = target.querySelectorAll(".chunk")[n - 1];
        if (c) {
          c.style.transition = "box-shadow .3s";
          c.style.boxShadow = "0 0 0 2px var(--cyan)";
          setTimeout(function () { c.style.boxShadow = ""; }, 1300);
        }
      }
    });

    initSettings();
    initHero();
  }

  /* -- LLM settings modal -------------------------------------------------- */

  function initSettings() {
    const modal = document.getElementById("settings-modal");
    const open = document.getElementById("settings-open");
    const close = document.getElementById("settings-close");
    const save = document.getElementById("llm-save");
    const clear = document.getElementById("llm-clear");
    const provider = document.getElementById("llm-provider");
    const model = document.getElementById("llm-model");
    const key = document.getElementById("llm-key");
    const mode = document.getElementById("brain-mode");
    if (!modal) return;

    const DEFAULT_MODELS = { groq: "llama-3.3-70b-versatile", openai: "gpt-4o-mini" };
    model.value = DEFAULT_MODELS.groq;
    provider.addEventListener("change", function () {
      model.value = DEFAULT_MODELS[provider.value] || "";
    });

    function show(v) { modal.classList.toggle("open", v); }
    open.addEventListener("click", function () { show(true); key.focus(); });
    close.addEventListener("click", function () { show(false); });
    modal.addEventListener("click", function (e) { if (e.target === modal) show(false); });

    save.addEventListener("click", function () {
      if (!key.value.trim()) { global.toast && global.toast("Enter a key, or choose local mode."); return; }
      llm.provider = provider.value;
      llm.key = key.value.trim();
      llm.model = model.value.trim() || DEFAULT_MODELS[provider.value];
      mode.textContent = llm.provider + " · " + llm.model;
      key.value = "";
      show(false);
      global.toast && global.toast("Connected. Retrieval is unchanged — only generation swapped.");
    });

    clear.addEventListener("click", function () {
      llm.provider = llm.key = llm.model = null;
      mode.textContent = "local RAG · no API key";
      key.value = "";
      show(false);
      global.toast && global.toast("Back to local extractive mode.");
    });
  }

  global.CHAT = { init: init, ask: ask, heroAsk: heroAsk };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
