/* ============================================================================
 * neura-skills.js - things Neura can DO, beyond answering questions.
 *
 *   MATCH   A recruiter pastes a job description. Neura extracts the skills
 *           it asks for, checks each one against work Ritesh has actually
 *           shipped, scores the fit, and names the gaps plainly.
 *   PITCH   A 30-second pitch, rewritten for whoever is visiting.
 *   TOUR    Neura walks a visitor through the page, section by section.
 *
 * Everything runs in the browser. A pasted job description never leaves the
 * page - which matters, because recruiters often paste confidential ones.
 * ==========================================================================*/

(function (global) {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function link(u) { return global.SITE ? global.SITE.safeLink(u) : u; }
  function avatar(state) { if (global.AVATAR) global.AVATAR.setState(state); }

  const reduceMotion = global.matchMedia &&
    global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ======================================================================
   * 1. JOB-DESCRIPTION MATCHER
   * ==================================================================== */

  /* The vocabulary of skills a job description asks for.
   *
   *   [id, label, aliases (regex source), related ids, evidence aliases]
   *
   * "related" is what keeps the matcher honest. A JD asking for Pinecone is
   * not satisfied by Qdrant - but Qdrant experience is genuinely transferable,
   * and saying so is more useful to a recruiter than either "match" or "gap".
   */
  const RAW_TAXONOMY = [
    ["python",     "Python",                        ["python"]],
    ["pytorch",    "PyTorch",                       ["pytorch", "torch"]],
    ["tensorflow", "TensorFlow / Keras",            ["tensorflow", "keras"], ["pytorch"]],
    ["sklearn",    "scikit-learn",                  ["scikit[- ]learn", "sklearn"]],
    ["boosting",   "Gradient boosting",             ["xgboost", "lightgbm", "catboost", "gradient boosting"]],
    // Umbrella skills. A JD says "machine learning"; a portfolio shows it as
    // rerankers and embeddings. The fifth column is what counts as evidence.
    ["ml",         "Machine learning",              ["machine learning", "ml models?"], [],
                   ["rag", "retrieval", "re-?rank(?:er|ing)?", "embeddings?", "llms?", "neural networks?", "pytorch", "scikit[- ]learn", "xgboost"]],
    ["dl",         "Deep learning",                 ["deep learning", "neural networks?"], [],
                   ["pytorch", "transformers", "embeddings?", "cross[- ]encoders?", "bge-m3", "cnns?"]],
    ["llm",        "LLMs / Generative AI",          ["llms?", "large language models?", "gen ?ai", "generative ai"]],
    ["rag",        "RAG / retrieval",               ["rag", "retrieval[- ]augmented", "semantic search", "information retrieval", "llama ?index"]],
    ["langchain",  "LangChain",                     ["langchain"]],
    ["langgraph",  "LangGraph",                     ["langgraph"]],
    ["agents",     "AI agents / multi-agent",       ["ai agents?", "agentic", "multi[- ]agent", "autonomous agents?", "agent frameworks?", "tool[- ]calling", "function calling"]],
    ["vectordb",   "Vector databases",              ["vector (?:databases?|dbs?|stores?|search)", "qdrant", "pgvector", "chroma(?:db)?", "faiss"]],
    ["pinecone",   "Pinecone",                      ["pinecone"], ["vectordb"]],
    ["weaviate",   "Weaviate / Milvus",             ["weaviate", "milvus"], ["vectordb"]],
    ["embeddings", "Embeddings & reranking",        ["embeddings?", "sentence[- ]transformers", "re-?rank(?:ing|ers?)?", "cross[- ]encoders?", "hybrid search", "bm25"]],
    ["finetune",   "Fine-tuning (LoRA / PEFT)",     ["fine[- ]?tun(?:e|ed|ing)", "q?lora", "peft"]],
    ["nlp",        "NLP / Transformers",            ["nlp", "natural language processing", "transformers", "hugging ?face"], [],
                   ["multilingual", "tokeni[sz]er", "bge-m3", "devanagari"]],
    ["cv",         "Computer vision",               ["computer vision", "cnns?", "image classification", "object detection", "opencv"]],
    ["multimodal", "Multimodal / VLMs",             ["multi-?modal", "vision[- ]language", "vlms?"], ["cv", "llm"]],
    ["speech",     "Speech / audio",                ["speech recognition", "asr", "text[- ]to[- ]speech", "tts", "whisper"]],
    ["recsys",     "Recommender systems",           ["recommend(?:ation|er) systems?", "recsys"]],
    ["eval",       "LLM evaluation",                ["evals?", "evaluation (?:frameworks?|pipelines?|harness(?:es)?|metrics|sets?)", "ragas", "llm[- ]as[- ](?:an?[- ])?judge", "deepeval", "benchmark(?:ing|s)"]],
    ["guardrails", "Guardrails & AI safety",        ["guardrails?", "red[- ]team(?:ing)?", "prompt injection", "ai safety", "responsible ai", "jailbreaks?"]],
    ["prompt",     "Prompt engineering",            ["prompt engineering", "prompting", "prompt design"]],
    ["llmapi",     "LLM APIs",                      ["openai", "gpt-?4\\w*", "gpt-?3\\.5", "claude", "anthropic", "groq", "llama", "mistral", "ollama"]],
    ["gemini",     "Gemini / Vertex AI",            ["gemini", "vertex ai"], ["llmapi", "gcp"]],
    ["api",        "FastAPI / REST APIs",           ["fastapi", "rest(?:ful)? apis?", "microservices", "api development"]],
    ["django",     "Django / Flask",                ["django", "flask"], ["api"]],
    ["docker",     "Docker / containers",           ["docker", "containeri[sz](?:ed|ation)", "docker[- ]compose"]],
    ["kubernetes", "Kubernetes",                    ["kubernetes", "k8s", "helm"], ["docker"]],
    ["cicd",       "CI/CD",                         ["ci ?/ ?cd", "github actions", "continuous (?:integration|delivery|deployment)", "jenkins"]],
    ["aws",        "AWS",                           ["aws", "amazon web services", "bedrock", "sagemaker"]],
    ["gcp",        "Google Cloud",                  ["gcp", "google cloud", "cloud run", "bigquery"]],
    ["azure",      "Azure",                         ["azure"], ["aws", "gcp"]],
    ["terraform",  "Terraform / IaC",               ["terraform", "infrastructure as code", "iac"]],
    ["mlops",      "MLOps",                         ["mlops", "mlflow", "model registry", "model (?:deployment|serving|monitoring)", "weights (?:&|and) biases", "wandb"]],
    ["sql",        "SQL / Postgres",                ["sql", "postgres(?:ql)?", "mysql", "relational databases?"]],
    ["redis",      "Redis / caching",               ["redis", "caching", "semantic cach(?:e|ing)"]],
    ["nosql",      "NoSQL",                         ["mongodb", "nosql", "dynamodb", "cassandra"], ["sql", "redis"]],
    ["frontend",   "React / Next.js / TypeScript",  ["react", "next\\.?js", "typescript", "frontend", "front-end"]],
    ["data",       "Data analysis (Pandas / NumPy)", ["pandas", "numpy", "data analysis", "eda", "etl", "data pipelines?"]],
    ["spark",      "Spark / big data",              ["spark", "pyspark", "hadoop", "big data", "databricks"], ["data"]],
    ["stats",      "Statistics / A-B testing",      ["statistics", "statistical", "a/?b test(?:ing|s)?", "hypothesis testing"]],
    ["security",   "Security / auth",               ["oauth", "oidc", "keycloak", "rbac", "opa", "zero[- ]trust", "mtls", "secret scanning"]],
    ["testing",    "Testing (pytest)",              ["pytest", "unit tests?", "test suites?", "test(?:ing)? frameworks?"]],
    ["git",        "Git",                           ["git", "github", "version control"]],
    ["linux",      "Linux / shell",                 ["linux", "bash", "shell scripting"]],
    ["automation", "Workflow automation",           ["n8n", "workflow automation", "zapier", "process automation"]],
    ["sysdesign",  "System design / distributed systems", ["system design", "distributed systems", "high[- ]scale", "large[- ]scale (?:systems|serving)"]],
    ["bi",         "BI dashboards",                 ["power ?bi", "tableau", "looker", "dashboards?"]],
    ["java",       "Java",                          ["java"]],
    ["golang",     "Go",                            ["golang"]],
    ["cpp",        "C++",                           ["c\\+\\+"]],
    ["rust",       "Rust",                          ["rust"]]
  ];

  // Word boundaries by hand: \b breaks on "c++", "ci/cd" and "next.js", and
  // lookbehind would be a syntax error on older Safari - which would take the
  // whole file down with it.
  function boundaryRe(aliases, flags) {
    return new RegExp("(^|[^a-z0-9])(" + aliases.join("|") + ")(?![a-z0-9])", flags || "i");
  }

  const TAXONOMY = RAW_TAXONOMY.map(function (r) {
    const evidence = r[2].concat(r[4] || []);
    return {
      id: r[0], label: r[1], related: r[3] || [],
      re: boundaryRe(r[2]),               // finds the skill in a job description
      ev: boundaryRe(evidence),           // finds evidence of it in his work
      evG: boundaryRe(evidence, "gi")
    };
  });
  const BY_ID = {};
  TAXONOMY.forEach(function (t) { BY_ID[t.id] = t; });

  /* -- Reading the job description --------------------------------------- */

  const OPTIONAL_HEADING = /(nice[- ]to[- ]have|preferred|bonus|good[- ]to[- ]have|desirable|pluses|added advantage)/i;
  const REQUIRED_HEADING = /(requirements?|must[- ]have|qualifications|what you('ll| will)? need|you have|you bring|responsibilit|what you('ll| will) do|skills|looking for|about you|tech stack)/i;
  const OPTIONAL_INLINE  = /(is a plus|\ba plus\b|nice to have|good to have|\bbonus\b)/i;
  const OPTIONAL_PAREN   = /(preferred|a plus|bonus|nice to have|optional)/i;

  function parseJD(text) {
    const found = new Map();
    let mode = "required";

    function note(segment, optional) {
      TAXONOMY.forEach(function (t) {
        if (!t.re.test(segment)) return;
        const prev = found.get(t.id);
        if (!prev) found.set(t.id, { entry: t, optional: optional });
        else if (prev.optional && !optional) prev.optional = false;   // required anywhere wins
      });
    }

    String(text).split(/\r?\n/).forEach(function (line) {
      const trimmed = line.trim();
      if (!trimmed) return;

      // A heading switches the mode for the lines below it. It must be short,
      // must NOT be a bullet, and is judged without its brackets. Otherwise a
      // requirement like "- Vector databases (Pinecone preferred)" reads as a
      // "Preferred" heading and quietly demotes every requirement after it.
      const isBullet = /^([-*•·▪◦]|\d+[.)])\s+/.test(trimmed);
      if (!isBullet && trimmed.length < 60) {
        const bare = trimmed.replace(/\([^)]*\)/g, "");
        if (OPTIONAL_HEADING.test(bare)) mode = "optional";
        else if (REQUIRED_HEADING.test(bare)) mode = "required";
      }

      // "(Pinecone preferred)" makes Pinecone optional - not the vector-DB
      // requirement sitting on the same line outside the brackets.
      const optionalParens = [];
      const main = line.replace(/\(([^)]*)\)/g, function (whole, inner) {
        if (OPTIONAL_PAREN.test(inner)) { optionalParens.push(inner); return " "; }
        return whole;
      });

      note(main, mode === "optional" || OPTIONAL_INLINE.test(main));
      optionalParens.forEach(function (p) { note(p, true); });
    });

    const years = String(text).match(/(\d{1,2})\s*\+?\s*(?:-|to|–)?\s*\d{0,2}\s*\+?\s*(?:years?|yrs?)/i);
    return {
      skills: Array.from(found.values()),
      years: years ? parseInt(years[1], 10) : null,
      senior: /\b(senior|staff|principal|lead|sr\.?)\b/i.test(text),
      entry: /\b(intern(ship)?|new[- ]grad(uate)?|entry[- ]level|junior|fresher|early[- ]career|graduate program)\b/i.test(text),
      remote: /\bremote\b/i.test(text),
      pune: /\bpune\b/i.test(text),
      city: (String(text).match(/\b(bengaluru|bangalore|hyderabad|mumbai|chennai|delhi|gurugram|gurgaon|noida|kolkata|ahmedabad)\b/i) || [])[1]
    };
  }

  /* -- Evidence from Ritesh's own record ---------------------------------- */

  // Only shipped work and his skill list count as evidence. The free-text notes
  // are deliberately excluded: "What I'm still learning" mentions statistics,
  // and a matcher that read that as proof of statistics would be lying.
  function corpus() {
    const P = global.PROFILE;
    return {
      projects: P.projects.map(function (p) {
        return {
          name: p.name,
          href: link(p.links && p.links.demo) || link(p.links && p.links.github) || "#projects",
          stack: p.stack.join(" · "),
          sentences: p.highlights.concat(global.RAG.splitSentences(p.blurb)),
          text: [p.name, p.subtitle || "", p.blurb].concat(p.highlights, p.stack).join(" . ")
        };
      }),
      skills: [].concat.apply([], P.skills.map(function (g) {
        return g.items.map(function (it) { return { name: it.name, level: it.level, category: g.category }; });
      })).concat((P.skillsAlso || []).map(function (n) { return { name: n, level: null, category: "" }; })),
      experience: [].concat.apply([], P.experience.map(function (e) {
        return e.points.map(function (pt) { return { name: e.role, text: pt }; });
      }))
    };
  }

  function trim(s, n) {
    s = String(s).trim();
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    return cut.slice(0, cut.lastIndexOf(" ")) + "…";
  }

  // What in his record matched, e.g. "Qdrant" for a vector-database requirement
  function matchedText(entry, text) {
    entry.evG.lastIndex = 0;
    const m = entry.evG.exec(text);
    return m ? m[2] : null;
  }

  const CORE_LEVEL = 88;   // a skill rated this high counts as core, even without a project

  function evidenceFor(entry, C) {
    const re = entry.ev;
    const projects = C.projects.filter(function (p) { return re.test(p.text); });
    const exp = C.experience.filter(function (x) { return re.test(x.text); });
    const skills = C.skills.filter(function (s) { return re.test(s.name) || (s.category && re.test(s.category)); });
    const rated = skills.filter(function (s) { return s.level != null; });
    const level = rated.reduce(function (m, s) { return Math.max(m, s.level); }, 0);

    if (projects.length || exp.length) {
      let quote = null, source = null;
      // prefer a sentence that mentions the skill AND carries a number
      for (const p of projects) {
        const hits = p.sentences.filter(function (x) { return re.test(x); });
        const best = hits.filter(function (x) { return /\d/.test(x); })[0] || hits[0];
        if (best) { quote = best; source = p; break; }
      }
      if (!quote && exp.length) { quote = exp[0].text; source = { name: exp[0].name, href: "#about" }; }
      if (!quote) {
        // only in the stack line - say where it's used rather than invent a quote
        source = projects[0];
        quote = "Part of the stack in " + projects.map(function (p) { return p.name; }).join(", ") + ".";
      }
      return {
        status: "shipped",
        quote: trim(quote, 170),
        source: source,
        via: matchedText(entry, (source && source.text) || quote),
        count: projects.length
      };
    }
    if (level >= CORE_LEVEL) {
      return { status: "core", quote: "A core skill, rated " + level + "/100 on his skill list.", level: level };
    }
    if (skills.length) {
      const s0 = rated[0] || skills[0];
      return {
        status: "listed", level: level,
        quote: s0.level != null
          ? "On his skill list (" + s0.name + ", " + s0.level + "/100), but not yet in a shipped project."
          : "On his résumé (" + s0.name + "), but not yet in a shipped project."
      };
    }
    return null;
  }

  const CREDIT = { shipped: 1, core: 0.9, listed: 0.6, transfer: 0.4, gap: 0 };
  const STATUS_LABEL = { shipped: "Shipped", core: "Core skill", listed: "Listed", transfer: "Transferable", gap: "Gap" };
  const STATUS_ORDER = { shipped: 0, core: 1, listed: 2, transfer: 3, gap: 4 };

  function analyse(text) {
    const jd = parseJD(text);
    const C = corpus();

    const rows = jd.skills.map(function (s) {
      const ev = evidenceFor(s.entry, C);
      if (ev) return Object.assign({ entry: s.entry, optional: s.optional }, ev);

      // no direct evidence: is there something genuinely transferable?
      for (const rid of s.entry.related) {
        const rel = BY_ID[rid] && evidenceFor(BY_ID[rid], C);
        if (rel && (rel.status === "shipped" || rel.status === "core")) {
          return {
            entry: s.entry, optional: s.optional, status: "transfer",
            quote: "Not in his work yet, but he's shipped " + BY_ID[rid].label +
                   (rel.source ? " (" + rel.source.name + ")" : "") + ", which transfers directly.",
            source: rel.source || null
          };
        }
      }
      return { entry: s.entry, optional: s.optional, status: "gap",
               quote: "Not in his work or skill list yet." };
    });

    rows.sort(function (a, b) {
      return (a.optional - b.optional) || (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    });

    let got = 0, max = 0;
    rows.forEach(function (r) {
      const w = r.optional ? 1 : 2;   // required counts double
      max += w;
      got += w * CREDIT[r.status];
    });

    return { jd: jd, rows: rows, score: max ? Math.round(100 * got / max) : 0 };
  }

  /* -- Rendering the result ----------------------------------------------- */

  function verdict(score) {
    if (score >= 80) return ["Strong match.", "This role lines up with work he has actually shipped."];
    if (score >= 60) return ["Good match, with gaps worth a conversation.", "Most of the core is there; the gaps are listed honestly below."];
    if (score >= 40) return ["Partial match.", "Some real overlap, but this role leans on things he hasn't done yet."];
    return ["Honestly? Probably not the right fit.", "I'd rather tell you that than oversell him."];
  }

  function notes(jd) {
    const P = global.PROFILE, out = [];
    if (jd.entry) out.push(["good", "The role is pitched at his level — he graduates in 2027 and is available for internships now."]);
    if (jd.senior) out.push(["warn", "This reads as a senior role. Ritesh is early-career: his experience is shipped projects, open source and freelance work rather than years in a full-time seat."]);
    if (jd.years != null && jd.years >= 2) {
      out.push(["warn", "Asks for " + jd.years + "+ years. Worth a conversation — he's a 2027 graduate whose track record is live projects rather than tenure."]);
    }
    if (jd.pune) out.push(["good", "Based in Pune — he's local."]);
    else if (jd.remote) out.push(["good", "Remote works: he's " + P.quickFacts.relocation.toLowerCase() + "."]);
    else if (jd.city) out.push(["info", "Role is in " + jd.city.charAt(0).toUpperCase() + jd.city.slice(1).toLowerCase() + ". He's based in Pune and " + P.quickFacts.relocation.toLowerCase() + "."]);
    return out;
  }

  function rowHtml(r) {
    const src = r.source
      ? '<a class="req-src" href="' + esc(r.source.href) + '"' + (r.source.href.charAt(0) === "#" ? "" : ' target="_blank" rel="noopener"') + ">" +
        esc(r.source.name) + (r.via && r.status === "shipped" ? " · via " + esc(r.via) : "") + " &#8599;</a>"
      : "";
    return '<div class="req req-' + r.status + '">' +
      '<span class="req-badge">' + STATUS_LABEL[r.status] + "</span>" +
      '<div class="req-body">' +
        '<div class="req-title">' + esc(r.entry.label) +
          (r.optional ? ' <i>nice to have</i>' : "") + "</div>" +
        '<div class="req-quote">' + esc(r.quote) + "</div>" + src +
      "</div></div>";
  }

  function renderResult(res) {
    const box = $("matcher-results");
    const P = global.PROFILE;

    if (res.rows.length < 3) {
      box.innerHTML =
        '<div class="match-empty"><b>I only recognised ' + res.rows.length + " skill" + (res.rows.length === 1 ? "" : "s") +
        " in that.</b> It may not be an AI/ML job description, or it's very short. Paste the full posting — " +
        "requirements section included — and I'll go through it line by line.</div>" +
        '<div class="btn-row"><button class="btn" data-m="again">Try another</button></div>';
      return;
    }

    const counts = { shipped: 0, core: 0, listed: 0, transfer: 0, gap: 0 };
    res.rows.forEach(function (r) { counts[r.status]++; });
    const v = verdict(res.score);
    const C = 2 * Math.PI * 44;

    const matched = res.rows.filter(function (r) { return r.status !== "gap"; });
    const gaps = res.rows.filter(function (r) { return r.status === "gap"; });

    const subject = encodeURIComponent("Role match from your portfolio");
    const cv = link(P.links.resume);

    box.innerHTML =
      '<div class="match-top">' +
        '<div class="score-ring">' +
          '<svg viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle cx="50" cy="50" r="44" class="ring-bg"/>' +
            '<circle cx="50" cy="50" r="44" class="ring-fg" style="stroke-dasharray:' + C.toFixed(1) +
              ";stroke-dashoffset:" + C.toFixed(1) + '" data-target="' + (C * (1 - res.score / 100)).toFixed(1) + '"/>' +
          "</svg>" +
          '<div class="score-num"><b>' + res.score + "</b><span>% match</span></div>" +
        "</div>" +
        '<div class="match-verdict">' +
          "<h4>" + esc(v[0]) + "</h4>" +
          "<p>" + esc(v[1]) + "</p>" +
          '<div class="match-counts">' +
            "<span><b>" + (counts.shipped + counts.core) + "</b> proven</span>" +
            "<span><b>" + counts.listed + "</b> listed</span>" +
            "<span><b>" + counts.transfer + "</b> transferable</span>" +
            "<span><b>" + counts.gap + "</b> gap" + (counts.gap === 1 ? "" : "s") + "</span>" +
          "</div>" +
        "</div>" +
      "</div>" +

      (notes(res.jd).length ? '<div class="match-notes">' + notes(res.jd).map(function (n) {
        return '<div class="mnote mnote-' + n[0] + '">' + esc(n[1]) + "</div>";
      }).join("") + "</div>" : "") +

      '<div class="match-cols">' +
        '<div><div class="stage-label">Where he matches · ' + matched.length + "</div>" +
          matched.map(rowHtml).join("") + "</div>" +
        '<div><div class="stage-label">Honest gaps · ' + gaps.length + "</div>" +
          (gaps.length ? gaps.map(rowHtml).join("") :
            '<div class="match-none">None. Every skill this role asks for shows up in his work.</div>') +
        "</div>" +
      "</div>" +

      '<div class="btn-row match-cta">' +
        '<a class="btn btn-primary" href="mailto:' + esc(P.email) + "?subject=" + subject + '">Email Ritesh about this role</a>' +
        (cv ? '<a class="btn" href="' + esc(cv) + '" download>Download résumé</a>' : "") +
        '<button class="btn btn-ghost" data-m="again">Check another role</button>' +
      "</div>";

    // animate the ring; a timeout guarantees the final state even if the tab
    // is hidden and transitions never run
    const fg = box.querySelector(".ring-fg");
    requestAnimationFrame(function () { fg.style.strokeDashoffset = fg.dataset.target; });
    setTimeout(function () { fg.style.strokeDashoffset = fg.dataset.target; }, 60);
  }

  const SAMPLE_JD = [
    "AI/ML Engineer — Generative AI (Entry level / New grad)",
    "Location: Bengaluru or Remote (India)",
    "",
    "About the role",
    "We're building LLM-powered assistants for enterprise document search. You'll work on retrieval-augmented generation pipelines, agentic workflows, and the systems that keep them reliable.",
    "",
    "Requirements",
    "- Strong Python skills",
    "- Hands-on experience building RAG systems with LangChain or LangGraph",
    "- Experience with vector databases (Pinecone preferred) and embeddings",
    "- Understanding of LLM evaluation (Ragas, LLM-as-a-judge) and guardrails against prompt injection",
    "- Experience deploying with Docker and FastAPI on AWS or GCP",
    "- Familiarity with CI/CD (GitHub Actions)",
    "- 0-2 years of experience",
    "",
    "Nice to have",
    "- Kubernetes",
    "- Fine-tuning experience (LoRA)",
    "- PyTorch",
    "- Multilingual NLP"
  ].join("\n");

  let matcherBusy = false;

  function openMatcher(prefill) {
    const modal = $("matcher-modal");
    if (!modal) return;
    $("matcher-input").hidden = false;
    $("matcher-results").hidden = true;
    modal.querySelector(".modal.matcher").classList.remove("has-results");
    if (prefill) $("matcher-jd").value = prefill;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    avatar("talking");
    setTimeout(function () { avatar("idle"); }, 900);
    setTimeout(function () { $("matcher-jd").focus(); }, 60);
  }

  function closeMatcher() {
    $("matcher-modal").classList.remove("open");
    document.body.style.overflow = "";
    avatar("idle");
  }

  async function runMatcher() {
    if (matcherBusy) return;
    const text = $("matcher-jd").value.trim();
    if (text.length < 40) {
      global.toast && global.toast("Paste a full job description first — or try the sample.");
      return;
    }
    matcherBusy = true;
    const btn = $("matcher-run");
    btn.disabled = true;

    avatar("thinking");
    const res = analyse(text.slice(0, 12000));

    // The analysis is instant; the staged messages are only there so a person
    // can see what is happening. They're skipped under reduced motion.
    if (!reduceMotion) {
      const steps = ["Reading the job description…",
                     "Found " + res.rows.length + " skills it asks for…",
                     "Checking each one against his shipped work…"];
      for (const s of steps) { btn.textContent = s; await sleep(380); }
    }

    $("matcher-input").hidden = true;
    const box = $("matcher-results");
    box.hidden = false;
    document.querySelector(".modal.matcher").classList.add("has-results");
    renderResult(res);
    // reset after layout, so the score ring is what a reader sees first
    box.scrollTop = 0;
    requestAnimationFrame(function () { box.scrollTop = 0; });

    if (res.score >= 60 && global.AVATAR) global.AVATAR.celebrate(2200);
    else avatar("idle");

    btn.textContent = "Analyse the fit";
    btn.disabled = false;
    matcherBusy = false;
  }

  // Something pasted into the chat that is clearly a job posting goes to the
  // matcher instead of being treated as one very long question.
  function looksLikeJD(text) {
    if (!text || text.length < 280) return false;
    const signals = (text.match(/\b(requirements?|responsibilit|qualifications|experience with|years|we are looking|you will|nice to have|must have|role)\b/gi) || []).length;
    return signals >= 3;
  }

  /* ======================================================================
   * 2. TAILORED PITCH
   * ==================================================================== */

  let pitchBusy = false;
  let pitchIdleTimer = null;   // cleared when a pitch starts, so it can't clobber "thinking"

  function heroInView() {
    const card = $("hero-bot");
    if (!card) return false;
    const r = card.getBoundingClientRect();
    return r.top < global.innerHeight && r.bottom > 0;
  }

  function pitch() {
    const P = global.PROFILE;
    const bubble = $("hero-bubble-text"), meta = $("hero-bubble-meta");
    if (!bubble || !P.neura) return;
    if (!heroInView()) $("top").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });

    avatar("talking");
    clearTimeout(pitchIdleTimer);
    pitchIdleTimer = setTimeout(function () { avatar("idle"); }, 800);

    const aud = P.neura.pitches;
    bubble.innerHTML =
      '<div class="pitch-q">Happy to. Who am I talking to?</div>' +
      '<div class="pitch-opts">' + Object.keys(aud).map(function (k) {
        return '<button type="button" class="chip" data-aud="' + esc(k) + '">' + esc(aud[k].label) + "</button>";
      }).join("") + "</div>";
    meta.textContent = "";
  }

  async function deliverPitch(key) {
    const P = global.PROFILE;
    const p = P.neura.pitches[key];
    if (!p || pitchBusy) return;
    pitchBusy = true;
    clearTimeout(pitchIdleTimer);

    const bubble = $("hero-bubble-text"), meta = $("hero-bubble-meta");
    avatar("thinking");
    bubble.innerHTML = '<span class="bubble-typing"><span></span><span></span><span></span></span>';
    // No "a/an + label" here: it reads "a engineer" and "a just looking".
    meta.textContent = "writing your pitch…";
    await sleep(reduceMotion ? 0 : 520);

    avatar("talking");
    const actions = (p.actions || []).map(function (a) {
      if (a.skill) return '<button type="button" class="btn btn-sm" data-skill="' + esc(a.skill) + '">' + esc(a.label) + "</button>";
      const href = a.href === "resume" ? link(P.links.resume)
                 : a.href === "email" ? "mailto:" + P.email
                 : a.href === "github" ? link(P.links.github)
                 : link(a.href);
      if (!href) return "";
      const external = /^https?:/.test(href);
      return '<a class="btn btn-sm' + (a.primary ? " btn-primary" : "") + '" href="' + esc(href) + '"' +
        (a.href === "resume" ? " download" : "") + (external ? ' target="_blank" rel="noopener"' : "") + ">" +
        esc(a.label) + "</a>";
    }).join("");

    bubble.innerHTML = "<p>" + esc(p.text) + "</p>" + (actions ? '<div class="pitch-actions">' + actions + "</div>" : "");
    meta.textContent = "tailored for: " + p.label + " · built from his real numbers";

    await sleep(Math.min(2800, 700 + p.text.length * 8));
    if (global.AVATAR) global.AVATAR.celebrate(1400);
    pitchBusy = false;
  }

  /* ======================================================================
   * 3. GUIDED TOUR
   * ==================================================================== */

  let tourIdx = -1;
  let tourFocus = null;

  function tourSteps() { return (global.PROFILE.neura && global.PROFILE.neura.tour) || []; }

  // If the stop's heading is sitting in the lower part of the screen, the
  // card (normally at the bottom) would cover it - so put the card on top.
  function placeTourCard() {
    if (!tourFocus) return;
    const top = tourFocus.getBoundingClientRect().top;
    $("tour-card").classList.toggle("tour-top", top > global.innerHeight * 0.4);
  }

  function showStep(i) {
    const steps = tourSteps();
    if (i < 0 || i >= steps.length) { endTour(); return; }
    tourIdx = i;
    const step = steps[i];

    if (tourFocus) tourFocus.classList.remove("tour-focus");
    tourFocus = document.querySelector(step.target);
    if (tourFocus) {
      tourFocus.classList.add("tour-focus");
      // Align the stop's TOP just under the nav rather than centring it. The
      // tour card sits at the bottom of the screen, and centring a tall
      // section (a project card is ~900px on a phone) pushed its heading
      // down behind the card that was describing it.
      const navH = ($("nav") || {}).offsetHeight || 68;
      const y = tourFocus.getBoundingClientRect().top + global.scrollY - navH - 24;
      const maxY = document.documentElement.scrollHeight - global.innerHeight;
      global.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? "auto" : "smooth" });
      // The last stops sit too near the end of the page to scroll up to the
      // top, so they stay low - right where the tour card is. Predict that
      // now to avoid a jump, then check where the stop really landed once the
      // scroll has settled (a prediction alone misses resizes mid-tour).
      $("tour-card").classList.toggle("tour-top", y > maxY - 4);
      clearTimeout(showStep._place);
      showStep._place = setTimeout(placeTourCard, reduceMotion ? 50 : 1000);
    }

    $("tour-step").textContent = String(i + 1).padStart(2, "0") + " / " + String(steps.length).padStart(2, "0");
    $("tour-text").textContent = step.text;
    $("tour-back").disabled = i === 0;
    $("tour-next").textContent = i === steps.length - 1 ? "Finish" : "Next →";

    avatar("talking");
    clearTimeout(showStep._t);
    showStep._t = setTimeout(function () { avatar("idle"); }, Math.min(2400, 600 + step.text.length * 9));
  }

  function startTour() {
    if (!tourSteps().length) return;
    closeMatcher();
    document.body.classList.add("touring");
    $("tour-card").hidden = false;
    showStep(0);
    setTimeout(function () { $("tour-next").focus(); }, 80);
  }

  function endTour() {
    if (tourFocus) tourFocus.classList.remove("tour-focus");
    tourFocus = null;
    tourIdx = -1;
    document.body.classList.remove("touring");
    const card = $("tour-card");
    if (card) card.hidden = true;
    avatar("idle");
  }

  /* ======================================================================
   * WIRING
   * ==================================================================== */

  function runSkill(name) {
    if (name === "match") openMatcher();
    else if (name === "pitch") pitch();
    else if (name === "tour") startTour();
  }

  function init() {
    if (!global.PROFILE) return;

    // mini Neuras for the matcher and the tour card
    if (global.AVATAR) {
      global.AVATAR.mount($("matcher-avatar"), { compact: true });
      global.AVATAR.mount($("tour-avatar"), { compact: true });
    }

    // one delegated listener covers the hero buttons, the pitch options, and
    // the action buttons that appear inside answers later
    document.addEventListener("click", function (e) {
      const skill = e.target.closest("[data-skill]");
      if (skill) { e.preventDefault(); runSkill(skill.dataset.skill); return; }
      const aud = e.target.closest("[data-aud]");
      if (aud) { deliverPitch(aud.dataset.aud); return; }
      const m = e.target.closest("[data-m]");
      if (m && m.dataset.m === "again") {
        $("matcher-results").hidden = true;
        $("matcher-input").hidden = false;
        document.querySelector(".modal.matcher").classList.remove("has-results");
        $("matcher-jd").focus();
      }
    });

    const modal = $("matcher-modal");
    if (modal) {
      $("matcher-run").addEventListener("click", runMatcher);
      $("matcher-sample").addEventListener("click", function () {
        $("matcher-jd").value = SAMPLE_JD;
        runMatcher();
      });
      $("matcher-close").addEventListener("click", closeMatcher);
      modal.addEventListener("click", function (e) { if (e.target === modal) closeMatcher(); });
      $("matcher-jd").addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runMatcher();
      });
      // a link to a project inside the results should close the modal first
      $("matcher-results").addEventListener("click", function (e) {
        const a = e.target.closest('a[href^="#"]');
        if (a) closeMatcher();
      });
    }

    if ($("tour-card")) {
      global.addEventListener("resize", function () { if (tourIdx >= 0) placeTourCard(); });
      $("tour-next").addEventListener("click", function () { showStep(tourIdx + 1); });
      $("tour-back").addEventListener("click", function () { showStep(tourIdx - 1); });
      $("tour-end").addEventListener("click", endTour);
    }

    global.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (modal && modal.classList.contains("open")) closeMatcher();
        if (tourIdx >= 0) endTour();
        return;
      }
      if (tourIdx < 0) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
      if (typing) return;
      if (e.key === "ArrowRight") showStep(tourIdx + 1);
      if (e.key === "ArrowLeft" && tourIdx > 0) showStep(tourIdx - 1);
    });
  }

  global.NEURA = {
    analyse: analyse,
    parseJD: parseJD,
    openMatcher: openMatcher,
    pitch: pitch,
    startTour: startTour,
    endTour: endTour,
    looksLikeJD: looksLikeJD,
    SAMPLE_JD: SAMPLE_JD,
    TAXONOMY: TAXONOMY
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
