/* ============================================================================
 * profile.js - THE ONLY FILE YOU NEED TO EDIT.
 *
 * Everything reads from here: hero, quick facts, projects, skills, timeline,
 * AND the chatbot's knowledge base. All data below comes from your October
 * resume (Ritesh resume 11 ATS).
 * ==========================================================================*/

const PROFILE = {
  // ---- Identity -----------------------------------------------------------
  name: "Ritesh Kumar",
  initials: "RK",
  role: "AI/ML Engineer",
  tagline: "I build production LLM systems — retrieval that can prove its answers, multi-agent pipelines with real governance, and the evaluations that stop them quietly failing.",
  location: "Pune, India",
  email: "riteshkumarcc680971@gmail.com",
  // Left blank on purpose: a public site gets scraped by spam bots. Every place
  // that shows a phone number checks this field first, so filling it in brings
  // the call button back automatically.
  phone: "",
  available: true,
  availableText: "Open to AI/ML Engineer roles & internships",

  links: {
    github:   "https://github.com/ritesh469",
    linkedin: "https://linkedin.com/in/ritesh-kumar-615014277",
    twitter:  "",
    // Empty until there's a résumé without the phone number on it. Put that PDF
    // in assets/ and set this to its path; every "Résumé" button reappears.
    resume:   ""
  },

  // ---- Recruiter quick facts ----------------------------------------------
  // The block a non-technical screener actually reads: role, place, level,
  // availability. Keep it short and filterable.
  quickFacts: {
    seeking:      "AI/ML Engineer · Generative AI · LLM Systems",
    employment:   "Internships & new-grad roles",
    location:     "Pune, India",
    relocation:   "Open to relocation and remote",   // TODO confirm
    availability: "Graduating 2027 · available for internships now",
    education:    "B.E. Computer Science · GPA 8.9 / 10",
    core:         ["LangGraph", "RAG", "Qdrant", "FastAPI", "Docker", "AWS/GCP"]
  },

  // ---- About --------------------------------------------------------------
  about: [
    "I'm an AI/ML engineer and Computer Science undergraduate at Bharati Vidyapeeth College of Engineering, Pune (graduating 2027). I build production-grade Generative AI systems: retrieval-augmented generation, multi-agent orchestration with LangGraph, LLM guardrails, and the evaluation harnesses that keep all of it honest.",
    "The thread through my work is measurement. On Sahakar Sahayak I didn't just build hybrid retrieval — I built a 304-question evaluation set across four languages to prove it lifted recall@5 from 0.46 to 0.84, and isolated how much of that gain came from the reranker alone. Without the eval set, that's a guess. With it, it's a result.",
    "I'm also drawn to the unglamorous failures nobody demos: an English-only injection filter silently blocking 8 of 16 legitimate Hindi and Marathi queries; an MLflow promotion gate scoring every candidate 0.0 and shipping the wrong model; 15 internal services, including a secrets vault, reachable over Wi-Fi. Those bugs are where systems actually break.",
    "Everything on this page runs live in your browser. The neural network trains with real backpropagation, the retrieval pipeline does real vector math, and the agent genuinely calls tools. Open DevTools and check."
  ],

  // ---- Headline metrics ---------------------------------------------------
  metrics: [
    { value: "0.84", label: "recall@5 on RAG eval",   sub: "lifted from 0.46 baseline" },
    { value: "0/32", label: "Injection attacks through", sub: "language-aware guardrails" },
    { value: "673",  label: "Pages indexed, 4 languages", sub: "EN · HI · MR · Hinglish" },
    { value: "~70%", label: "Manual effort removed",  sub: "client automation workflows" }
  ],

  // ---- Skills -------------------------------------------------------------
  skills: [
    {
      category: "Generative AI & RAG",
      icon: "search",
      items: [
        { name: "RAG architecture",        level: 92 },
        { name: "LangChain / LangGraph",   level: 90 },
        { name: "Hybrid search (BM25+RRF)", level: 88 },
        { name: "Re-ranking & embeddings", level: 88 },
        { name: "Vector DBs (Qdrant, pgvector)", level: 86 },
        { name: "Multi-agent systems",     level: 85 },
        { name: "HyDE / CRAG / Self-RAG",  level: 80 }
      ]
    },
    {
      category: "LLMOps & Evaluation",
      icon: "cpu",
      items: [
        { name: "Ragas & LLM-as-judge",    level: 86 },
        { name: "Guardrails (LLM Guard, Bedrock)", level: 84 },
        { name: "Prompt-injection defense", level: 85 },
        { name: "Red teaming (PyRIT)",     level: 78 },
        { name: "LangSmith tracing",       level: 82 },
        { name: "Semantic caching & memory", level: 83 }
      ]
    },
    {
      category: "Machine Learning",
      icon: "brain",
      items: [
        { name: "PyTorch",                 level: 85 },
        { name: "Transformers & NLP",      level: 86 },
        { name: "scikit-learn",            level: 86 },
        { name: "XGBoost / LightGBM",      level: 83 },
        { name: "LoRA / QLoRA fine-tuning", level: 78 },
        { name: "MLflow",                  level: 82 }
      ]
    },
    {
      category: "Backend, Cloud & Security",
      icon: "server",
      items: [
        { name: "Python",                  level: 92 },
        { name: "FastAPI & REST",          level: 88 },
        { name: "Docker & Compose",        level: 86 },
        { name: "CI/CD (GitHub Actions)",  level: 84 },
        { name: "Terraform · AWS · GCP",   level: 78 },
        { name: "OPA / Keycloak / SPIFFE", level: 76 },
        { name: "PostgreSQL · Redis",      level: 82 }
      ]
    }
  ],

  // ---- Also on the résumé ----------------------------------------------------
  // Real skills without a rating bar. Shown as tags under the skill bars, and
  // the job matcher counts them as "listed" rather than calling them gaps.
  skillsAlso: [
    "TypeScript", "JavaScript", "SQL", "Pandas", "NumPy", "Computer Vision", "CNN",
    "Deep Learning", "Hugging Face", "OpenAI API", "Claude API", "Groq",
    "Prompt engineering", "Next.js", "React", "Microservices", "MySQL", "Streamlit",
    "n8n", "pytest", "Linux", "Git", "Power BI", "System Design",
    "Data Structures & Algorithms", "DBMS", "Operating Systems", "Computer Networks"
  ],

  // ---- Projects -----------------------------------------------------------
  projects: [
    {
      name: "Sahakar Sahayak",
      subtitle: "Multilingual, hallucination-aware RAG assistant",
      featured: true,
      year: "2025",
      blurb: "A RAG assistant over cooperative law and government schemes in English, Hindi, Marathi and Hinglish — 23 official documents, 673 pages. It cites the file and page for every fact, and refuses when the answer simply isn't there.",
      highlights: [
        "Hybrid retrieval — bge-m3 embeddings + BM25 with a custom Devanagari tokenizer, fused by RRF, then a cross-encoder reranker — raising recall@5 from 0.46 (TF-IDF) to 0.84; the reranker alone contributed +0.12 (p < 0.001)",
        "Built a 304-question, 4-language evaluation set; across 6 experiments it reached 99.3% language match and refused 90% of unanswerable questions",
        "Found an English-only injection filter silently blocking 8 of 16 legitimate Hindi/Marathi queries; language-aware guardrails cut false blocks to 0/16 while letting 0/32 real attacks through",
        "Wrote a 19-page research paper (draft) comparing HyDE, CRAG and Self-RAG — none improved accuracy, at 3–6x the latency"
      ],
      stack: ["LangGraph", "Qdrant", "bge-m3", "BM25 + RRF", "FastAPI", "Ragas"],
      links: {
        demo:   "https://sahakar-sahayak-ochre.vercel.app",
        github: "https://github.com/ritesh469/sahakar-sahayak"
      },
      status: "Live"
    },
    {
      name: "ReturnGuard",
      subtitle: "Governed multi-agent AI for e-commerce returns",
      featured: true,
      year: "2025",
      blurb: "A 10-agent system that reviews e-commerce return requests with human-in-the-loop guardrails — no automatic refusals, and human sign-off required above $250. Runs as 18 Docker services.",
      highlights: [
        "Extended an open-source 10-agent system with human-in-the-loop guardrails, running as 18 Docker services",
        "Closed a network exposure that left 15 services — including the database and the secrets vault — reachable over Wi-Fi",
        "Added CI with linting, type-checking, policy tests and secret scanning",
        "Fixed a 30-second stall on every Windows DB connection (IPv6 localhost) down to ~0.1s, and replaced a withdrawn dependency",
        "Redesigned the Next.js UI with a live return-status page and fixed 3 user-facing bugs; 10/10 live test suites pass"
      ],
      stack: ["LangGraph", "FastAPI", "Next.js", "OPA", "Keycloak", "Docker"],
      links: {
        demo:   "https://returnguard-ritesh.vercel.app",
        github: "https://github.com/ritesh469/Retail-FDE-Project"
      },
      status: "Live"
    },
    {
      name: "AI Governance Platform",
      subtitle: "Open-source contribution",
      featured: false,
      year: "2025",
      blurb: "A 16-service LangGraph multi-agent system applying 7 governance layers to every single request — identity, policy, lineage, model approval, guardrails, tool auth, and a hash-chained audit log.",
      highlights: [
        "7 governance layers per request: Keycloak OIDC + SPIFFE/SPIRE mTLS, OPA policy, OpenMetadata, MLflow approval, guardrails, tool auth, hash-chained audit log",
        "Fixed a silent MLflow promotion-gate failure that scored every candidate 0.0 and promoted the wrong production model",
        "Cut the deployment footprint from 8.5 GB to 2.2 GB with Docker Compose profiles, so it runs on a 16 GB laptop",
        "Fixed an hourly stack crash by replacing single-use SPIRE join tokens with re-attestable x509pop certificates",
        "Added the project's first Python test suite, a 4-job GitHub Actions pipeline, and a Codespaces dev container"
      ],
      stack: ["LangGraph", "Keycloak", "SPIFFE/SPIRE", "OPA", "MLflow", "Docker"],
      links: {
        demo:   "https://ritesh469.github.io/ai-governance-platform",
        github: "https://github.com/ritesh469/ai-governance-platform"
      },
      status: "Contributing"
    },
    {
      name: "Multi-Agent AI Research Platform",
      subtitle: "Search → Summarize → Write → Verify",
      featured: false,
      year: "2025",
      blurb: "A 4-agent LangGraph research pipeline with three-tier memory, routed through AWS Bedrock Guardrails and a TensorZero gateway with automatic GPT-4o / Groq fallback.",
      highlights: [
        "Three-tier memory: Redis short-term, pgvector long-term, plus semantic caching",
        "Scored reports with LLM-as-judge evaluations in LangSmith",
        "Red-teamed the guardrails with PyRIT — jailbreak, XPIA, crescendo and skeleton-key attacks",
        "Shipped AWS infrastructure via Terraform and GitHub Actions CI/CD"
      ],
      stack: ["LangGraph", "AWS Bedrock", "TensorZero", "Redis", "pgvector", "Terraform"],
      links: { demo: "", github: "" },   // TODO add repo if public
      status: "Built"
    },
    {
      name: "This Portfolio",
      subtitle: "ML from scratch, in the browser",
      featured: false,
      year: "2025",
      blurb: "The interactive demos on this page: a multi-layer perceptron with hand-derived backpropagation, k-means with k-means++ seeding, polynomial regression by gradient descent, and live scaled dot-product attention. No frameworks, no pretrained weights.",
      highlights: [
        "Manual chain-rule backprop through arbitrary hidden layers — no autograd",
        "Real-time decision-boundary rendering as the network learns",
        "Browser-side retrieval with TF-IDF vectors, cosine scoring and a reranking stage"
      ],
      stack: ["JavaScript", "Canvas", "Linear algebra"],
      links: { demo: "#playground", github: "" },
      status: "Running on this page"
    }
  ],

  // ---- Experience ---------------------------------------------------------
  experience: [
    {
      role: "AI Automation Freelancer",
      org: "Independent",
      period: "2024 — Present",
      points: [
        "Designed and delivered n8n + Claude API automation workflows for multiple business clients, reducing manual effort by ~70%",
        "Scoped requirements directly with clients, integrated third-party APIs, and handed over documented, running systems"
      ]
    }
  ],

  // ---- Education ----------------------------------------------------------
  education: [
    {
      degree: "B.E. Computer Science — Expected 2027",
      org: "Bharati Vidyapeeth College of Engineering, Pune",
      period: "GPA 8.9 / 10.0",
      detail: "Class XII (CBSE) 70.2% · Class X (CBSE) 87.8%"
    }
  ],

  // ---- Leadership ---------------------------------------------------------
  leadership: [
    {
      role: "Marketing Head",
      org: "Google Developer Group on Campus (GDGC), Bharati Vidyapeeth COE",
      detail: "Led outreach and event promotion for the campus chapter."
    }
  ],

  // ---- Certifications -----------------------------------------------------
  certifications: [
    { name: "AI & Machine Learning", issuer: "Udemy" },
    { name: "Data Science Bootcamp", issuer: "Udemy" },
    { name: "n8n Automation",        issuer: "Udemy" },
    { name: "Web Development",       issuer: "Udemy" }
  ],

  // ---- Neura: what the assistant says and does ------------------------------
  neura: {
    // "Pitch me": Neura asks who's visiting, then gives the matching pitch.
    // Action hrefs can be a URL, "#section", "resume", "email" or "github";
    // { skill: "tour" | "match" } runs one of Neura's skills instead.
    pitches: {
      recruiter: {
        label: "Recruiter",
        text: "Short version: Ritesh is an AI/ML engineer graduating in 2027, available for internships now, based in Pune and open to relocation or remote. He has two LLM products live today — Sahakar Sahayak, a multilingual RAG assistant where he lifted recall@5 from 0.46 to 0.84, and ReturnGuard, a 10-agent system with human sign-off built in. He measures everything, and he'll tell you his gaps before you find them.",
        actions: [
          { label: "Download résumé", href: "resume", primary: true },
          { label: "See live projects", href: "#projects" },
          { label: "Match it to a role", skill: "match" }
        ]
      },
      engineer: {
        label: "Engineer",
        text: "The interesting parts: hybrid retrieval with bge-m3 plus BM25 fused by RRF, then a cross-encoder reranker worth +0.12 recall@5 at p < 0.001 on a 304-question, four-language eval set. He caught an English-only injection filter silently blocking 8 of 16 Hindi and Marathi queries, and an MLflow gate that promoted the wrong model by scoring every candidate 0.0. Everything on this page is written from scratch and runs in your browser — open DevTools.",
        actions: [
          { label: "Read the code", href: "github", primary: true },
          { label: "Open the playground", href: "#playground" }
        ]
      },
      founder: {
        label: "Founder",
        text: "He ships. Two LLM products are live on Vercel right now. He cut a 16-service stack from 8.5 GB to 2.2 GB so it runs on a laptop, closed a hole that left a secrets vault reachable over Wi-Fi, and his n8n + Claude automations removed about 70% of manual work for paying clients. He scopes with real users, builds end to end, and hands over systems that keep running after he leaves.",
        actions: [
          { label: "Email him", href: "email", primary: true },
          { label: "See live projects", href: "#projects" }
        ]
      },
      curious: {
        label: "Just looking",
        text: "Fair enough! The fun part is the Playground: train a neural network from scratch and watch it learn, or give an agent a goal and watch it decide which tools to call. Or ask me something tricky about Ritesh and watch me show my working.",
        actions: [
          { label: "Take the tour", skill: "tour", primary: true },
          { label: "Open the playground", href: "#playground" }
        ]
      }
    },

    // "Tour": each stop scrolls to `target` (a CSS selector) and highlights it.
    tour: [
      { target: ".glance",
        text: "Start here: the 20-second version. Role, location, availability and education — exactly what a recruiter filters on." },
      { target: "#assistant .chat-shell",
        text: "This is me, properly. Ask a question and the panel on the right shows which facts I retrieved and how I scored them. No script — real retrieval." },
      { target: "#proj-featured .card",
        text: "His flagship, Sahakar Sahayak. Every bullet has a number behind it, and it's live — the button opens the real thing." },
      { target: "#playground .tab-panel.active",
        text: "Six ML algorithms written from scratch, running in your browser. Press Train and watch a neural network learn in real time." },
      { target: "#skills-grid",
        text: "Skills, rated honestly rather than generously. Ask me what he's still learning and I'll tell you." },
      { target: ".contact-card",
        text: "And when you're convinced: email is the fastest way to reach him. Thanks for touring with me!" }
    ]
  },

  // ---- Scrolling strip under the hero ---------------------------------------
  marquee: [
    "Retrieval-augmented generation", "LangGraph", "Hybrid search", "Guardrails",
    "Ragas evals", "Qdrant", "Multi-agent systems", "FastAPI", "Docker",
    "AWS · GCP", "English · हिन्दी · मराठी"
  ],

  // ---- Currently ----------------------------------------------------------
  now: [
    "Finishing the research paper comparing HyDE, CRAG and Self-RAG",
    "Deepening red-teaming practice with PyRIT against multilingual guardrails",
    "Learning distributed training and large-scale serving — most of my work has been single-node"
  ]
};

/* ============================================================================
 * KNOWLEDGE BASE - what the chatbot retrieves over.
 * Most of it is generated from PROFILE above (see rag.js). Add extra facts
 * here: the things a recruiter might ask that don't fit structured data.
 * ==========================================================================*/

const EXTRA_KNOWLEDGE = [
  {
    title: "How I proved the retrieval actually worked",
    text: "On Sahakar Sahayak I built a 304-question evaluation set across four languages before trusting any retrieval change. That is how I know hybrid retrieval lifted recall@5 from 0.46 with plain TF-IDF to 0.84, and that the cross-encoder reranker alone accounted for +0.12 of it at p < 0.001. Without an eval set you are guessing about whether a change helped; with one, you can attribute the gain to a specific component and defend it.",
    tags: ["evaluation", "ragas", "recall", "metrics", "retrieval", "proof", "sahakar", "eval set"]
  },
  {
    title: "Why hybrid retrieval and reranking",
    text: "Most RAG failures are retrieval failures, not generation failures. If the right chunk never reaches the context window, no prompt engineering saves the answer. So I combine dense embeddings (bge-m3) with BM25 keyword search, fuse them with reciprocal rank fusion, and then rerank with a cross-encoder. Dense catches paraphrase, BM25 catches exact legal terminology, and the cross-encoder scores the query and passage jointly rather than independently. Cheap and wide for recall, expensive and narrow for precision.",
    tags: ["rag", "retrieval", "hybrid", "bm25", "rrf", "reranking", "embeddings", "architecture"]
  },
  {
    title: "The multilingual guardrail bug",
    text: "I found that an English-only prompt-injection filter was silently blocking 8 out of 16 perfectly legitimate Hindi and Marathi queries. The security control was quietly breaking the product for exactly the users it was meant to serve. I rebuilt it as a language-aware guardrail: false blocks dropped to 0 out of 16 while still letting 0 out of 32 genuine attacks through. Safety features need evaluating against real traffic just as carefully as model quality does, or you ship discrimination and call it security.",
    tags: ["guardrails", "security", "injection", "multilingual", "hindi", "marathi", "bug", "safety", "false positive"]
  },
  {
    title: "A custom tokenizer for Devanagari",
    text: "Off-the-shelf BM25 tokenizers assume whitespace-delimited Latin script and fall apart on Devanagari, so Hindi and Marathi retrieval quietly underperformed. I wrote a custom tokenizer for the script. It is a good example of how most of the hard work in a multilingual system is in the preprocessing nobody writes blog posts about, not in the model choice.",
    tags: ["tokenizer", "devanagari", "hindi", "marathi", "multilingual", "bm25", "preprocessing", "nlp"]
  },
  {
    title: "What my research paper found",
    text: "I wrote a 19-page draft research paper comparing HyDE, CRAG and Self-RAG against my baseline pipeline. The honest result was that none of them improved accuracy on my task, while costing three to six times the latency. I think reporting that is more useful than quietly dropping the experiment. Advanced RAG techniques are not free upgrades; they are trade-offs that have to earn their latency on your specific data.",
    tags: ["research", "paper", "hyde", "crag", "self-rag", "latency", "negative result", "honest"]
  },
  {
    title: "Governance in multi-agent systems",
    text: "On the AI Governance Platform I worked on a 16-service LangGraph system that applies 7 governance layers to every request: Keycloak OIDC identity, SPIFFE/SPIRE mTLS between services, OPA policy checks, OpenMetadata lineage, MLflow model approval, output guardrails, tool authorisation, and a hash-chained audit log. Autonomous agents that call real tools need the same controls as any other privileged system. The interesting failure I fixed there was a silent MLflow promotion gate scoring every candidate 0.0 and promoting the wrong production model.",
    tags: ["governance", "multi-agent", "opa", "keycloak", "spiffe", "mlflow", "audit", "security", "agents"]
  },
  {
    title: "Human-in-the-loop design",
    text: "ReturnGuard reviews e-commerce return requests with 10 agents, and I deliberately kept humans in the loop: the system never issues an automatic refusal, and anything above $250 requires human sign-off. Full autonomy is usually the wrong default for decisions that affect customers. Picking where a human must stay in the loop is a design decision about risk, not a limitation of the model.",
    tags: ["agents", "human in the loop", "returnguard", "design", "autonomy", "risk", "guardrails"]
  },
  {
    title: "Engineering bugs I am most proud of finding",
    text: "A network exposure leaving 15 services, including the database and the secrets vault, reachable over Wi-Fi. A 30-second stall on every Windows database connection caused by IPv6 localhost resolution, cut to about 0.1 seconds. An hourly stack crash caused by single-use SPIRE join tokens, fixed with re-attestable x509pop certificates. A deployment footprint of 8.5 GB cut to 2.2 GB with Docker Compose profiles so it runs on a 16 GB laptop. None of these are model work, and all of them decided whether the system was usable.",
    tags: ["debugging", "bugs", "performance", "security", "docker", "infrastructure", "engineering", "proud"]
  },
  {
    title: "Why RAG over fine-tuning",
    text: "I default to retrieval over fine-tuning for knowledge-heavy tasks because retrieval keeps the knowledge auditable and updatable. When an answer is wrong with RAG you can point at the retrieved chunk and fix the source; with a fine-tune the error is baked into the weights and costs a training run to correct. That matters especially for legal and government content, where every claim needs a file and page citation. Fine-tuning earns its place for changing behaviour, format or tone, which is where I use LoRA and QLoRA.",
    tags: ["rag", "fine-tuning", "lora", "qlora", "philosophy", "approach", "citations"]
  },
  {
    title: "Hallucination and refusal",
    text: "Sahakar Sahayak cites the source file and page number for every fact, and refuses when the answer is not in the corpus — it correctly refused 90% of deliberately unanswerable questions in evaluation. Getting a system to say I don't know is harder than getting it to sound confident, and far more valuable in a domain where a wrong answer about a government scheme has real consequences for someone.",
    tags: ["hallucination", "refusal", "citations", "grounding", "safety", "trust", "unanswerable"]
  },
  {
    title: "Strengths I would bring to a team",
    text: "I am strongest at the engineering around models rather than model research: choosing a retrieval architecture, building the evaluation before the feature, and finding where latency, cost and silent failures actually live. I am comfortable in unfamiliar infrastructure — Keycloak, SPIFFE, OPA and Terraform were all new to me when I started the governance work. I would rather ship a smaller system I can measure than a larger one I can only hope about.",
    tags: ["hiring", "strengths", "recruiter", "team", "why hire", "value"]
  },
  {
    title: "What I am still learning",
    text: "My work has been single-node, so I am deepening distributed training and large-scale serving. I want more production experience operating systems under real traffic rather than demo load. And I am still building fluency in the statistics behind evaluation — I can run Ragas and significance tests, but I want to reason about experiment design more rigorously. I would rather name these gaps than have someone discover them in week two.",
    tags: ["learning", "growth", "weaknesses", "honest", "gaps", "improve"]
  },
  {
    title: "Education and background",
    text: "I am studying Bachelor of Engineering in Computer Science at Bharati Vidyapeeth College of Engineering in Pune, graduating in 2027, with a GPA of 8.9 out of 10. I scored 70.2% in Class XII CBSE and 87.8% in Class X CBSE. I hold Udemy certifications in AI and Machine Learning, Data Science, n8n Automation and Web Development, and I am Marketing Head of the Google Developer Group on Campus chapter.",
    tags: ["education", "college", "university", "gpa", "degree", "graduation", "certifications", "gdgc"]
  },
  {
    title: "Freelance automation work",
    text: "I build n8n and Claude API automation workflows for business clients as an independent freelancer, which has reduced manual effort by roughly 70% on the processes I replaced. The engineering is only half of it. Most of the value comes from scoping what people actually do, including the exceptions they never mention until the automation breaks on them, and from handing over something documented that keeps running after I leave.",
    tags: ["freelance", "n8n", "automation", "claude api", "clients", "experience", "requirements"]
  },
  {
    title: "Contact and availability",
    text: "I am open to AI/ML engineer roles and internships, and I graduate in 2027. I am based in Pune, India, and open to relocation and remote work. The fastest way to reach me is email at riteshkumarcc680971@gmail.com. My GitHub is github.com/ritesh469 and two of my projects are deployed and clickable from this page. I am happy to walk through the architecture of any of them on a call.",
    tags: ["contact", "hiring", "availability", "email", "phone", "reach", "linkedin", "github", "pune",
           "touch", "get in touch", "connect", "message", "talk", "call", "speak", "hire me", "apply"]
  },
  {
    title: "What Neura can do",
    text: "Besides answering questions about Ritesh, I have three skills. Match a job: paste a job description and I check every requirement against work he has actually shipped, give a match score, and list the honest gaps. Pitch me: tell me whether you're a recruiter, an engineer or a founder and I'll give you the version of Ritesh that matters to you. Take the tour: I'll walk you through this page section by section. All three buttons are in my card at the top of the page.",
    tags: ["neura", "what can you do", "skills", "features", "help", "job match", "match", "pitch", "tour", "abilities", "commands"]
  },
  {
    title: "This portfolio site itself",
    text: "This portfolio is built with zero dependencies — no React, no build step, no npm install. The chatbot answering you right now runs a genuine retrieval pipeline in your browser: it chunks this knowledge base, builds TF-IDF weighted vectors, scores them against your question with cosine similarity, reranks the results, and shows you the retrieved chunks and their scores. The neural network demo trains with real backpropagation. Nothing here is a screenshot or a canned response.",
    tags: ["portfolio", "site", "meta", "how it works", "built", "anime", "chatbot", "neura"]
  }
];

/* Top-level `const` lives in script scope, not on `window`, so the other
 * modules can't see it. Publish both explicitly. */
window.PROFILE = PROFILE;
window.EXTRA_KNOWLEDGE = EXTRA_KNOWLEDGE;
