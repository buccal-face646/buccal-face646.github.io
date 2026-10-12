/* ============================================================================
 * agent.js - A tool-calling agent with an explicit plan / act / observe loop.
 *
 * The ReAct pattern, implemented honestly. The agent:
 *   1. decomposes a goal into sub-tasks
 *   2. selects a tool per sub-task from a registry with JSON schemas
 *      (the same shape you'd hand an LLM for function calling)
 *   3. executes the tool and observes the result
 *   4. feeds observations forward, then synthesises a final answer
 *
 * Because it can only report what a tool returned, it cannot hallucinate.
 * The loop, the registry and the observation plumbing are what matter:
 * an agent is its tools and its loop, not its model.
 * ==========================================================================*/

(function (global) {
  "use strict";

  /* -- Tool registry ------------------------------------------------------
   * Each tool carries a JSON-schema description, exactly as it would be sent
   * to an LLM in a function-calling request.
   * --------------------------------------------------------------------- */

  const TOOLS = {
    search_knowledge: {
      description: "Search the portfolio knowledge base for information about background, philosophy, or approach. Use for open-ended questions.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query" } },
        required: ["query"]
      },
      run: function (args) {
        const r = global.RAG.query(args.query, { topK: 6, finalN: 3 });
        if (!r.context.length) return { found: false, message: "No relevant passages above the score threshold." };
        return {
          found: true,
          passages: r.context.map(function (c) {
            return { source: c.doc.source, title: c.doc.title, text: c.doc.text, score: +c.rerankScore.toFixed(3) };
          }),
          corpusSearched: r.stats.corpusSize
        };
      }
    },

    list_projects: {
      description: "List portfolio projects, optionally filtered by a technology or keyword.",
      parameters: {
        type: "object",
        properties: { tech: { type: "string", description: "Optional technology filter, e.g. 'langgraph', 'rag'" } },
        required: []
      },
      run: function (args) {
        const tech = (args.tech || "").toLowerCase().trim();
        let list = global.PROFILE.projects;
        if (tech) {
          list = list.filter(function (p) {
            return (p.stack.join(" ") + " " + p.name + " " + p.blurb).toLowerCase().includes(tech);
          });
        }
        return {
          count: list.length,
          filter: tech || "none",
          projects: list.map(function (p) {
            return {
              name: p.name, year: p.year, status: p.status, stack: p.stack,
              summary: p.blurb, live: p.links.demo || null
            };
          })
        };
      }
    },

    get_project_details: {
      description: "Get the full technical breakdown of one named project, including implementation highlights and measured results.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Project name or partial name" } },
        required: ["name"]
      },
      run: function (args) {
        const q = (args.name || "").toLowerCase();
        const p = global.PROFILE.projects.find(function (pr) {
          return pr.name.toLowerCase().includes(q) || q.includes(pr.name.toLowerCase().split(" ")[0]);
        });
        if (!p) return { found: false, available: global.PROFILE.projects.map(function (x) { return x.name; }) };
        return {
          found: true, name: p.name, year: p.year, status: p.status,
          summary: p.blurb, highlights: p.highlights, stack: p.stack,
          live: p.links.demo || null, repo: p.links.github || null
        };
      }
    },

    get_skills: {
      description: "Return skill proficiencies, optionally for one category or a single named skill.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Optional skill category" },
          skill: { type: "string", description: "Optional: a single skill name to look up" }
        },
        required: []
      },
      run: function (args) {
        const groups = global.PROFILE.skills;
        if (args.skill) {
          const q = args.skill.toLowerCase();
          const hits = [];
          groups.forEach(function (g) {
            g.items.forEach(function (it) {
              if (it.name.toLowerCase().includes(q)) {
                hits.push({ skill: it.name, level: it.level, category: g.category });
              }
            });
          });
          return hits.length ? { found: true, matches: hits } : { found: false, query: args.skill };
        }
        const filtered = args.category
          ? groups.filter(function (g) { return g.category.toLowerCase().includes(args.category.toLowerCase()); })
          : groups;
        return {
          found: true,
          categories: filtered.map(function (g) {
            return {
              category: g.category,
              skills: g.items.map(function (i) { return i.name + " (" + i.level + "/100)"; })
            };
          })
        };
      }
    },

    get_contact: {
      description: "Return contact details and current availability status.",
      parameters: { type: "object", properties: {}, required: [] },
      run: function () {
        const p = global.PROFILE;
        return {
          name: p.name, email: p.email, phone: p.phone, location: p.location,
          github: p.links.github, linkedin: p.links.linkedin,
          available: p.available, availability: p.availableText
        };
      }
    },

    calculate: {
      description: "Evaluate an arithmetic expression. Use for any numeric computation.",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "e.g. '(0.84 - 0.46) / 0.46 * 100'" } },
        required: ["expression"]
      },
      run: function (args) {
        const expr = String(args.expression || "");
        // whitelist: digits, operators, parens, dot, space. No identifiers, so
        // there's nothing here for an injected string to reach.
        if (!/^[\d+\-*/(). %]+$/.test(expr)) {
          return { error: "Expression rejected: only numbers and + - * / ( ) % are allowed." };
        }
        try {
          const value = Function('"use strict";return (' + expr + ")")();
          if (typeof value !== "number" || !isFinite(value)) return { error: "Not a finite number." };
          return { expression: expr, result: Math.round(value * 10000) / 10000 };
        } catch (e) {
          return { error: "Could not evaluate: " + e.message };
        }
      }
    }
  };

  /* -- Local planner ------------------------------------------------------ */

  function decompose(goal) {
    // Each branch matches its own whitespace. A leading \s+ would swallow the
    // space that " and " then expects, and nothing would ever split.
    const parts = String(goal)
      .split(/(?:,\s*and\s+|\s+and\s+(?:also\s+|then\s+)?|\s*;\s*|\?\s+)/i)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 8; });

    return parts.length > 1 ? parts.slice(0, 3) : [String(goal).trim()];
  }

  // People write arithmetic in words. Normalise before extracting, or
  // "0.84 minus 0.46 divided by 0.46" silently truncates and returns a
  // confidently wrong number.
  function normaliseArithmetic(q) {
    return q
      .replace(/\bdivided by\b|\bover\b/g, "/")
      .replace(/\bmultiplied by\b|\btimes\b/g, "*")
      .replace(/\bplus\b|\badded to\b/g, "+")
      .replace(/\bminus\b|\bsubtract\b/g, "-")
      .replace(/\bpercent of\b/g, "% *");
  }

  function selectTool(subGoal) {
    const q = subGoal.toLowerCase();

    const arith = normaliseArithmetic(q);
    if (/\d\s*[+\-*/]\s*\d/.test(arith) ||
        /\b(calculate|compute|what is \d|how much is)\b/.test(q)) {
      const m = arith.match(/[\d.]+(?:\s*[+\-*/()%]\s*[\d.]+)+/);
      if (m) return { tool: "calculate", args: { expression: m[0].trim() },
                      why: "The sub-goal contains an arithmetic expression, so a calculator is more reliable than reasoning about it in text." };
    }
    if (/\b(email|contact|reach|hire|available|availability|linkedin|github|touch|connect)\b/.test(q)) {
      return { tool: "get_contact", args: {},
               why: "This asks for contact or availability, which is a direct structured lookup." };
    }
    if (/\b(detail|architecture|how did|how does|deep|technical|implement|built|result|metric)\b/.test(q) &&
        /\b(rag|project|system|sahakar|returnguard|governance|research|portfolio)\b/.test(q)) {
      const name = /sahakar|multilingual|hindi|marathi/.test(q) ? "Sahakar"
                 : /return|refund|ecommerce|e-commerce/.test(q) ? "ReturnGuard"
                 : /governance|opa|keycloak|spiffe/.test(q) ? "AI Governance"
                 : /research|bedrock|tensorzero/.test(q) ? "Multi-Agent AI Research"
                 : "Sahakar";
      return { tool: "get_project_details", args: { name: name },
               why: "The sub-goal asks for implementation depth on a specific project, so fetch its full technical record." };
    }
    if (/\b(project|projects|built|build|portfolio|work on|shipped)\b/.test(q)) {
      let tech = "";
      ["langgraph", "rag", "qdrant", "fastapi", "docker", "nextjs", "next.js", "aws", "opa"]
        .forEach(function (t) { if (q.includes(t)) tech = t; });
      return { tool: "list_projects", args: tech ? { tech: tech } : {},
               why: tech ? "Asks about projects using " + tech + ", so filter the project list by that technology."
                         : "Asks about projects generally, so enumerate them." };
    }
    if (/\b(skill|skills|know|proficient|good at|experience with|stack|tech|tools|rate)\b/.test(q)) {
      const known = ["python", "pytorch", "docker", "fastapi", "sql", "qdrant", "langgraph", "rag", "terraform"];
      const hit = known.find(function (k) { return q.includes(k); });
      return { tool: "get_skills", args: hit ? { skill: hit } : {},
               why: hit ? "Names a specific technology, so look up that skill directly."
                        : "Asks about capability generally, so return the full skill matrix." };
    }
    return { tool: "search_knowledge", args: { query: subGoal },
             why: "Open-ended question, so run semantic retrieval over the knowledge base." };
  }

  /* -- Answer synthesis --------------------------------------------------- */

  function synthesise(goal, steps) {
    const obs = steps.filter(function (s) { return s.type === "observation"; });
    const lines = [];

    obs.forEach(function (o) {
      const r = o.result;
      if (!r) return;

      if (r.passages) {
        r.passages.forEach(function (p) { lines.push(p.text); });
      } else if (r.projects) {
        if (!r.projects.length) {
          lines.push("No projects matched that filter.");
        } else {
          lines.push(
            "Found " + r.count + " project" + (r.count === 1 ? "" : "s") +
            (r.filter !== "none" ? " matching \"" + r.filter + "\"" : "") + ": " +
            r.projects.map(function (p) { return p.name + " (" + p.year + ")"; }).join(", ") + "."
          );
          r.projects.slice(0, 2).forEach(function (p) {
            lines.push(p.name + " — " + p.summary + (p.live ? " Live at " + p.live : ""));
          });
        }
      } else if (r.highlights) {
        lines.push(r.name + " (" + r.year + ", " + r.status + "). " + r.summary);
        lines.push("Key points: " + r.highlights.slice(0, 3).join("; ") + ".");
        lines.push("Stack: " + r.stack.join(", ") + (r.live ? ". Live at " + r.live : "") + ".");
      } else if (r.matches) {
        lines.push(r.matches.map(function (m) {
          return m.skill + " sits at " + m.level + "/100 under " + m.category;
        }).join(". ") + ".");
      } else if (r.categories) {
        r.categories.forEach(function (c) { lines.push(c.category + ": " + c.skills.join(", ") + "."); });
      } else if (r.email) {
        lines.push("Reach " + r.name + " at " + r.email + (r.phone ? " or " + r.phone : "") + " (" + r.location + "). " +
                   (r.available ? r.availability + "." : ""));
      } else if (r.result !== undefined) {
        lines.push(r.expression + " = " + r.result);
      } else if (r.error) {
        lines.push("Tool error: " + r.error);
      } else if (r.found === false) {
        lines.push(r.message || "That lookup returned nothing.");
      }
    });

    if (!lines.length) {
      return "I ran the tools but they came back empty. Try rephrasing, or ask about projects, skills, the RAG work, or how to get in touch.";
    }
    return lines.join("\n\n");
  }

  /* -- The loop ----------------------------------------------------------- */

  function Agent(opts) {
    opts = opts || {};
    this.maxSteps = opts.maxSteps || 4;
    this.tools = TOOLS;
  }

  Agent.prototype.run = async function (goal, onStep) {
    const steps = [];
    const emit = async function (step) {
      steps.push(step);
      if (onStep) await onStep(step);
    };

    await emit({ type: "plan", text: "Decomposing the request and choosing tools.", detail: null });

    const subGoals = decompose(goal);

    await emit({
      type: "thought",
      text: subGoals.length > 1
        ? "This has " + subGoals.length + " parts. I'll handle each with its own tool call, then combine the results."
        : "Single-part request. One tool call should be enough.",
      detail: subGoals.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n")
    });

    for (let i = 0; i < Math.min(subGoals.length, this.maxSteps); i++) {
      const sub = subGoals[i];
      const choice = selectTool(sub);

      await emit({ type: "thought", text: choice.why, detail: "Sub-goal: " + sub });

      await emit({
        type: "action", text: choice.tool,
        detail: JSON.stringify(choice.args, null, 2),
        tool: choice.tool, args: choice.args
      });

      let result;
      try { result = this.tools[choice.tool].run(choice.args); }
      catch (e) { result = { error: e.message }; }

      await emit({
        type: "observation", text: summariseResult(result),
        detail: JSON.stringify(result, null, 2),
        result: result, tool: choice.tool
      });
    }

    const answer = synthesise(goal, steps);
    await emit({ type: "answer", text: answer, detail: null });
    return { steps: steps, answer: answer };
  };

  function summariseResult(r) {
    if (!r) return "empty";
    if (r.error) return "error: " + r.error;
    if (r.passages) return "retrieved " + r.passages.length + " passage(s), top score " + r.passages[0].score;
    if (r.projects) return "returned " + r.count + " project(s)";
    if (r.highlights) return "loaded " + r.highlights.length + " implementation highlights for " + r.name;
    if (r.matches) return "matched " + r.matches.length + " skill(s)";
    if (r.categories) return "returned " + r.categories.length + " skill categor(ies)";
    if (r.email) return "returned contact record";
    if (r.result !== undefined) return "computed " + r.result;
    if (r.found === false) return "no match";
    return "ok";
  }

  // Tool schemas in the exact shape an LLM function-calling API expects.
  function toolSchemas() {
    return Object.keys(TOOLS).map(function (name) {
      return { name: name, description: TOOLS[name].description, input_schema: TOOLS[name].parameters };
    });
  }

  global.AGENT = {
    Agent: Agent, TOOLS: TOOLS, toolSchemas: toolSchemas,
    decompose: decompose, selectTool: selectTool,
    runTool: function (name, args) {
      if (!TOOLS[name]) return { error: "Unknown tool: " + name };
      try { return TOOLS[name].run(args || {}); }
      catch (e) { return { error: e.message }; }
    }
  };
})(window);
