/* ============================================================================
 * rag.js - A real retrieval pipeline, in the browser, with no dependencies.
 *
 * Not a keyword FAQ with an if-else chain. It does what a production RAG stack
 * does, scaled down:
 *
 *   1. CHUNK      split the knowledge base into overlapping passages
 *   2. INDEX      build a vocabulary and inverse document frequency table
 *   3. EMBED      sparse TF-IDF vectors + a dense hashed vector
 *   4. RETRIEVE   cosine similarity over the index, wide top-k
 *   5. RERANK     a cross-encoder-style pass scoring query/passage jointly
 *   6. GROUND     return passages with scores so answers can cite them
 *
 * window.RAG is exposed on purpose. Open the console and run
 * RAG.query("how did you prove retrieval worked") to watch it work.
 * ==========================================================================*/

(function (global) {
  "use strict";

  /* -- 1. Text processing ------------------------------------------------ */

  const STOPWORDS = new Set(
    ("a an and are as at be been but by for from has have he her his how i in is it its me my of on or " +
     "our she that the their them then there these they this to was were what when where which who why " +
     "will with would you your do does did can could should about into over under s t").split(" ")
  );

  // A light suffix stripper. Not full Porter, but it collapses the variants
  // that matter here: retrieval/retrieved/retrieves, embedding/embeddings.
  function stem(word) {
    if (word.length <= 3) return word;
    const rules = [
      [/ies$/, "y"], [/ational$/, "ate"], [/iveness$/, "ive"], [/fulness$/, "ful"],
      [/ousness$/, "ous"], [/ization$/, "ize"], [/ations$/, "ate"], [/ation$/, "ate"],
      [/ingly$/, ""], [/edly$/, ""], [/ments$/, ""], [/ment$/, ""], [/ness$/, ""],
      [/sses$/, "ss"], [/ing$/, ""], [/ed$/, ""], [/ly$/, ""],
      [/es$/, ""], [/s$/, ""]
    ];
    for (const [re, rep] of rules) {
      if (re.test(word)) {
        const out = word.replace(re, rep);
        if (out.length >= 3) return out;
      }
    }
    return word;
  }

  function tokenize(text, keepStop) {
    const raw = String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.-]/g, " ")
      .split(/\s+/);

    const out = [];
    raw.forEach(function (t) {
      if (!t) return;
      // Index a hyphenated word as the compound AND its parts. Without this,
      // "hiring-ready" is one token matching nothing, even though the corpus
      // is full of "hiring". Same for "multi-agent", "human-in-the-loop".
      const pieces = t.indexOf("-") > 0 ? [t].concat(t.split("-")) : [t];
      pieces.forEach(function (piece) {
        const w = piece.replace(/^[.\-]+|[.\-]+$/g, "");
        if (!w || w.length < 2) return;
        if (!keepStop && STOPWORDS.has(w)) return;
        out.push(stem(w));
      });
    });
    return out;
  }

  // Split into sentences without cutting decimals: "recall@5 of 0.84" must not
  // become "0." + "84". Digit-dot-digit is masked, split, then restored.
  const DECIMAL_MASK = "\u0000D\u0000";
  function splitSentences(text, minLen) {
    const masked = String(text).replace(/(\d)\.(\d)/g, "$1" + DECIMAL_MASK + "$2");
    const parts = masked.match(/[^.!?]+[.!?]*/g) || [masked];
    return parts
      .map(function (x) { return x.split(DECIMAL_MASK).join(".").trim(); })
      .filter(function (x) { return x.length >= (minLen == null ? 1 : minLen); });
  }

  /* -- 2. Chunking ------------------------------------------------------- */

  // Overlap is what stops a fact that straddles a boundary from becoming
  // unretrievable from either side.
  function chunkText(text, maxChars, overlapChars) {
    maxChars = maxChars || 480;
    overlapChars = overlapChars || 80;
    const sentences = splitSentences(String(text)).map(function (x) { return x + " "; });
    const chunks = [];
    let buf = "";

    for (const s of sentences) {
      if (buf.length + s.length > maxChars && buf.length > 0) {
        chunks.push(buf.trim());
        buf = buf.slice(Math.max(0, buf.length - overlapChars));
      }
      buf += s;
    }
    if (buf.trim()) chunks.push(buf.trim());
    return chunks.length ? chunks : [String(text)];
  }

  /* -- 3. The vector index ----------------------------------------------- */

  const EMBED_DIM = 96;

  function VectorIndex() {
    this.docs = [];
    this.tfidf = [];
    this.dense = [];
    this.df = new Map();
    this.idf = new Map();
    this.built = false;
  }

  VectorIndex.prototype.add = function (doc) {
    this.docs.push(doc);
    this.built = false;
  };

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // The hashing trick: project each term into a fixed-width vector with a
  // signed hash. A genuine way to build a cheap dense representation without a
  // trained model. A real system swaps this for bge-m3; the geometry is same.
  function denseVector(terms, weights) {
    const v = new Float32Array(EMBED_DIM);
    for (const t of terms) {
      const h = hash32(t);
      v[h % EMBED_DIM] += ((h >>> 31) & 1 ? -1 : 1) *
        (weights && weights.get(t) ? weights.get(t) : 1);
      const h2 = hash32(t + "#2");
      v[h2 % EMBED_DIM] += ((h2 >>> 31) & 1 ? -1 : 1) * 0.5;
    }
    let norm = 0;
    for (let i = 0; i < EMBED_DIM; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < EMBED_DIM; i++) v[i] /= norm;
    return v;
  }

  VectorIndex.prototype.build = function () {
    const N = this.docs.length;
    this.df.clear();
    this.idf.clear();

    const tokenised = this.docs.map(function (d) {
      return tokenize(d.title + " " + d.text + " " + (d.tags || []).join(" "));
    });

    tokenised.forEach(function (terms) {
      new Set(terms).forEach(function (t) {
        this.df.set(t, (this.df.get(t) || 0) + 1);
      }, this);
    }, this);

    this.df.forEach(function (dfv, term) {
      this.idf.set(term, Math.log((N + 1) / (dfv + 1)) + 1);
    }, this);

    this.tfidf = tokenised.map(function (terms) {
      const tf = new Map();
      terms.forEach(function (t) { tf.set(t, (tf.get(t) || 0) + 1); });

      const vec = new Map();
      let norm = 0;
      tf.forEach(function (count, term) {
        // sublinear tf damps a term repeated many times
        const w = (1 + Math.log(count)) * (this.idf.get(term) || 1);
        vec.set(term, w);
        norm += w * w;
      }, this);

      norm = Math.sqrt(norm) || 1;
      vec.forEach(function (w, term) { vec.set(term, w / norm); });
      return vec;
    }, this);

    this.dense = tokenised.map(function (terms, i) {
      return denseVector(terms, this.tfidf[i]);
    }, this);

    this.built = true;
    return this;
  };

  VectorIndex.prototype.vectorizeQuery = function (query) {
    const terms = tokenize(query);
    const tf = new Map();
    terms.forEach(function (t) { tf.set(t, (tf.get(t) || 0) + 1); });

    const vec = new Map();
    let norm = 0;
    tf.forEach(function (count, term) {
      const w = (1 + Math.log(count)) * (this.idf.get(term) || 1.0);
      vec.set(term, w);
      norm += w * w;
    }, this);
    norm = Math.sqrt(norm) || 1;
    vec.forEach(function (w, term) { vec.set(term, w / norm); });

    return { terms: terms, sparse: vec, dense: denseVector(terms, vec) };
  };

  function cosineSparse(a, b) {
    let small = a, large = b;
    if (a.size > b.size) { small = b; large = a; }
    let dot = 0;
    small.forEach(function (w, term) {
      const o = large.get(term);
      if (o !== undefined) dot += w * o;
    });
    return dot; // both already L2-normalised
  }

  function cosineDense(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  /* -- 4. Retrieve ------------------------------------------------------- */

  // Hybrid scoring: sparse TF-IDF catches exact terminology ("Qdrant", "OPA"),
  // dense catches loose paraphrase. Real hybrid search blends BM25 with a
  // bi-encoder for exactly this reason.
  VectorIndex.prototype.search = function (query, topK) {
    if (!this.built) this.build();
    topK = topK || 8;
    const q = this.vectorizeQuery(query);

    const scored = this.docs.map(function (doc, i) {
      const sparse = cosineSparse(q.sparse, this.tfidf[i]);
      const dense = cosineDense(q.dense, this.dense[i]);
      const matched = q.terms.filter(function (t) { return this.tfidf[i].has(t); }, this);

      return {
        doc: doc,
        index: i,
        sparseScore: sparse,
        denseScore: dense,
        score: 0.75 * sparse + 0.25 * Math.max(0, dense),
        matchedTerms: Array.from(new Set(matched))
      };
    }, this);

    scored.sort(function (a, b) { return b.score - a.score; });
    return { query: query, queryTerms: q.terms, results: scored.slice(0, topK), all: scored };
  };

  /* -- 5. Rerank --------------------------------------------------------- */

  // A cross-encoder scores the (query, passage) PAIR jointly rather than
  // embedding each side alone. We can't run a transformer here, so this
  // approximates the signals one learns: coverage, phrase adjacency, position.
  function rerank(query, results) {
    const qTerms = tokenize(query);
    const qSet = new Set(qTerms);
    if (qSet.size === 0) {
      // Keep one shape for every result. Callers read rerankScore and signals
      // unconditionally; returning the raw results here crashed the chat on
      // all-stopword questions like "who are you?".
      return results.map(function (r) {
        return Object.assign({}, r, {
          rerankScore: 0,
          signals: { coverage: 0, adjacency: 0, position: 0, titleBoost: 0, retrieval: r.score }
        });
      });
    }

    const qBigrams = new Set();
    for (let i = 0; i < qTerms.length - 1; i++) qBigrams.add(qTerms[i] + " " + qTerms[i + 1]);

    return results
      .map(function (r) {
        // Tags must be included. The index embeds them, so a question can
        // retrieve on a tag; scoring against title+text only would return
        // coverage 0 and drop a correct hit as noise.
        const pTerms = tokenize(
          r.doc.title + " " + r.doc.text + " " + (r.doc.tags || []).join(" ")
        );
        const pSet = new Set(pTerms);

        let hits = 0;
        qSet.forEach(function (t) { if (pSet.has(t)) hits++; });
        const coverage = hits / qSet.size;

        let bigramHits = 0;
        for (let i = 0; i < pTerms.length - 1; i++) {
          if (qBigrams.has(pTerms[i] + " " + pTerms[i + 1])) bigramHits++;
        }
        const adjacency = qBigrams.size ? Math.min(1, bigramHits / qBigrams.size) : 0;

        let firstHit = pTerms.findIndex(function (t) { return qSet.has(t); });
        if (firstHit < 0) firstHit = pTerms.length;
        const position = 1 - Math.min(1, firstHit / Math.max(1, pTerms.length));

        const titleTerms = new Set(tokenize(r.doc.title));
        let titleHits = 0;
        qSet.forEach(function (t) { if (titleTerms.has(t)) titleHits++; });
        const titleBoost = titleHits / qSet.size;

        // Document prior. Auto-generated stubs (a bare skill list) are keyword
        // dense and short, so pure term matching lets them beat the prose that
        // actually answers the question.
        const prior = r.doc.weight != null ? r.doc.weight : 1;

        const crossScore = prior * (
          0.34 * coverage +
          0.18 * adjacency +
          0.08 * position +
          0.22 * titleBoost +
          0.18 * r.score
        );

        return Object.assign({}, r, {
          rerankScore: crossScore,
          signals: {
            coverage: coverage, adjacency: adjacency, position: position,
            titleBoost: titleBoost, retrieval: r.score
          }
        });
      })
      .sort(function (a, b) { return b.rerankScore - a.rerankScore; });
  }

  /* -- 6. Build the knowledge base from PROFILE -------------------------- */

  function buildKnowledgeBase() {
    const kb = [];
    const p = global.PROFILE;
    if (!p) return kb;

    kb.push({
      id: "identity",
      title: "Who " + p.name + " is",
      text: p.name + " is an " + p.role + " based in " + p.location + ". " + p.tagline +
            " " + (p.available ? p.availableText + "." : ""),
      tags: ["name", "who", "role", "intro", "about"],
      source: "Profile"
    });

    (p.about || []).forEach(function (para, i) {
      chunkText(para).forEach(function (c, j) {
        kb.push({
          id: "about-" + i + "-" + j,
          title: "About " + p.name,
          text: c,
          tags: ["about", "background", "summary", "bio"],
          source: "About"
        });
      });
    });

    (p.skills || []).forEach(function (group) {
      const names = group.items.map(function (s) { return s.name; }).join(", ");
      const top = group.items.slice()
        .sort(function (a, b) { return b.level - a.level; })
        .slice(0, 3).map(function (s) { return s.name; }).join(", ");
      kb.push({
        id: "skill-" + group.category,
        title: group.category + " skills",
        text: "In " + group.category + ", " + p.name + " works with " + names +
              ". The strongest of these are " + top + ".",
        tags: ["skills", "tech", "stack", "tools"].concat(group.category.toLowerCase().split(/\s+/)),
        weight: 0.66,   // a bare list of names, not an explanation
        source: "Skills"
      });
    });

    (p.projects || []).forEach(function (proj) {
      kb.push({
        id: "proj-" + proj.name,
        title: "Project: " + proj.name,
        text: proj.name + (proj.subtitle ? " — " + proj.subtitle : "") +
              " (" + proj.year + ", " + proj.status + "). " + proj.blurb +
              " Built with " + proj.stack.join(", ") + ".",
        tags: ["project", "projects", "built", "work"].concat(proj.name.toLowerCase().split(/\s+/)),
        source: "Projects"
      });

      if (proj.highlights && proj.highlights.length) {
        kb.push({
          id: "proj-hl-" + proj.name,
          title: proj.name + " - technical details",
          text: "Technical details of " + proj.name + ": " + proj.highlights.join(". ") + ".",
          tags: ["project", "technical", "architecture", "details", "how"]
                .concat(proj.name.toLowerCase().split(/\s+/)),
          weight: 1.12,   // richest source of real detail
          source: "Projects"
        });
      }
    });

    (p.experience || []).forEach(function (e, i) {
      kb.push({
        id: "exp-" + i,
        title: e.role + " at " + e.org,
        text: e.role + " at " + e.org + " (" + e.period + "). " + e.points.join(". ") + ".",
        tags: ["experience", "work", "job", "role", "career"],
        source: "Experience"
      });
    });

    (p.education || []).forEach(function (e, i) {
      kb.push({
        id: "edu-" + i,
        title: "Education: " + e.degree,
        text: e.degree + " at " + e.org + " (" + e.period + "). " + e.detail,
        tags: ["education", "degree", "university", "college", "studied"],
        source: "Education"
      });
    });

    if (p.now && p.now.length) {
      kb.push({
        id: "now",
        title: "What " + p.name + " is working on now",
        text: "Currently: " + p.now.join(". ") + ".",
        tags: ["now", "current", "learning", "next", "working"],
        source: "Now"
      });
    }

    kb.push({
      id: "contact",
      title: "Contact details",
      text: "You can reach " + p.name + " by email at " + p.email +
            (p.phone ? " or phone " + p.phone : "") + ". GitHub: " + p.links.github +
            ". LinkedIn: " + p.links.linkedin + ". " +
            (p.available ? p.availableText + "." : ""),
      tags: ["contact", "email", "reach", "hire", "github", "linkedin", "phone",
             "touch", "connect", "message", "call", "talk"],
      source: "Contact"
    });

    (global.EXTRA_KNOWLEDGE || []).forEach(function (item, i) {
      chunkText(item.text, 520, 90).forEach(function (c, j) {
        kb.push({
          id: "extra-" + i + "-" + j,
          title: item.title,
          text: c,
          tags: item.tags || [],
          weight: 1.08,   // written specifically to answer questions
          source: "Notes"
        });
      });
    });

    return kb;
  }

  /* -- 7. Public API ----------------------------------------------------- */

  const index = new VectorIndex();
  let ready = false;

  function init() {
    if (ready) return;
    buildKnowledgeBase().forEach(function (d) { index.add(d); });
    index.build();
    ready = true;
  }

  const RAG = {
    init: init,
    get index() { init(); return index; },

    // Full pipeline: retrieve wide, rerank down. Returns everything the UI
    // needs to show its work.
    query: function (question, opts) {
      init();
      opts = opts || {};
      const topK = opts.topK || 8;
      const finalN = opts.finalN || 4;

      const t0 = performance.now();
      const retrieved = index.search(question, topK);
      const tRetrieve = performance.now() - t0;

      const t1 = performance.now();
      const reranked = rerank(question, retrieved.results);
      const tRerank = performance.now() - t1;

      const kept = reranked.slice(0, finalN).filter(function (r) {
        return r.rerankScore > 0.06; // below this it's noise, not a match
      });

      return {
        question: question,
        queryTerms: retrieved.queryTerms,
        retrieved: retrieved.results,
        reranked: reranked,
        context: kept,
        timing: { retrieve: tRetrieve, rerank: tRerank, total: tRetrieve + tRerank },
        stats: {
          corpusSize: index.docs.length,
          vocabSize: index.idf.size,
          topK: topK,
          keptN: kept.length
        }
      };
    },

    search: function (q, k) { init(); return index.search(q, k || 5).results; },
    rerank: rerank,
    tokenize: tokenize,
    stem: stem,
    splitSentences: splitSentences,
    chunkText: chunkText,
    denseVector: denseVector,
    cosineDense: cosineDense,
    buildKnowledgeBase: buildKnowledgeBase,
    EMBED_DIM: EMBED_DIM,

    createIndex: function (docs) {
      const ix = new VectorIndex();
      docs.forEach(function (d) { ix.add(d); });
      return ix.build();
    }
  };

  global.RAG = RAG;
})(window);
