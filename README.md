# Ritesh Kumar — AI/ML Engineer Portfolio

A zero-dependency portfolio where every AI feature actually runs. No React, no build step,
no `npm install`, no API keys required. Open `index.html` and it works.

## Run it

```bash
cd "C:/Users/rites/OneDrive/Desktop/ai-portfolio" && python serve.py
```

Then open <http://localhost:8098>.

Use `serve.py` rather than `python -m http.server`: the stock server lets the browser cache
JS and CSS, so after editing `profile.js` a reload can still show the old version.
`serve.py` sends `Cache-Control: no-store`, so a reload always shows your latest edit.

You can also just double-click `index.html` — everything works over `file://` too, since
there are no ES modules or fetch calls.

## Design

A light editorial direction, after **IRIS_AI by skvortsov.design**: a warm off-white ground,
near-black ink, and a single amber accent. Headlines mix oversized condensed caps with an
italic serif and `//` slashes (*AI THAT CAN / prove // / IT'S RIGHT*), labels are monospace
in brackets (`(RITESH_KUMAR)`, `[ SEC. 01 ]`), buttons are pills, and rules are hairlines.

The one dramatic element is the **fibre-strand field** behind Neura: a single bundle of
Bezier filaments sweeping in from the top-left and fanning out into glowing amber tips,
drifting on slow sine waves and shifting with the pointer. It pauses when the hero scrolls
offscreen and renders one still frame under `prefers-reduced-motion`.

The retrieval benchmark terminal stays dark on purpose: the one inverted object on the page.

Fonts: Inter Tight (display and body), Instrument Serif (italic accents), JetBrains Mono
(labels), all from Google Fonts with system fallbacks.

## What's actually running

Nothing here is a screenshot or a canned response.

| Feature | What it really does |
|---|---|
| **Neura** (anime assistant) | Hand-drawn SVG character based on your photo — aviators, quiff, beard. Her expression is driven by real pipeline state: thinking while retrieving, talking while answering, with an anime lens-glint while she searches |
| **Job matcher** (Neura skill) | A recruiter pastes a job description. Neura extracts the ~55 skill families JDs ask for, checks each against Ritesh's shipped projects, and labels it *Shipped*, *Core skill*, *Listed*, *Transferable* or *Gap* — with the project that proves it. Required skills count double; seniority, years and location get plain-language notes. Runs entirely in the browser, so a confidential JD never leaves the page |
| **Pitch me** (Neura skill) | Neura asks who's visiting — recruiter, engineer, founder, or just looking — and gives the 30-second version that matters to them, with action buttons |
| **Guided tour** (Neura skill) | Neura walks visitors through six stops, scrolling and highlighting each section. Arrow keys work; Esc ends it |
| **Portfolio chatbot** | Genuine retrieval: chunking → TF-IDF vectors → cosine similarity → cross-encoder-style rerank → grounded answer with citations, over 42 indexed facts |
| **"How she found it"** | Shows every retrieved chunk, its exact-word and similar-meaning scores, the rerank signals, and what got dropped |
| **Neural network trainer** | Multi-layer perceptron with hand-derived backpropagation. Verified: loss 0.796 → 0.012, **99.5% accuracy** on two spirals in ~1500 epochs with 105 parameters |
| **RAG playground** | Paste your own text, tune chunk size and overlap, watch the whole pipeline run on it |
| **Agentic loop** | ReAct-style plan → act → observe with 6 real tools and JSON schemas, showing raw tool output |
| **Self-attention** | Live `softmax(QKᵀ/√d)V` over any sentence, with a per-head heatmap |
| **k-means** | Lloyd's algorithm with k-means++ seeding, one iteration at a time |
| **Polynomial regression** | Gradient descent on MSE — push the degree up and watch it overfit |

Open the console and try:

```js
RAG.query("how did you prove retrieval worked")
AGENT.runTool("list_projects", { tech: "langgraph" })
ML.MLP
```

## Editing Neura

Everything Neura *says* lives in `js/profile.js` under `neura`:

- `neura.pitches` — one pitch per audience. Each has a `label`, the `text`, and `actions`
  (buttons). An action's `href` can be a URL, a `#section`, or the shortcuts `"resume"`,
  `"email"` and `"github"`; `{ skill: "match" }` or `{ skill: "tour" }` runs a skill instead.
- `neura.tour` — the tour stops: a CSS selector to highlight and what she says there.

The job matcher's skill vocabulary is in `js/neura-skills.js` (`RAW_TAXONOMY`). It reads your
evidence straight from `projects`, `experience`, `skills` and `skillsAlso`, so adding a project
to `profile.js` automatically makes the matcher smarter — nothing else to update.

`skillsAlso` matters for honesty in both directions: a skill on your résumé but not in the
skill bars belongs there, or the matcher will call it a gap.

## Editing your content

**`js/profile.js` is the only file you need to touch.** Everything — hero, quick facts,
projects, skills, timeline, certifications, and the chatbot's knowledge base — generates
from it.

To teach the chatbot something new, add an entry to `EXTRA_KNOWLEDGE` at the bottom. Give it
good `tags` — they're indexed and searchable, which is how "how do I get in touch" finds the
contact note even though the word "touch" isn't in the prose.

### Still to confirm (marked `// TODO`)

1. `quickFacts.relocation` — I assumed open to relocation and remote.
2. `Multi-Agent AI Research Platform` has no repo link, so its buttons are hidden. Add one if
   the repo is public.

Any URL still holding a placeholder is **hidden rather than shipped broken** (see `safeLink()`
in `js/main.js`). The console lists what's missing. Fill it in and the button reappears.

### Phone number and résumé download: off on purpose

The site is public, and public pages get scraped by spam bots, so `phone` in `profile.js` is
blank and the résumé download is switched off (the PDF has the number on it). Nothing is
broken — every phone and résumé button checks its field first and simply isn't shown.

To bring the résumé back: export a version without your phone number, save it as
`assets/Ritesh_Kumar_Resume.pdf`, and set `links.resume` to that path. All the "Résumé"
buttons — nav, hero, contact, Neura's recruiter pitch, the job matcher — reappear.

## Live site

**https://ritesh469.github.io** — served by GitHub Pages from the `main` branch of
`ritesh469/ritesh469.github.io`. A `.nojekyll` file makes Pages serve the folder exactly as-is.

To update it, edit, check locally with `python serve.py`, then:

```bash
git add -A && git commit -m "Describe the change" && git push
```

It's live again about a minute after the push.

**Once it's live**, put the URL in three places — that's what actually gets it seen:
- your LinkedIn headline and the "Website" field
- the top of your résumé PDF, next to your email
- your GitHub profile README

## Optional: connect a real LLM

The assistant works fully offline. Click the gear icon in the chat header to paste a Groq or
OpenAI key; only the *generation* step swaps to a live model, retrieval is unchanged.

The key lives in the browser tab's memory only — never written to storage, never sent anywhere
except the provider you picked. **Do not hardcode a key into these files** — anything in
frontend JS is public and will be scraped.

## Layout

```
index.html              page structure
serve.py                local dev server with caching disabled
css/style.css           light editorial design system + character animations
js/profile.js           ← YOUR DATA. The only file you need to edit.
js/rag.js               retrieval: chunking, TF-IDF, cosine, reranking
js/ml.js                from-scratch MLP, k-means, regression, attention
js/agent.js             tool registry + plan/act/observe loop
js/avatar.js            the anime character SVG + expression state machine
js/neura-skills.js      Neura's skills: job matcher, tailored pitch, guided tour
js/chat.js              assistant, hero chat, retrieval inspector
js/playground.js        canvas demos and their controls
js/main.js              rendering, fibre-strand field, command palette
assets/                 (not present yet) a phone-free résumé PDF goes here
```

## Accessibility & performance

- ~265 KB total; one external request (Google Fonts)
- Everything respects `prefers-reduced-motion`
- Responsive down to 375px with no horizontal overflow
- Skip link, visible focus rings, `Ctrl/Cmd + K` command palette
