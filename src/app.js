import { createRng, pick, sample } from "./random-core.js";
import { CATEGORIES, TOOLS, getTool, searchTools } from "./registry.js";
import { executeTool } from "./tool-engine.js";
import {
  normalizeSelection,
  reconcileSelectionEntries,
  selectionRuleSummary,
  percentage
} from "./selection-model.js";
import {
  getAll,
  put,
  remove,
  clear,
  getSettings,
  saveSettings,
  requestPersistentStorage
} from "./storage.js";

const root = document.getElementById("app");
const announcer = document.getElementById("announcer");

const state = {
  view: "play",
  toolId: null,
  pools: [],
  history: [],
  favorites: [],
  settings: null,
  search: "",
  modal: null,
  tool: {},
  studioResult: null
};

const palette = [
  "#7c5cff", "#2ee5ff", "#ffca3a", "#ff5577",
  "#40e38b", "#4d8dff", "#ff63c3", "#ff923e"
];

const selectionTools = new Set(["wheel", "picker", "sampler"]);

function node(tag, options, children) {
  const element = document.createElement(tag);
  const opts = options || {};

  for (const [key, value] of Object.entries(opts)) {
    if (value == null) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "dataset") Object.assign(element.dataset, value);
    else if (key === "style") Object.assign(element.style, value);
    else if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "checked") {
      element.checked = Boolean(value);
    } else if (key === "value") {
      element.value = value;
    } else {
      element.setAttribute(key, value);
    }
  }

  const list = Array.isArray(children)
    ? children
    : children == null
      ? []
      : [children];

  for (const child of list) {
    if (child == null) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

function iconButton(label, glyph, handler, extraClass = "") {
  return node("button", {
    class: "icon-button " + extraClass,
    type: "button",
    "aria-label": label,
    title: label,
    onClick: handler
  }, glyph);
}

function announce(message) {
  announcer.textContent = "";
  window.setTimeout(() => {
    announcer.textContent = message;
  }, 20);
}

function parseList(text) {
  return String(text || "")
    .split(/\r?\n|;/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function defaultList(toolId) {
  const lists = {
    wheel: ["Pizza", "Sushi", "Korean", "Burgers", "Indian", "Tacos"],
    picker: ["Anna", "Ben", "David", "Sarah"],
    sampler: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    shuffle: ["Anna", "Ben", "David", "Sarah", "Luke"],
    teams: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"],
    groups: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"],
    pairs: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    assignment: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    elimination: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    ladder: ["Anna", "Ben", "David", "Sarah"],
    "secret-santa": ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    tournament: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"]
  };
  return (lists[toolId] || ["Option A", "Option B", "Option C"]).join("\n");
}

function ensureToolState(toolId) {
  if (!state.tool[toolId]) {
    state.tool[toolId] = {
      listText: defaultList(toolId),
      result: null,
      error: null,
      animating: false,
      wheelRotation: 0,
      previousWheelRotation: 0,
      pendingWheelRotation: null,

      diceCount: 2,
      diceSides: 6,

      numberMin: 1,
      numberMax: 100,

      teamCount: 2,
      groupCount: 3,
      sampleCount: 3,
      selectionEntries: [],
      allowRepeats: false,
      selectionOpen: false,
      fairnessOpen: false,

      targetText: "Setup\nCleanup\nSnacks",
      ladderOutcomes: "Prize A\nPrize B\nPrize C\nPrize D",
      ladder: null,

      chance: 50,

      lotteryCount: 6,
      lotteryMax: 49,

      timeStart: "09:00",
      timeEnd: "17:00",

      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 10,

      eliminationRemaining: null,
      eliminationOut: [],
      eliminationSignature: "",

      secretAssignments: null,
      secretReveal: null,

      dateStart: new Date().toISOString().slice(0, 10),
      dateEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),

      deck: null
    };
  }
  return state.tool[toolId];
}

function syncSelectionState(toolId, toolState) {
  if (!selectionTools.has(toolId)) return null;
  const items = parseList(toolState.listText);
  toolState.selectionEntries = reconcileSelectionEntries(
    items,
    toolState.selectionEntries || []
  );
  return normalizeSelection(items, toolState.selectionEntries);
}

function currentSelectionModel(toolId, toolState) {
  if (!selectionTools.has(toolId)) return null;
  try {
    return syncSelectionState(toolId, toolState);
  } catch {
    return null;
  }
}

function invalidateTool(toolId, toolState, resetSession = false) {
  toolState.result = null;
  toolState.error = null;
  toolState.animating = false;
  toolState.pendingWheelRotation = null;

  if (toolId === "ladder") toolState.ladder = null;

  if (toolId === "elimination") {
    toolState.eliminationRemaining = null;
    toolState.eliminationOut = [];
    toolState.eliminationSignature = "";
  }

  if (toolId === "secret-santa") {
    toolState.secretAssignments = null;
    toolState.secretReveal = null;
  }

  if (resetSession && toolId === "cards") {
    toolState.deck = null;
  }
}

function prepareRandomSource() {
  if (state.settings.randomness.mode !== "seeded") {
    return {
      source: createRng({ mode: "secure" }),
      commit: async () => {}
    };
  }

  const position = Number.isSafeInteger(state.settings.randomness.position)
    ? state.settings.randomness.position
    : 0;

  const source = createRng({
    mode: "seeded",
    seed: (state.settings.randomness.seed || "ARCADE-2026") + "::" + position
  });

  return {
    source,
    commit: async () => {
      state.settings.randomness.position = position + 1;
      await saveSettings(state.settings);
    }
  };
}

async function loadData() {
  const [pools, historyEntries, favorites, settings] = await Promise.all([
    getAll("pools"),
    getAll("history"),
    getAll("favorites"),
    getSettings()
  ]);

  state.pools = pools.sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || "")
  );
  state.history = historyEntries
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 500);
  state.favorites = favorites.map((entry) => entry.id);
  state.settings = settings;
}

async function record(tool, summary, detail = null) {
  const entry = {
    id: crypto.randomUUID(),
    toolId: tool.id,
    toolName: tool.name,
    icon: tool.icon,
    resultSummary: summary,
    detail,
    timestamp: Date.now()
  };
  await put("history", entry);
  state.history.unshift(entry);
  state.history = state.history.slice(0, 500);
  return entry;
}

function setView(view) {
  state.view = view;
  state.toolId = null;
  state.modal = null;
  history.replaceState({}, "", location.pathname);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTool(id) {
  const tool = getTool(id);
  if (!tool) return;
  state.view = "tool";
  state.toolId = id;
  state.modal = null;
  ensureToolState(id);
  history.replaceState({}, "", location.pathname + "?tool=" + encodeURIComponent(id));
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeTool() {
  setView("play");
}

async function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((value) => value !== id);
    await remove("favorites", id);
  } else {
    state.favorites.push(id);
    await put("favorites", { id, createdAt: Date.now() });
  }
  render();
}

function toolCard(tool) {
  return node("button", {
    class: "tool-card accent-" + tool.accent,
    type: "button",
    onClick: () => openTool(tool.id)
  }, [
    node("span", { class: "tool-icon", text: tool.icon, "aria-hidden": "true" }),
    node("strong", { text: tool.name }),
    node("small", { text: tool.blurb })
  ]);
}

function topBar() {
  const seeded = state.settings.randomness.mode === "seeded";
  return node("header", { class: "topbar" }, [
    node("div", { class: "brand" }, [
      node("div", {
        class: "brand-icon",
        text: "✦",
        "aria-hidden": "true"
      }),
      node("div", { class: "brand-copy" }, [
        node("strong", { text: "Randomizer" }),
        node("span", { text: "Arcade" })
      ])
    ]),
    node("div", { class: "top-actions" }, [
      node("button", {
        class: "pill-button",
        type: "button",
        onClick: () => {
          state.modal = "settings";
          render();
        }
      }, [
        node("span", { class: "rng-dot", "aria-hidden": "true" }),
        node("span", { text: seeded ? "Seeded" : "Secure" })
      ]),
      iconButton("Open Arcade", "◫", () => setView("arcade"))
    ])
  ]);
}

function bottomNav() {
  const items = [
    ["play", "▶", "Play"],
    ["arcade", "◫", "Arcade"],
    ["studio", "◆", "Studio"],
    ["pools", "◎", "Pools"],
    ["history", "↶", "History"]
  ];

  return node("nav", {
    class: "bottom-nav",
    "aria-label": "Primary navigation"
  }, items.map(([id, glyph, label]) => node("button", {
    class: "nav-button " + (state.view === id ? "active" : ""),
    type: "button",
    "aria-current": state.view === id ? "page" : null,
    onClick: () => setView(id)
  }, [
    node("span", { text: glyph, "aria-hidden": "true" }),
    label
  ])));
}

function sectionHeader(title, note = "") {
  return node("div", { class: "section-head section" }, [
    node("h2", { text: title }),
    node("p", { text: note })
  ]);
}

function emptyState(title, copy, actionLabel, action) {
  const box = node("div", { class: "empty" }, [
    node("strong", { text: title }),
    node("span", { text: copy })
  ]);

  if (actionLabel && action) {
    box.append(node("div", {
      style: { marginTop: "16px" }
    }, node("button", {
      class: "secondary",
      type: "button",
      onClick: action
    }, actionLabel)));
  }

  return box;
}

function quickButton(glyph, label, id) {
  return node("button", {
    class: "quick-button",
    type: "button",
    onClick: () => openTool(id)
  }, [
    node("span", { text: glyph, "aria-hidden": "true" }),
    label
  ]);
}

function renderPlay() {
  const content = node("main", { class: "content" });

  const hero = node("section", { class: "hero" }, [
    node("div", { class: "kicker", text: "Arcade of randomness" }),
    node("h1", { text: "Pick. Roll. Shuffle. Decide." }),
    node("p", {
      text: "One vibrant toolbox for quick chance, people, games, generators, and everyday decisions."
    })
  ]);

  const searchWrap = node("label", { class: "search-box" }, [
    node("span", { text: "⌕", "aria-hidden": "true" }),
    node("span", { class: "sr-only", text: "Search randomizers" })
  ]);

  const search = node("input", {
    type: "search",
    value: state.search,
    placeholder: "Try “teams”, “d20”, “dinner”, “lottery”…",
    onInput: (event) => {
      state.search = event.target.value;
      render();
      const next = document.querySelector(".search-box input");
      if (next) {
        next.focus();
        next.setSelectionRange(state.search.length, state.search.length);
      }
    }
  });

  searchWrap.append(search);
  hero.append(searchWrap);

  if (!state.search.trim()) {
    hero.append(node("div", { class: "quick-grid" }, [
      quickButton("◐", "Coin", "coin"),
      quickButton("⬡", "Dice", "dice"),
      quickButton("◉", "Wheel", "wheel"),
      quickButton("#", "Number", "number")
    ]));
  }

  content.append(hero);

  if (state.search.trim()) {
    const results = searchTools(state.search);
    content.append(sectionHeader("Search results", results.length + " found"));
    content.append(
      results.length
        ? node("div", { class: "tool-grid" }, results.map(toolCard))
        : emptyState("No randomizer found", "Try a broader word or browse the Arcade.")
    );
    return content;
  }

  const favorites = TOOLS.filter((tool) => state.favorites.includes(tool.id));
  if (favorites.length) {
    content.append(sectionHeader("Favorites", "Your shortcuts"));
    content.append(node("div", { class: "tool-grid" }, favorites.map(toolCard)));
  }

  const popular = [
    "coin", "dice", "wheel", "picker",
    "teams", "elimination", "cards", "tournament"
  ].map(getTool).filter(Boolean);

  content.append(sectionHeader("Ready to play", "Fast, useful, no setup"));
  content.append(node("div", { class: "tool-grid" }, popular.map(toolCard)));
  return content;
}

function renderArcade() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Arcade" }),
    node("p", {
      class: "view-subtitle",
      text: TOOLS.length + " randomizers, organized by what you are trying to do."
    })
  ]);

  for (const category of CATEGORIES) {
    const tools = TOOLS.filter((tool) => tool.category === category.id);
    if (!tools.length) continue;
    content.append(sectionHeader(category.icon + "  " + category.name, tools.length + " tools"));
    content.append(node("div", { class: "tool-grid" }, tools.map(toolCard)));
  }

  return content;
}

function renderPools() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Pools" }),
    node("p", {
      class: "view-subtitle",
      text: "Save a list once, then reuse it across compatible randomizers."
    }),
    node("div", { class: "button-row" }, [
      node("button", {
        class: "primary",
        type: "button",
        onClick: () => {
          state.modal = "pool";
          render();
        }
      }, "+ New Pool")
    ])
  ]);

  content.append(sectionHeader("Saved pools", state.pools.length + " total"));

  if (!state.pools.length) {
    content.append(emptyState(
      "No saved Pools yet",
      "Paste a list once and reuse it across Wheel, Teams, Pairing, Secret Santa, and more.",
      "Create Pool",
      () => {
        state.modal = "pool";
        render();
      }
    ));
    return content;
  }

  const list = node("div", { class: "pool-list" });

  for (const pool of state.pools) {
    list.append(node("div", { class: "pool-item" }, [
      node("div", { class: "pool-icon", text: pool.icon || "◎" }),
      node("div", { class: "pool-copy" }, [
        node("strong", { text: pool.name }),
        node("span", { text: pool.items.length + " items" })
      ]),
      iconButton("Use " + pool.name, "▶", () => {
        state.modal = { type: "use-pool", poolId: pool.id };
        render();
      }),
      iconButton("Delete " + pool.name, "×", async () => {
        if (!confirm("Delete “" + pool.name + "”? Historical results remain intact.")) return;
        await remove("pools", pool.id);
        state.pools = state.pools.filter((item) => item.id !== pool.id);
        render();
      })
    ]));
  }

  content.append(list);
  return content;
}

function renderHistory() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "History" }),
    node("p", {
      class: "view-subtitle",
      text: "Recent committed random results stored locally on this device."
    })
  ]);

  if (state.history.length) {
    content.append(node("div", {
      class: "button-row",
      style: { marginBottom: "16px" }
    }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: async () => {
          if (!confirm("Clear local result history? Saved Pools and favorites will stay.")) return;
          await clear("history");
          state.history = [];
          render();
        }
      }, "Clear history")
    ]));
  }

  if (!state.history.length) {
    content.append(emptyState(
      "Nothing here yet",
      "Run a randomizer and its committed result will appear here."
    ));
    return content;
  }

  const list = node("div", { class: "history-list" });
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });

  for (const item of state.history) {
    list.append(node("button", {
      class: "history-item",
      type: "button",
      style: {
        textAlign: "left",
        color: "inherit",
        cursor: "pointer"
      },
      onClick: () => {
        if (item.toolId === "studio") setView("studio");
        else openTool(item.toolId);
      }
    }, [
      node("div", { class: "history-icon", text: item.icon || "✦" }),
      node("div", { class: "history-copy" }, [
        node("strong", {
          text: item.toolName + " → " + item.resultSummary
        }),
        node("span", {
          text: formatter.format(new Date(item.timestamp))
        })
      ])
    ]));
  }

  content.append(list);
  return content;
}

function studioNode(index, title, copy) {
  return node("div", { class: "studio-node" }, [
    node("strong", { text: index + ". " + title }),
    node("span", { text: copy })
  ]);
}

function renderStudio() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Decision Studio" }),
    node("p", {
      class: "view-subtitle",
      text: "A small working pipeline today: sample finalists, then make a final pick. The full graph Studio comes in a later implementation phase."
    })
  ]);

  const panel = node("div", { class: "controls" });
  const input = node("textarea", {
    class: "field",
    id: "studio-input",
    "aria-label": "Decision options"
  });
  input.value = state.tool.studioText
    || "Pizza\nSushi\nKorean\nBurgers\nIndian\nTacos";
  input.addEventListener("input", () => {
    state.tool.studioText = input.value;
  });

  const finalist = node("input", {
    class: "field",
    id: "studio-count",
    type: "number",
    min: "2",
    value: String(state.tool.studioCount || 3),
    "aria-label": "Number of finalists"
  });
  finalist.addEventListener("input", () => {
    state.tool.studioCount = Number(finalist.value);
  });

  panel.append(
    node("div", { class: "control" }, [
      node("label", { for: "studio-input", text: "Options" }),
      input
    ]),
    node("div", {
      class: "control",
      style: { marginTop: "10px" }
    }, [
      node("label", { for: "studio-count", text: "Finalists" }),
      finalist
    ]),
    node("button", {
      class: "primary action-button",
      type: "button",
      style: { marginTop: "12px" },
      onClick: runStudio
    }, "RUN DECISION")
  );

  const flow = node("div", { class: "studio-flow" }, [
    studioNode("1", "Input Pool", "Your options"),
    studioNode("2", "Sample Finalists", "Unique random sample"),
    studioNode("3", "Final Pick", "One winner from the finalists")
  ]);

  content.append(panel, flow);

  if (state.studioResult) {
    content.append(sectionHeader("Result", "Committed pipeline result"));
    content.append(node("div", {
      class: "tool-stage accent-purple"
    }, node("div", { class: "stage-content" }, [
      node("div", { class: "stage-label", text: "Finalists" }),
      resultList(state.studioResult.finalists),
      node("div", {
        class: "stage-label",
        style: { marginTop: "24px" },
        text: "Final decision"
      }),
      node("div", {
        class: "stage-result",
        text: state.studioResult.winner
      })
    ])));
  }

  return content;
}

async function runStudio() {
  const items = parseList(document.getElementById("studio-input").value);
  const count = Number(document.getElementById("studio-count").value);

  if (items.length < 2 || !Number.isSafeInteger(count) || count < 2 || count > items.length) {
    announce("Decision Studio needs at least two options and a valid finalist count.");
    return;
  }

  const prepared = prepareRandomSource();
  const finalists = sample(items, count, prepared.source);
  const winner = pick(finalists, prepared.source);

  try {
    await record(
      { id: "studio", name: "Decision Studio", icon: "◆" },
      winner,
      { finalists }
    );
    await prepared.commit();
    state.studioResult = { finalists, winner };
    announce("Decision result: " + winner);
    render();
  } catch {
    announce("Could not save the Decision Studio result.");
  }
}

function currentTool() {
  return getTool(state.toolId);
}

function renderTool() {
  const tool = currentTool();
  const toolState = ensureToolState(tool.id);
  const content = node("main", { class: "content" });
  const favorite = state.favorites.includes(tool.id);

  const head = node("div", {
    class: "tool-head accent-" + tool.accent
  }, [
    iconButton("Back", "←", closeTool),
    node("span", {
      class: "tool-symbol",
      text: tool.icon,
      "aria-hidden": "true"
    }),
    node("h1", { text: tool.name }),
    iconButton(
      favorite ? "Remove favorite" : "Add favorite",
      favorite ? "★" : "☆",
      () => toggleFavorite(tool.id),
      favorite ? "favorite-star" : ""
    ),
    iconButton("Randomness settings", "⚙", () => {
      state.modal = "settings";
      render();
    })
  ]);

  const ruleStrip = renderRuleStrip(tool, toolState);
  const stage = buildStage(tool, toolState);
  const controls = buildControls(tool, toolState);

  content.append(node("section", {
    class: "tool-screen accent-" + tool.accent
  }, [head, ruleStrip, stage, controls].filter(Boolean)));

  return content;
}

function resultList(items) {
  return node("div", { class: "result-list" }, items.map((item, index) =>
    node("div", { class: "result-row" }, [
      node("span", { class: "rank", text: String(index + 1) }),
      node("strong", { text: String(item) })
    ])
  ));
}

function teamsResult(groups, prefix = "Team") {
  return node("div", { class: "teams-grid" }, groups.map((group, index) =>
    node("div", {
      class: "team-card",
      style: { "--accent": palette[index % palette.length] }
    }, [
      node("strong", { text: prefix + " " + (index + 1) }),
      ...group.map((person) =>
        node("div", { class: "team-member", text: person })
      )
    ])
  ));
}

function tournamentResult(matches) {
  return node("div", { class: "bracket-list" }, matches.map((match, index) =>
    node("div", { class: "match-card" }, [
      node("span", { class: "match-number", text: "Match " + (index + 1) }),
      node("strong", { text: match.a || "TBD" }),
      node("span", {
        class: "match-vs",
        text: match.b ? "VS" : "BYE"
      }),
      match.b ? node("strong", { text: match.b }) : null
    ])
  ));
}

function ladderBoard(items, outcomes, ladder) {
  const board = node("div", {
    class: "ladder-board",
    style: { "--ladder-cols": String(items.length) }
  });

  board.append(node("div", { class: "ladder-label-row" },
    items.map((item) => node("span", { text: item }))
  ));

  const tracks = node("div", { class: "ladder-tracks" });
  for (let index = 0; index < items.length; index += 1) {
    tracks.append(node("span", {
      class: "ladder-track",
      style: {
        left: (index / (items.length - 1) * 100) + "%"
      }
    }));
  }

  const rungCount = Math.max(ladder?.rungs?.length || 0, 1);
  (ladder?.rungs || []).forEach((rung, index) => {
    tracks.append(node("span", {
      class: "ladder-rung",
      style: {
        top: ((index + 1) / (rungCount + 1) * 100) + "%",
        left: (rung.left / (items.length - 1) * 100) + "%",
        width: (100 / (items.length - 1)) + "%"
      }
    }));
  });

  board.append(tracks);
  board.append(node("div", { class: "ladder-label-row ladder-outcomes" },
    outcomes.map((item) => node("span", { text: item }))
  ));

  return board;
}

function makeWheelGradient(model) {
  if (!model?.eligibleEntries?.length) return palette[0];
  const parts = [];
  let cursor = 0;

  model.eligibleEntries.forEach((entry, index) => {
    const start = cursor * 360;
    cursor += entry.probability;
    const end = cursor * 360;
    parts.push(
      palette[index % palette.length]
      + " "
      + start.toFixed(3)
      + "deg "
      + end.toFixed(3)
      + "deg"
    );
  });

  return "conic-gradient(" + parts.join(",") + ")";
}

function wheelSegmentForIndex(model, originalIndex) {
  if (!model?.eligibleEntries?.length) return null;
  let cursor = 0;
  for (const entry of model.eligibleEntries) {
    const start = cursor * 360;
    cursor += entry.probability;
    const end = cursor * 360;
    if (entry.index === originalIndex) {
      return { start, end, center: start + (end - start) / 2 };
    }
  }
  return null;
}

function wheelLabels(model) {
  if (!model?.eligibleEntries?.length || model.eligibleEntries.length > 12) return null;
  const layer = node("div", {
    class: "wheel-label-layer",
    "aria-hidden": "true"
  });
  const radius = 106;
  let cursor = 0;

  model.eligibleEntries.forEach((entry) => {
    const start = cursor * 360;
    cursor += entry.probability;
    const end = cursor * 360;
    const angle = start + (end - start) / 2;

    layer.append(node("span", {
      class: "wheel-label",
      style: {
        transform:
          "translate(-50%, -50%) rotate("
          + angle
          + "deg) translateY(-"
          + radius
          + "px) rotate(-"
          + angle
          + "deg)"
      },
      text: String(entry.label).length > 11
        ? String(entry.label).slice(0, 10) + "…"
        : String(entry.label)
    }));
  });

  return layer;
}

function readyLabel(id) {
  return ({
    picker: "PICK",
    number: "GENERATE",
    chance: "TRY",
    date: "PICK DATE",
    time: "PICK TIME",
    coordinate: "GENERATE",
    direction: "SPIN",
    letter: "DRAW",
    rps: "PLAY"
  })[id] || "READY";
}

function stageLabel(id) {
  return ({
    picker: "Selected",
    number: "Random number",
    chance: "Chance result",
    date: "Random date",
    time: "Random time",
    coordinate: "Coordinates",
    direction: "Direction",
    letter: "Random letter",
    rps: "Random play"
  })[id] || "Result";
}

function renderRuleStrip(tool, ts) {
  if (!selectionTools.has(tool.id)) return null;
  const model = currentSelectionModel(tool.id, ts);
  if (!model) return null;
  const rules = selectionRuleSummary(model, {
    allowRepeats: ts.allowRepeats,
    multi: tool.id === "sampler"
  });
  if (!rules.length) return null;

  return node("div", {
    class: "tool-rule-strip",
    "aria-label": "Active selection rules"
  }, rules.map((rule) =>
    node("span", { class: "rule-chip", text: rule })
  ));
}

function buildStage(tool, ts) {
  const stage = node("div", {
    class: "tool-stage accent-" + tool.accent
  });
  const wrap = node("div", { class: "stage-content" });
  const result = ts.result;

  if (tool.id === "coin") {
    wrap.append(
      node("div", {
        class: "stage-orb " + (ts.animating ? "flipping" : ""),
        text: result ? (result === "Heads" ? "H" : "T") : "?"
      }),
      node("div", { class: "stage-label", text: "Coin Flip" }),
      node("div", { class: "stage-result", text: result || "READY" })
    );
  } else if (tool.id === "dice") {
    const values = result?.values
      || Array.from({ length: ts.diceCount }, () => "•");
    wrap.append(
      node("div", {
        class: "dice-row " + (ts.animating ? "rolling" : "")
      }, values.map((value) =>
        node("div", { class: "die", text: String(value) })
      )),
      node("div", {
        class: "stage-label",
        text: result ? "Total" : "Dice ready"
      }),
      node("div", {
        class: "stage-result",
        text: result ? String(result.total) : "ROLL"
      }),
      result
        ? node("div", {
            class: "stage-sub",
            text: result.values.join(" + ") + " on D" + result.sides
          })
        : null
    );
  } else if (tool.id === "wheel") {
    const model = currentSelectionModel("wheel", ts);
    const wheel = node("div", {
      class: "wheel",
      style: {
        background: makeWheelGradient(model),
        transform: "rotate(" + (ts.previousWheelRotation || 0) + "deg)"
      }
    });
    const labels = wheelLabels(model);
    if (labels) wheel.append(labels);

    const wheelWrap = node("div", { class: "wheel-wrap" }, [
      wheel,
      node("div", { class: "wheel-pointer", "aria-hidden": "true" }),
      node("div", {
        class: "wheel-center-label",
        text: (model?.eligibleCount || 0) + " eligible"
      })
    ]);

    wrap.append(
      wheelWrap,
      node("div", { class: "stage-label", text: "Result" }),
      node("div", {
        class: "stage-result",
        text: result || "SPIN",
        style: {
          fontSize: result && String(result).length > 18 ? "42px" : ""
        }
      })
    );

    if (ts.pendingWheelRotation != null) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wheel.style.transform = "rotate(" + ts.pendingWheelRotation + "deg)";
      }));
    }
  } else if (tool.id === "cards") {
    const red = result?.card && /[♥♦]/.test(result.card);
    wrap.append(
      node("div", {
        class: "card-deck",
        text: "✦",
        "aria-hidden": "true"
      }),
      node("div", {
        class: "stage-label",
        text: result ? "Drawn card" : "52-card deck"
      }),
      node("div", {
        class: "stage-result play-card " + (red ? "red-card" : ""),
        text: result?.card || "DRAW"
      }),
      node("div", {
        class: "stage-sub",
        text: result
          ? result.remaining + " cards remain"
          : "The deck shuffles once, then draws without replacement."
      })
    );
  } else if (tool.id === "color") {
    const color = result || "#7C5CFF";
    wrap.append(
      node("div", {
        class: "color-swatch",
        style: { background: color }
      }),
      node("div", { class: "stage-label", text: "HEX Color" }),
      node("div", { class: "stage-result", text: color })
    );
  } else if (tool.id === "sampler" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Selected" }),
      resultList(result)
    );
  } else if (tool.id === "shuffle" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random order" }),
      resultList(result),
      node("div", {
        class: "stage-sub",
        text: result.length + " items"
      })
    );
  } else if (tool.id === "teams" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random teams" }),
      teamsResult(result, "Team")
    );
  } else if (tool.id === "groups" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random groups" }),
      teamsResult(result, "Group")
    );
  } else if (tool.id === "pairs" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random pairs" }),
      resultList(result.map((pair) =>
        pair.length === 2 ? pair.join("  ↔  ") : pair[0] + "  —  unmatched"
      ))
    );
  } else if (tool.id === "assignment" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Assignments" }),
      resultList(result.map((item) => item.source + "  →  " + item.target))
    );
  } else if (tool.id === "ladder" && Array.isArray(result)) {
    const inputs = parseList(ts.listText);
    const outcomes = parseList(ts.ladderOutcomes);
    wrap.append(
      node("div", { class: "stage-label", text: "Ghost Ladder" }),
      ts.ladder ? ladderBoard(inputs, outcomes, ts.ladder) : null,
      resultList(result.map((item) => item.source + "  →  " + item.target))
    );
  } else if (tool.id === "tournament" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "First-round draw" }),
      tournamentResult(result)
    );
  } else if (tool.id === "elimination") {
    const remaining = ts.eliminationRemaining || parseList(ts.listText);
    wrap.append(
      node("div", {
        class: "stage-label",
        text: result?.winner ? "Winner" : "Elimination"
      }),
      node("div", {
        class: "stage-result",
        text: result?.winner || result?.eliminated || "READY",
        style: {
          fontSize:
            String(result?.winner || result?.eliminated || "READY").length > 18
              ? "42px"
              : ""
        }
      }),
      node("div", {
        class: "stage-sub",
        text: result?.winner
          ? "Last entrant standing"
          : result?.sub || remaining.length + " entrants ready"
      }),
      remaining.length <= 20 ? resultList(remaining) : null
    );
  } else if (tool.id === "secret-santa") {
    if (ts.secretAssignments && ts.secretReveal != null) {
      const assignment = ts.secretAssignments[ts.secretReveal];
      wrap.append(
        node("div", {
          class: "private-badge",
          text: "PRIVATE REVEAL"
        }),
        node("div", {
          class: "stage-label",
          text: assignment.source + " gives to"
        }),
        node("div", {
          class: "stage-result",
          text: assignment.target
        }),
        node("div", {
          class: "stage-sub",
          text: "Hide this before passing the device."
        })
      );
    } else {
      wrap.append(
        node("div", {
          class: "stage-label",
          text: "Private assignment"
        }),
        node("div", {
          class: "stage-result",
          text: ts.secretAssignments ? "READY" : "GENERATE",
          style: { fontSize: "clamp(42px,12vw,72px)" }
        }),
        node("div", {
          class: "stage-sub",
          text: ts.secretAssignments
            ? ts.secretAssignments.length + " private matches generated"
            : "Nobody can draw themselves."
        })
      );
    }
  } else if (tool.id === "lottery" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Draw" }),
      node("div", {
        class: "stage-result",
        text: result.join(" · "),
        style: { fontSize: "clamp(34px,10vw,62px)" }
      })
    );
  } else {
    const text = result?.summary || result || readyLabel(tool.id);
    wrap.append(
      node("div", {
        class: "stage-label",
        text: stageLabel(tool.id)
      }),
      node("div", {
        class: "stage-result",
        text: String(text),
        style: {
          fontSize: String(text).length > 20 ? "42px" : ""
        }
      }),
      result?.sub
        ? node("div", { class: "stage-sub", text: result.sub })
        : null
    );
  }

  stage.append(wrap);
  return stage;
}

function toolError(message) {
  return node("div", {
    class: "tool-error",
    role: "alert"
  }, [
    node("strong", { text: "Could not randomize" }),
    node("span", { text: message })
  ]);
}

function textareaControl(label, value, onChange) {
  const textarea = node("textarea", {
    class: "field",
    "aria-label": label,
    placeholder: "One item per line"
  });
  textarea.value = value;
  textarea.addEventListener("input", () => onChange(textarea.value));
  return node("div", {
    class: "control",
    style: { marginBottom: "12px" }
  }, [
    node("label", { text: label }),
    textarea
  ]);
}

function numberControl(label, id, value, min, max, onChange) {
  const input = node("input", {
    class: "field",
    id,
    type: "number",
    min: String(min),
    max: String(max),
    value: String(value)
  });
  input.addEventListener("input", () => onChange(Number(input.value)));
  return node("div", { class: "control" }, [
    node("label", { for: id, text: label }),
    input
  ]);
}

function dateControl(label, value, onChange) {
  const input = node("input", {
    class: "field",
    type: "date",
    value
  });
  input.addEventListener("input", () => onChange(input.value));
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    input
  ]);
}

function timeControl(label, value, onChange) {
  const input = node("input", {
    class: "field",
    type: "time",
    value
  });
  input.addEventListener("input", () => onChange(input.value));
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    input
  ]);
}

function stepperControl(label, value, min, max, onChange) {
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    node("div", { class: "stepper" }, [
      node("button", {
        type: "button",
        "aria-label": "Decrease " + label,
        onClick: () => onChange(Math.max(min, value - 1))
      }, "−"),
      node("output", { text: String(value) }),
      node("button", {
        type: "button",
        "aria-label": "Increase " + label,
        onClick: () => onChange(Math.min(max, value + 1))
      }, "+")
    ])
  ]);
}

function selectControl(label, options, value, onChange) {
  const select = node("select", {
    class: "field",
    "aria-label": label
  }, options.map((option) =>
    node("option", {
      value: option,
      text: "D" + option
    })
  ));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    select
  ]);
}

function listControls(tool, ts) {
  const wrap = node("div");
  const poolSelect = node("select", {
    class: "field",
    "aria-label": "Use saved Pool"
  }, [
    node("option", { value: "", text: "Current list" }),
    ...state.pools.map((pool) =>
      node("option", {
        value: pool.id,
        text: pool.name + " · " + pool.items.length
      })
    )
  ]);

  poolSelect.addEventListener("change", () => {
    const pool = state.pools.find((item) => item.id === poolSelect.value);
    if (!pool) return;
    ts.listText = pool.items.map((item) => item.label).join("\n");
    invalidateTool(tool.id, ts);
    render();
  });

  const textarea = node("textarea", {
    class: "field",
    "aria-label": tool.name + " entries",
    placeholder: "One option per line"
  });
  textarea.value = ts.listText;
  textarea.addEventListener("input", () => {
    ts.listText = textarea.value;
    invalidateTool(tool.id, ts);
  });
  textarea.addEventListener("change", render);

  wrap.append(
    node("div", {
      class: "control",
      style: { marginBottom: "10px" }
    }, [
      node("label", { text: "Source" }),
      poolSelect
    ]),
    node("div", {
      class: "control",
      style: { marginBottom: "12px" }
    }, [
      node("label", { text: "Entries" }),
      textarea
    ])
  );

  return wrap;
}

function configSetter(toolId, ts, key, value, rerender = false) {
  ts[key] = value;
  invalidateTool(toolId, ts);
  if (rerender) render();
}

function buildControls(tool, ts) {
  const controls = node("div", { class: "controls" });
  const grid = node("div", { class: "control-grid" });

  if (ts.error) controls.append(toolError(ts.error));

  const listTools = new Set([
    "wheel", "picker", "sampler", "shuffle",
    "teams", "groups", "pairs", "assignment",
    "elimination", "ladder", "secret-santa", "tournament"
  ]);

  if (listTools.has(tool.id)) {
    controls.append(listControls(tool, ts));

    if (tool.id === "teams") {
      grid.append(numberControl(
        "Teams", "team-count", ts.teamCount, 2, 12,
        (value) => configSetter(tool.id, ts, "teamCount", value)
      ));
      controls.append(grid);
    } else if (tool.id === "groups") {
      grid.append(numberControl(
        "Groups", "group-count", ts.groupCount, 2, 20,
        (value) => configSetter(tool.id, ts, "groupCount", value)
      ));
      controls.append(grid);
    } else if (tool.id === "sampler") {
      grid.append(numberControl(
        "Winners", "sample-count", ts.sampleCount, 1, 100,
        (value) => configSetter(tool.id, ts, "sampleCount", value)
      ));
      controls.append(grid);
    } else if (tool.id === "assignment") {
      controls.append(textareaControl(
        "Targets / tasks",
        ts.targetText,
        (value) => {
          ts.targetText = value;
          invalidateTool(tool.id, ts);
        }
      ));
    } else if (tool.id === "ladder") {
      controls.append(textareaControl(
        "Outcomes / prizes",
        ts.ladderOutcomes,
        (value) => {
          ts.ladderOutcomes = value;
          invalidateTool(tool.id, ts);
        }
      ));
    }

    if (tool.id === "secret-santa" && ts.secretAssignments) {
      const reveal = node("select", {
        class: "field",
        "aria-label": "Choose participant to reveal"
      }, ts.secretAssignments.map((item, index) =>
        node("option", {
          value: String(index),
          text: item.source
        })
      ));

      controls.append(node("div", {
        class: "button-row secret-actions",
        style: { marginBottom: "12px" }
      }, [
        reveal,
        node("button", {
          class: "secondary",
          type: "button",
          onClick: () => {
            ts.secretReveal = Number(reveal.value);
            render();
          }
        }, "Reveal privately"),
        node("button", {
          class: "secondary",
          type: "button",
          onClick: () => {
            ts.secretReveal = null;
            render();
          }
        }, "Hide")
      ]));
    }
  } else if (tool.id === "dice") {
    grid.append(
      stepperControl("Dice", ts.diceCount, 1, 8, (value) => {
        configSetter(tool.id, ts, "diceCount", value, true);
      }),
      selectControl(
        "Sides",
        ["2", "4", "6", "8", "10", "12", "20", "37", "100"],
        String(ts.diceSides),
        (value) => {
          configSetter(tool.id, ts, "diceSides", Number(value), true);
        }
      )
    );
    controls.append(grid);
  } else if (tool.id === "number") {
    grid.append(
      numberControl(
        "Minimum", "number-min", ts.numberMin, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "numberMin", value)
      ),
      numberControl(
        "Maximum", "number-max", ts.numberMax, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "numberMax", value)
      )
    );
    controls.append(grid);
  } else if (tool.id === "chance") {
    grid.append(numberControl(
      "Success chance %", "chance", ts.chance, 0, 100,
      (value) => configSetter(tool.id, ts, "chance", value)
    ));
    controls.append(grid);
  } else if (tool.id === "lottery") {
    grid.append(
      numberControl(
        "Numbers", "lottery-count", ts.lotteryCount, 1, 50,
        (value) => configSetter(tool.id, ts, "lotteryCount", value)
      ),
      numberControl(
        "From 1 to", "lottery-max", ts.lotteryMax, 1, 10000,
        (value) => configSetter(tool.id, ts, "lotteryMax", value)
      )
    );
    controls.append(grid);
  } else if (tool.id === "date") {
    grid.append(
      dateControl("From", ts.dateStart, (value) => {
        configSetter(tool.id, ts, "dateStart", value);
      }),
      dateControl("To", ts.dateEnd, (value) => {
        configSetter(tool.id, ts, "dateEnd", value);
      })
    );
    controls.append(grid);
  } else if (tool.id === "time") {
    grid.append(
      timeControl("From", ts.timeStart, (value) => {
        configSetter(tool.id, ts, "timeStart", value);
      }),
      timeControl("To", ts.timeEnd, (value) => {
        configSetter(tool.id, ts, "timeEnd", value);
      })
    );
    controls.append(grid);
  } else if (tool.id === "coordinate") {
    grid.append(
      numberControl("X min", "x-min", ts.xMin, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "xMin", value)),
      numberControl("X max", "x-max", ts.xMax, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "xMax", value)),
      numberControl("Y min", "y-min", ts.yMin, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "yMin", value)),
      numberControl("Y max", "y-max", ts.yMax, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "yMax", value))
    );
    controls.append(grid);
  }

  const actions = node("div", { class: "button-row" });
  const primary = node("button", {
    class: "primary action-button",
    type: "button",
    onClick: () => runTool(tool.id)
  }, actionLabel(tool.id, ts));

  if (tool.id === "cards" && Array.isArray(ts.deck) && ts.deck.length === 0) {
    primary.disabled = true;
  }

  actions.append(primary);

  if (tool.id === "cards" && ts.deck) {
    actions.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        invalidateTool(tool.id, ts, true);
        render();
      }
    }, "Reset deck"));
  }

  if (tool.id === "elimination" && ts.eliminationRemaining) {
    actions.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        invalidateTool(tool.id, ts, true);
        render();
      }
    }, "Reset elimination"));
  }

  if (ts.result) {
    actions.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: shareCurrentResult
    }, "Share"));
  }

  controls.append(actions);

  const mode = state.settings.randomness.mode === "seeded"
    ? "Seeded sequence · " + state.settings.randomness.seed
    : "Secure Web Crypto randomness";

  controls.append(node("div", {
    class: "notice",
    style: { marginTop: "12px" },
    text: mode + ". The result is committed before its reveal animation."
  }));

  return controls;
}

function actionLabel(id, ts) {
  if (ts.animating) return "SHOW RESULT";
  const labels = {
    coin: ts.result ? "FLIP AGAIN" : "FLIP",
    dice: ts.result ? "ROLL AGAIN" : "ROLL",
    wheel: ts.result ? "SPIN AGAIN" : "SPIN",
    picker: ts.result ? "PICK AGAIN" : "PICK",
    sampler: "DRAW WINNERS",
    number: "GENERATE",
    shuffle: "SHUFFLE",
    teams: ts.result ? "REMIX" : "MIX TEAMS",
    groups: ts.result ? "REGROUP" : "MAKE GROUPS",
    pairs: ts.result ? "REMATCH" : "MAKE PAIRS",
    assignment: ts.result ? "REASSIGN" : "ASSIGN",
    elimination: ts.result?.winner ? "START AGAIN" : "ELIMINATE",
    ladder: "GENERATE LADDER",
    "secret-santa": ts.secretAssignments ? "REGENERATE" : "GENERATE",
    tournament: "DRAW MATCHUPS",
    cards: Array.isArray(ts.deck) && ts.deck.length === 0 ? "DECK EMPTY" : "DRAW",
    chance: "TRY CHANCE",
    lottery: "DRAW NUMBERS",
    color: "NEW COLOR",
    date: "PICK DATE",
    time: "PICK TIME",
    coordinate: "GENERATE POINT",
    direction: "SPIN DIRECTION",
    letter: "DRAW LETTER",
    rps: "PLAY"
  };
  return labels[id] || "RANDOMIZE";
}

async function runTool(id) {
  const tool = getTool(id);
  const ts = ensureToolState(id);

  if (ts.animating) {
    ts.animating = false;
    ts.pendingWheelRotation = null;
    ts.previousWheelRotation = ts.wheelRotation;
    render();
    return;
  }

  if (id === "elimination" && ts.result?.winner) {
    invalidateTool(id, ts, true);
    render();
    return;
  }

  ts.error = null;
  const prepared = prepareRandomSource();

  const config = {
    ...ts,
    items: parseList(ts.listText),
    targets: parseList(ts.targetText),
    outcomes: parseList(ts.ladderOutcomes)
  };

  try {
    const output = executeTool(id, config, prepared.source);
    let result = output.result;
    let summary = output.summary;

    if (id === "date") {
      const date = new Date(result.timestamp);
      const localized = new Intl.DateTimeFormat(undefined, {
        dateStyle: "long",
        timeZone: "UTC"
      }).format(date);
      result = { ...result, summary: localized };
      summary = localized;
    }

    await record(tool, summary, output.detail || null);
    await prepared.commit();

    if (output.statePatch) Object.assign(ts, output.statePatch);
    ts.result = result;

    if (id === "ladder") {
      ts.ladder = output.detail?.ladder || null;
    }

    let animationDuration = 0;

    if (id === "wheel") {
      const index = output.detail.selectedIndex;
      const segment = 360 / config.items.length;
      const desired = (360 - (index + 0.5) * segment) % 360;
      const previous = ts.wheelRotation || 0;
      const current = ((previous % 360) + 360) % 360;
      const delta = (desired - current + 360) % 360;
      const target = previous + 1080 + delta;

      ts.previousWheelRotation = previous;
      ts.pendingWheelRotation = target;
      ts.wheelRotation = target;
      ts.animating = true;
      animationDuration = 1700;
    } else if (id === "coin") {
      ts.animating = true;
      animationDuration = 850;
    } else if (id === "dice") {
      ts.animating = true;
      animationDuration = 720;
    }

    render();

    if (animationDuration) {
      window.setTimeout(() => finishAnimation(id), animationDuration);
    }

    announce(tool.name + " result: " + summary);
  } catch (error) {
    ts.error = error?.message || "This randomizer could not run.";
    render();
    announce("Error: " + ts.error);
  }
}

function finishAnimation(id) {
  const ts = ensureToolState(id);
  if (!ts.animating) return;
  ts.animating = false;
  ts.pendingWheelRotation = null;
  ts.previousWheelRotation = ts.wheelRotation;
  if (state.toolId === id) render();
}

async function shareCurrentResult() {
  const tool = currentTool();
  const ts = ensureToolState(tool.id);
  if (!ts.result) return;

  const text = tool.name + ": " + summarizeResult(tool.id, ts.result);

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Randomizer Arcade",
        text
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      announce("Result copied.");
    }
  } catch {
    // Cancelling the platform share sheet is not an application error.
  }
}

function summarizeResult(id, result) {
  if (id === "dice") {
    return result.values.join(" + ") + " = " + result.total;
  }

  if (id === "teams") {
    return result.map((group, index) =>
      "Team " + (index + 1) + ": " + group.join(", ")
    ).join(" | ");
  }

  if (id === "groups") {
    return result.map((group, index) =>
      "Group " + (index + 1) + ": " + group.join(", ")
    ).join(" | ");
  }

  if (id === "shuffle" || id === "sampler") {
    return result.join(", ");
  }

  if (id === "pairs") {
    return result.map((group) =>
      group.length === 2 ? group.join(" & ") : group[0] + " — unmatched"
    ).join(" | ");
  }

  if (id === "assignment" || id === "ladder") {
    return result.map((item) =>
      item.source + " → " + item.target
    ).join(" | ");
  }

  if (id === "tournament") {
    return result.map((match) =>
      match.b ? match.a + " vs " + match.b : match.a + " — BYE"
    ).join(" | ");
  }

  if (id === "lottery") return result.join(", ");

  if (typeof result === "object") {
    return result.summary || result.card || JSON.stringify(result);
  }

  return String(result);
}

function renderModal() {
  if (!state.modal) return null;

  const backdrop = node("div", {
    class: "modal-backdrop",
    onClick: (event) => {
      if (event.target === backdrop) {
        state.modal = null;
        render();
      }
    }
  });

  const modal = node("section", {
    class: "modal",
    role: "dialog",
    "aria-modal": "true"
  });

  if (state.modal === "settings") {
    modal.append(
      node("h2", { text: "Randomness" }),
      node("p", {
        text: "Secure mode uses Web Crypto. Seeded mode gives a reproducible sequence for testing and shared challenges."
      })
    );

    const modes = node("div", { class: "segmented" });

    for (const mode of ["secure", "seeded"]) {
      modes.append(node("button", {
        class: state.settings.randomness.mode === mode ? "active" : "",
        type: "button",
        onClick: async () => {
          state.settings.randomness.mode = mode;
          if (mode === "seeded") state.settings.randomness.position = 0;
          await saveSettings(state.settings);
          render();
        }
      }, mode === "secure" ? "Secure" : "Seeded"));
    }

    modal.append(modes);

    if (state.settings.randomness.mode === "seeded") {
      const seed = node("input", {
        class: "field",
        value: state.settings.randomness.seed || "ARCADE-2026",
        "aria-label": "Seed",
        style: { marginTop: "12px" }
      });

      seed.addEventListener("change", async () => {
        state.settings.randomness.seed = seed.value || "ARCADE-2026";
        state.settings.randomness.position = 0;
        await saveSettings(state.settings);
      });

      modal.append(seed);
    }

    modal.append(node("div", { class: "modal-actions" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => {
          state.modal = null;
          render();
        }
      }, "Done")
    ]));
  } else if (state.modal === "pool") {
    modal.append(
      node("h2", { text: "New Pool" }),
      node("p", {
        text: "One item per line. Duplicate labels are allowed and remain separate entries."
      })
    );

    const name = node("input", {
      class: "field",
      placeholder: "Pool name",
      "aria-label": "Pool name"
    });
    const items = node("textarea", {
      class: "field",
      placeholder: "Anna\nBen\nDavid\nSarah",
      "aria-label": "Pool items",
      style: { marginTop: "10px" }
    });
    const error = node("div", {
      class: "tool-error modal-error",
      role: "alert",
      hidden: "hidden"
    });

    modal.append(name, items, error);

    modal.append(node("div", { class: "modal-actions" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => {
          state.modal = null;
          render();
        }
      }, "Cancel"),
      node("button", {
        class: "primary",
        type: "button",
        onClick: async () => {
          const labels = parseList(items.value);
          if (!name.value.trim() || !labels.length) {
            error.hidden = false;
            error.replaceChildren(
              node("strong", { text: "Pool needs more information" }),
              node("span", { text: "Add a Pool name and at least one item." })
            );
            return;
          }

          const now = new Date().toISOString();
          const pool = {
            id: crypto.randomUUID(),
            name: name.value.trim(),
            items: labels.map((label) => ({
              id: crypto.randomUUID(),
              label,
              active: true
            })),
            createdAt: now,
            updatedAt: now,
            revision: 1
          };

          await put("pools", pool);
          state.pools.unshift(pool);
          state.modal = null;
          requestPersistentStorage();
          render();
        }
      }, "Save Pool")
    ]));
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "use-pool"
  ) {
    const pool = state.pools.find((item) => item.id === state.modal.poolId);
    if (!pool) return null;

    modal.append(
      node("h2", { text: pool.name }),
      node("p", { text: "Choose a compatible randomizer." })
    );

    const choices = [
      "picker", "sampler", "wheel", "shuffle",
      "teams", "groups", "pairs", "assignment",
      "elimination", "ladder", "tournament", "secret-santa"
    ];

    modal.append(node("div", {
      class: "tool-grid modal-tool-grid"
    }, choices.map((id) => {
      const tool = getTool(id);
      return node("button", {
        class: "tool-card accent-" + tool.accent,
        type: "button",
        onClick: () => {
          const ts = ensureToolState(id);
          ts.listText = pool.items.map((item) => item.label).join("\n");
          invalidateTool(id, ts);
          state.modal = null;
          openTool(id);
        }
      }, [
        node("span", {
          class: "tool-icon",
          text: tool.icon,
          "aria-hidden": "true"
        }),
        node("strong", { text: tool.name }),
        node("small", { text: tool.blurb })
      ]);
    })));
  }

  backdrop.append(modal);
  return backdrop;
}

function render() {
  if (!state.settings) return;

  document.querySelectorAll(".modal-backdrop").forEach((item) => item.remove());

  const layout = node("div", { class: "layout" });
  layout.append(topBar());

  if (state.view === "play") layout.append(renderPlay());
  else if (state.view === "arcade") layout.append(renderArcade());
  else if (state.view === "pools") layout.append(renderPools());
  else if (state.view === "history") layout.append(renderHistory());
  else if (state.view === "studio") layout.append(renderStudio());
  else if (state.view === "tool") layout.append(renderTool());

  layout.append(bottomNav());
  root.replaceChildren(layout);

  const modal = renderModal();
  if (modal) document.body.append(modal);
}

async function init() {
  await loadData();

  const requestedTool = new URLSearchParams(location.search).get("tool");
  if (getTool(requestedTool)) {
    state.view = "tool";
    state.toolId = requestedTool;
    ensureToolState(requestedTool);
  }

  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modal) {
      state.modal = null;
      render();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      const secret = state.tool["secret-santa"];
      if (secret?.secretReveal != null) {
        secret.secretReveal = null;
        render();
      }
    }
  });
}

init().catch((error) => {
  root.replaceChildren(node("div", { class: "boot-screen" }, [
    node("div", { class: "brand-mark", text: "!" }),
    node("strong", { text: "Could not start Randomizer Arcade" }),
    node("span", {
      text: error?.message || "Unknown startup error."
    })
  ]));
});
