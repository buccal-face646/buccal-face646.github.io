/* ============================================================================
 * avatar.js - "Neura", the anime assistant character.
 *
 * Hand-drawn as inline SVG (no image files, so it stays crisp at any size and
 * themes with the rest of the site). A small state machine drives expression:
 *
 *   idle      slow blink, gentle float, pupils track the cursor
 *   thinking  eyes glance up, thought dots, lens glint, halo spins
 *   talking   mouth animates while the answer is written
 *   happy     eyes curve into a smile after a good answer
 *
 * The hero chat drives this from the real RAG pipeline, so "thinking" means
 * it genuinely is retrieving.
 * ==========================================================================*/

(function (global) {
  "use strict";

  function characterSVG(id) {
    return '' +
    '<svg class="anime-avatar state-idle" id="' + id + '" viewBox="0 0 220 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Anime avatar of Ritesh Kumar">' +
      '<defs>' +
        // hair: near-black with a warm brown sheen
        '<linearGradient id="hairG" x1="0.15" y1="0" x2="0.85" y2="1">' +
          '<stop offset="0%" stop-color="#3b2a20"/>' +
          '<stop offset="40%" stop-color="#221819"/>' +
          '<stop offset="100%" stop-color="#100b0e"/>' +
        '</linearGradient>' +
        '<linearGradient id="hairLit" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%"   stop-color="#f2c063" stop-opacity=".85"/>' +
          '<stop offset="55%"  stop-color="#d98a1e" stop-opacity=".4"/>' +
          '<stop offset="100%" stop-color="#d98a1e" stop-opacity="0"/>' +
        '</linearGradient>' +
        // warm medium-brown skin
        '<linearGradient id="skinG" x1="0.3" y1="0" x2="0.7" y2="1">' +
          '<stop offset="0%"   stop-color="#e2ab7f"/>' +
          '<stop offset="55%"  stop-color="#cb8d60"/>' +
          '<stop offset="100%" stop-color="#b3764c"/>' +
        '</linearGradient>' +
        // aviator lens: genuinely dark, cool reflection at the top
        '<linearGradient id="lensG" x1="0.25" y1="0" x2="0.55" y2="1">' +
          '<stop offset="0%"   stop-color="#5a4936" stop-opacity=".95"/>' +
          '<stop offset="22%"  stop-color="#1d1712"/>' +
          '<stop offset="100%" stop-color="#05070d"/>' +
        '</linearGradient>' +
        // brown tee, clearly darker than skin so the silhouette reads
        '<linearGradient id="teeG" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%"   stop-color="#563528"/>' +
          '<stop offset="100%" stop-color="#3a221a"/>' +
        '</linearGradient>' +
        '<radialGradient id="eyeGlowG" cx="50%" cy="42%" r="55%">' +
          '<stop offset="0%"   stop-color="#fff6dc"/>' +
          '<stop offset="55%"  stop-color="#f2c063"/>' +
          '<stop offset="100%" stop-color="#b46d14" stop-opacity=".3"/>' +
        '</radialGradient>' +
        '<filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">' +
          '<feGaussianBlur stdDeviation="5" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
        // lens outlines reused as clip paths so eyes and glints stay inside
        '<clipPath id="clipL"><path d="M74 98 C74 93 78 91 92 91 C104 91 109 93 109 98 C109 110 101 122 91 122 C80 122 74 110 74 98 Z"/></clipPath>' +
        '<clipPath id="clipR"><path d="M111 98 C111 93 116 91 128 91 C142 91 146 93 146 98 C146 110 140 122 129 122 C119 122 111 110 111 98 Z"/></clipPath>' +
      '</defs>' +

      // ---- halo ring (spins while thinking) ----
      '<g class="halo">' +
        '<ellipse cx="110" cy="112" rx="86" ry="26" fill="none" stroke="#9c5b0c" stroke-opacity=".32" stroke-width="1.5" stroke-dasharray="7 11"/>' +
      '</g>' +

      '<g class="bob">' +

        // ---- torso: brown tee ----
        '<path d="M42 250 C46 212 72 196 110 196 C148 196 174 212 178 250 Z" fill="url(#teeG)"/>' +
        '<path d="M99 164 L99 194 C104 201 116 201 121 194 L121 164 Z" fill="#a86e45"/>' +
        '<path d="M99 164 L121 164 L121 178 C115 185 105 185 99 178 Z" fill="#8e5b38"/>' +
        '<path d="M92 196 C99 207 121 207 128 196 L134 200 C124 214 96 214 86 200 Z" fill="#2e1a14"/>' +
        '<circle class="chest-led" cx="110" cy="224" r="3.6" fill="#f2c063"/>' +

        // ---- hair: back mass. Hairline sits high so a forehead exists. ----
        '<path d="M110 18 C150 16 172 42 173 82 C174 98 172 110 169 118 '
              + 'C168 92 162 72 152 58 C142 60 124 62 108 58 C96 55 86 58 80 66 '
              + 'C74 78 71 98 70 118 C66 108 64 90 66 74 C70 38 86 20 110 18 Z" fill="url(#hairG)"/>' +

        // ---- ears ----
        '<ellipse cx="73" cy="108" rx="7" ry="11" fill="#bd7f50"/>' +
        '<ellipse cx="147" cy="108" rx="7" ry="11" fill="#bd7f50"/>' +

        // ---- face: slim, angular anime jaw ----
        '<path d="M110 48 C136 48 146 68 146 96 C146 116 143 132 136 146 '
              + 'C130 160 120 172 110 176 C100 172 90 160 84 146 '
              + 'C77 132 74 116 74 96 C74 68 84 48 110 48 Z" fill="url(#skinG)"/>' +
        '<ellipse class="blush" cx="86" cy="128" rx="9" ry="4.5" fill="#b8553a" opacity=".22"/>' +
        '<ellipse class="blush" cx="134" cy="128" rx="9" ry="4.5" fill="#b8553a" opacity=".22"/>' +

        // ---- eyebrows: thick, visible between hairline and lenses ----
        '<path class="brow brow-l" d="M78 85 Q90 79 102 84" stroke="#181012" stroke-width="4.4" fill="none" stroke-linecap="round"/>' +
        '<path class="brow brow-r" d="M118 84 Q130 79 142 85" stroke="#181012" stroke-width="4.4" fill="none" stroke-linecap="round"/>' +

        // ---- eyes glowing behind the tinted lenses ----
        '<g class="eye eye-l"><g clip-path="url(#clipL)">' +
          '<g class="pupil">' +
            '<ellipse class="eye-core" cx="92" cy="106" rx="8" ry="7" fill="url(#eyeGlowG)"/>' +
            '<circle cx="88.5" cy="103" r="2.2" fill="#fffaf0" opacity=".95"/>' +
          '</g>' +
          '<path class="eye-smile" d="M83 108 Q92 99 101 108" stroke="#f2c063" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
        '</g></g>' +
        '<g class="eye eye-r"><g clip-path="url(#clipR)">' +
          '<g class="pupil">' +
            '<ellipse class="eye-core" cx="128" cy="106" rx="8" ry="7" fill="url(#eyeGlowG)"/>' +
            '<circle cx="124.5" cy="103" r="2.2" fill="#fffaf0" opacity=".95"/>' +
          '</g>' +
          '<path class="eye-smile" d="M119 108 Q128 99 137 108" stroke="#f2c063" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
        '</g></g>' +

        // ---- aviator sunglasses ----
        '<g class="shades">' +
          '<path d="M74 98 C74 93 78 91 92 91 C104 91 109 93 109 98 C109 110 101 122 91 122 C80 122 74 110 74 98 Z" fill="url(#lensG)"/>' +
          '<path d="M111 98 C111 93 116 91 128 91 C142 91 146 93 146 98 C146 110 140 122 129 122 C119 122 111 110 111 98 Z" fill="url(#lensG)"/>' +
          // the anime glasses-flash, swept across on "thinking"
          '<g clip-path="url(#clipL)"><rect class="glint" x="46" y="82" width="13" height="52" fill="#fff" transform="skewX(-20)"/></g>' +
          '<g clip-path="url(#clipR)"><rect class="glint glint-2" x="84" y="82" width="13" height="52" fill="#fff" transform="skewX(-20)"/></g>' +
          '<path d="M74 98 C74 93 78 91 92 91 C104 91 109 93 109 98 C109 110 101 122 91 122 C80 122 74 110 74 98 Z" fill="none" stroke="#b08a4a" stroke-width="1.9"/>' +
          '<path d="M111 98 C111 93 116 91 128 91 C142 91 146 93 146 98 C146 110 140 122 129 122 C119 122 111 110 111 98 Z" fill="none" stroke="#b08a4a" stroke-width="1.9"/>' +
          '<path d="M109 96 Q110 92 111 96" fill="none" stroke="#b08a4a" stroke-width="1.9"/>' +
          '<path d="M74 95 L68 98 M146 95 L152 98" stroke="#b08a4a" stroke-width="1.9" stroke-linecap="round"/>' +
        '</g>' +

        // ---- nose ----
        '<path d="M110 124 q3.5 7 -2 9.5" stroke="#9c6039" stroke-width="2" fill="none" stroke-linecap="round"/>' +

        // ---- beard: jawline only, cheeks left visible ----
        '<path d="M74 102 C75 122 79 138 86 150 C92 164 100 174 110 177 '
              + 'C120 174 128 164 134 150 C141 138 145 122 146 102 '
              + 'C144 124 138 138 130 146 C124 140 117 137 110 137 '
              + 'C103 137 96 140 90 146 C82 138 76 124 74 102 Z" fill="#1b1315"/>' +
        '<path d="M74 88 C72 102 73 116 76 126 C71 118 69 102 70 88 Z" fill="#1b1315"/>' +
        '<path d="M146 88 C148 102 147 116 144 126 C149 118 151 102 150 88 Z" fill="#1b1315"/>' +
        '<path d="M102 154 C105 150 115 150 118 154 C116 164 104 164 102 154 Z" fill="#1b1315"/>' +

        // ---- mouth (drawn before the moustache so the tache overlaps) ----
        '<path class="mouth-idle" d="M103 150 Q110 155 117 150" stroke="#7a3f30" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<ellipse class="mouth-talk" cx="110" cy="151" rx="6" ry="4.2" fill="#5a2c26"/>' +

        // ---- moustache ----
        '<path d="M96 141 C102 136 107 138 110 141 C113 138 118 136 124 141 '
              + 'C118 145 113 146 110 146 C107 146 102 145 96 141 Z" fill="#1b1315"/>' +

        // ---- hair: front quiff, swept UP off the face ----
        '<path d="M110 18 C86 20 70 38 66 76 C68 60 74 48 82 42 '
              + 'C84 52 88 58 94 61 C90 48 93 36 101 29 '
              + 'C104 40 110 48 119 52 C114 40 118 28 127 21 '
              + 'C132 32 141 40 152 45 C149 36 151 28 157 25 '
              + 'C165 36 172 54 173 82 C174 42 150 16 110 18 Z" fill="url(#hairG)"/>' +
        // spiky tufts rising above the crown
        '<path d="M84 40 C88 24 100 12 116 8 C107 19 100 31 98 44 Z" fill="#271b1d"/>' +
        '<path d="M112 22 C124 10 141 6 153 12 C141 17 131 26 125 37 Z" fill="#271b1d"/>' +
        '<path d="M139 22 C150 18 161 26 166 38 C157 31 148 30 140 35 Z" fill="#271b1d"/>' +
        // sheen following the sweep of the quiff
        '<path d="M86 46 C98 30 118 21 141 26" stroke="url(#hairLit)" stroke-width="7" fill="none" stroke-linecap="round" opacity=".75"/>' +

        // ---- thinking dots ----
        '<g class="think-dots" filter="url(#softGlow)">' +
          '<circle cx="174" cy="56" r="4" fill="#f2c063"/>' +
          '<circle cx="188" cy="44" r="5.5" fill="#d98a1e"/>' +
          '<circle cx="203" cy="30" r="7" fill="#9c5b0c"/>' +
        '</g>' +
      '</g>' +
    '</svg>';
  }

  /* -- State machine ------------------------------------------------------ */

  const STATES = ["idle", "thinking", "talking", "happy"];
  let mounted = [];
  let currentState = "idle";
  let happyTimer = null;

  function setState(state) {
    if (STATES.indexOf(state) < 0) return;
    currentState = state;
    mounted.forEach(function (svg) {
      STATES.forEach(function (s) { svg.classList.remove("state-" + s); });
      svg.classList.add("state-" + state);
    });
  }

  // Pupils follow the cursor. Kept subtle - a couple of pixels reads as
  // "alive"; more looks unsettling.
  function trackCursor() {
    if (global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    global.addEventListener("mousemove", function (e) {
      mounted.forEach(function (svg) {
        const r = svg.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.45;
        const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (global.innerWidth / 2)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (global.innerHeight / 2)));
        // Written as custom properties, not a direct transform, so the
        // per-state eye offsets in CSS compose with the gaze rather than
        // being clobbered by an inline style.
        svg.style.setProperty("--px", (dx * 3.4).toFixed(2) + "px");
        svg.style.setProperty("--py", (dy * 2.6).toFixed(2) + "px");
      });
    }, { passive: true });
  }

  function mount(container, opts) {
    if (!container) return null;
    opts = opts || {};
    const id = "avatar-" + Math.random().toString(36).slice(2, 8);
    // Neura now appears four times (hero, chat header, matcher, tour). Every
    // copy defining the same gradient and clip-path ids means url(#hairG)
    // resolves to whichever copy is first in the document - and if that one is
    // ever display:none, the others lose their fills. Suffix ids per instance.
    container.innerHTML = characterSVG(id).replace(
      /(id="|url\(#)(hairG|hairLit|skinG|lensG|teeG|eyeGlowG|softGlow|clipL|clipR)\b/g,
      "$1$2-" + id
    );
    const svg = container.querySelector("svg");
    mounted.push(svg);
    svg.classList.add("state-" + currentState);
    if (opts.compact) svg.classList.add("compact");
    return svg;
  }

  global.AVATAR = {
    mount: mount,
    setState: setState,
    get state() { return currentState; },
    celebrate: function (ms) {
      setState("happy");
      clearTimeout(happyTimer);
      happyTimer = setTimeout(function () { setState("idle"); }, ms || 2200);
    },
    svg: characterSVG
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackCursor);
  } else {
    trackCursor();
  }
})(window);
