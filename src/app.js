import { createRng, pick, sample } from "./random-core.js";
import { CATEGORIES, TOOLS, getTool, searchTools } from "./registry.js";
import { executeTool } from "./tool-engine.js";
import { describeDiceExpression } from "./dice-engine.js";
import {
  normalizeSelection,
  reconcileSelectionEntries,
  selectionRuleSummary,
  percentage
} from "./selection-model.js";
import {
  getAll,
  put,
  putWithRevision,
  remove,
  clear,
  getSettings,
  saveSettings,
  requestPersistentStorage
} from "./storage.js";
import {
  normalizePool,
  createPool,
  mutatePool,
  createPoolItem,
  createPoolField,
  createWorkingSet,
  workingSetLabels,
  filterPoolItems,
  duplicateSummary,
  parseDelimitedText,
  importRowsToPoolItems,
  createPoolView,
  resolvePoolView,
  poolStats
} from "./pool-model.js";
import {
  createRule,
  ruleTypesForTool,
  validateRules,
  summarizeRule,
  ruleStrengthLabel
} from "./rule-model.js";
import { historyPairKey } from "./constraint-engine.js";

const root = document.getElementById("app");
const announcer = document.getElementById("announcer");

const state = {
  view: "play",
  toolId: null,
  pools: [],
  poolViews: [],
  poolSearch: "",
  poolShowArchived: false,
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
const constraintTools = new Set([
  "teams",
  "groups",
  "pairs",
  "assignment",
  "secret-santa",
  "tournament"
]);

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
      diceMode: "quick",
      diceExpression: "2d6",
      diceHistory: [],
      diceHelpOpen: false,

      numberMin: 1,
      numberMax: 100,
      numberMode: "integer",
      numberPrecision: 2,
      numberCount: 1,
      numberUnique: false,

      teamCount: 2,
      groupCount: 3,
      sampleCount: 3,
      selectionEntries: [],
      workingSet: null,
      workingSetDirty: false,
      allowRepeats: false,
      selectionOpen: false,
      fairnessOpen: false,
      rules: [],
      rulesOpen: false,
      solverEffort: "automatic",

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

function reconcileToolSelection(toolId, toolState) {
  if (!selectionTools.has(toolId)) return [];
  const items = parseList(toolState.listText);
  toolState.selectionEntries = reconcileSelectionEntries(
    items,
    toolState.selectionEntries || []
  );
  return items;
}

function syncSelectionState(toolId, toolState) {
  const items = reconcileToolSelection(toolId, toolState);
  if (!selectionTools.has(toolId)) return null;
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
  const [pools, poolViews, historyEntries, favorites, settings] = await Promise.all([
    getAll("pools"),
    getAll("poolViews"),
    getAll("history"),
    getAll("favorites"),
    getSettings()
  ]);

  state.pools = pools
    .map(normalizePool)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  state.poolViews = poolViews;
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

function poolById(id) {
  return state.pools.find((pool) => pool.id === id) || null;
}

function poolViewsFor(poolId) {
  return state.poolViews.filter((view) => String(view.poolId) === String(poolId));
}

function openPoolEditor(poolId) {
  const pool = poolById(poolId);
  if (!pool) return;
  state.modal = {
    type: "pool-editor",
    poolId,
    baseRevision: pool.revision,
    draft: normalizePool(pool),
    search: "",
    active: "all",
    tagFilter: "",
    selected: new Set(),
    viewName: ""
  };
  render();
}

function openPoolImport(poolId = null) {
  state.modal = {
    type: "pool-import",
    poolId,
    text: "",
    mode: poolId ? "append" : "new",
    poolName: poolId ? "" : "Imported Pool",
    hasHeader: "auto",
    preview: null,
    error: null
  };
  render();
}

async function persistPoolDraft(editor) {
  const current = poolById(editor.poolId);
  if (!current) throw new Error("Pool no longer exists.");

  const draft = normalizePool(editor.draft);
  const next = mutatePool(current, (target) => {
    target.name = draft.name;
    target.description = draft.description;
    target.kind = draft.kind;
    target.icon = draft.icon;
    target.accent = draft.accent;
    target.archived = draft.archived;
    target.fields = draft.fields;
    target.items = draft.items;
    target.weightProfiles = draft.weightProfiles;
  });

  await putWithRevision("pools", next, editor.baseRevision);
  state.pools = state.pools
    .map((pool) => pool.id === next.id ? next : pool)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  editor.baseRevision = next.revision;
  editor.draft = normalizePool(next);
  return next;
}

async function setPoolArchived(pool, archived) {
  const next = mutatePool(pool, (draft) => {
    draft.archived = archived;
  });
  await putWithRevision("pools", next, pool.revision);
  state.pools = state.pools.map((item) => item.id === next.id ? next : item);
  render();
}

function applyWorkingSetToTool(toolId, ts, workingSet) {
  ts.workingSet = workingSet;
  ts.listText = workingSetLabels(workingSet).join("\n");
  invalidateTool(toolId, ts);

  if (selectionTools.has(toolId)) {
    reconcileToolSelection(toolId, ts);
    ts.selectionEntries = ts.selectionEntries.map((entry, index) => ({
      ...entry,
      weight: workingSet.items[index]?.weight ?? 1,
      excluded: false
    }));
  }
}

function workingSetFromView(pool, view) {
  const items = resolvePoolView(pool, view);
  return createWorkingSet(pool, { itemIds: items.map((item) => item.id) });
}

function renderPools() {
  const activePools = state.pools.filter((pool) => {
    if (!state.poolShowArchived && pool.archived) return false;
    if (state.poolShowArchived && !pool.archived) return false;
    const query = state.poolSearch.trim().toLocaleLowerCase();
    if (!query) return true;
    const haystack = [
      pool.name,
      pool.description,
      pool.kind,
      ...pool.items.flatMap((item) => [item.label, ...item.tags])
    ].join(" ").toLocaleLowerCase();
    return haystack.includes(query);
  });

  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Pools" }),
    node("p", {
      class: "view-subtitle",
      text: "Reusable source data with active items, tags, fields, weights, Views, and revision-safe editing."
    }),
    node("div", { class: "button-row" }, [
      node("button", {
        class: "primary",
        type: "button",
        onClick: () => {
          state.modal = "pool";
          render();
        }
      }, "+ New Pool"),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => openPoolImport()
      }, "Import CSV")
    ])
  ]);

  const search = node("input", {
    class: "field pool-library-search",
    type: "search",
    placeholder: state.poolShowArchived ? "Search archived Pools…" : "Search Pools…",
    value: state.poolSearch,
    "aria-label": "Search Pools"
  });
  search.addEventListener("input", () => {
    state.poolSearch = search.value;
  });
  search.addEventListener("change", render);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") render();
  });

  const archivedToggle = node("button", {
    class: "secondary",
    type: "button",
    onClick: () => {
      state.poolShowArchived = !state.poolShowArchived;
      state.poolSearch = "";
      render();
    }
  }, state.poolShowArchived ? "← Active Pools" : "Archived");

  content.append(node("div", { class: "pool-library-toolbar" }, [
    search,
    archivedToggle
  ]));

  content.append(sectionHeader(
    state.poolShowArchived ? "Archived Pools" : "Saved Pools",
    activePools.length + " shown"
  ));

  if (!activePools.length) {
    content.append(emptyState(
      state.poolShowArchived ? "No archived Pools" : "No Pools found",
      state.poolShowArchived
        ? "Archived Pools will appear here."
        : "Create a Pool, import CSV/spreadsheet data, or clear the current search.",
      !state.poolShowArchived && !state.poolSearch ? "Create Pool" : null,
      !state.poolShowArchived && !state.poolSearch
        ? () => {
            state.modal = "pool";
            render();
          }
        : null
    ));
    return content;
  }

  const list = node("div", { class: "pool-list pool-list-v2" });

  for (const pool of activePools) {
    const stats = poolStats(pool);
    const views = poolViewsFor(pool.id);

    const badges = node("div", { class: "pool-badges" }, [
      node("span", { text: stats.active + "/" + stats.total + " active" }),
      stats.tags ? node("span", { text: stats.tags + " tags" }) : null,
      stats.fields ? node("span", { text: stats.fields + " fields" }) : null,
      views.length ? node("span", { text: views.length + " views" }) : null,
      stats.duplicates ? node("span", { class: "warning", text: stats.duplicates + " duplicate groups" }) : null
    ]);

    list.append(node("article", {
      class: "pool-item pool-card-v2" + (pool.archived ? " is-archived" : "")
    }, [
      node("div", { class: "pool-icon", text: pool.icon || "◎" }),
      node("div", { class: "pool-copy" }, [
        node("strong", { text: pool.name }),
        node("span", {
          text: (pool.description || pool.kind) + " · revision " + pool.revision
        }),
        badges
      ]),
      node("div", { class: "pool-card-actions" }, [
        !pool.archived ? node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            state.modal = { type: "use-pool", poolId: pool.id };
            render();
          }
        }, "Use") : null,
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => openPoolEditor(pool.id)
        }, "Edit"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => setPoolArchived(pool, !pool.archived)
        }, pool.archived ? "Restore" : "Archive")
      ])
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

function constraintItemsForTool(ts) {
  const labels = parseList(ts.listText);
  const workingItems = ts.workingSet?.items || [];
  const aligned = workingItems.length === labels.length;

  return labels.map((label, index) => ({
    id: aligned ? String(workingItems[index].id) : "item:" + index,
    label,
    tags: aligned && Array.isArray(workingItems[index].tags)
      ? [...workingItems[index].tags]
      : [],
    values: aligned && workingItems[index].values
      ? { ...workingItems[index].values }
      : {}
  }));
}

function balancedTargetModels(itemCount, count, prefix) {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  const base = Math.floor(itemCount / count);
  const remainder = itemCount % count;
  return Array.from({ length: count }, (_, index) => ({
    id: "target:" + index,
    label: prefix + " " + (index + 1),
    capacity: base + (index < remainder ? 1 : 0)
  }));
}

function constraintTargetsForTool(tool, ts, items) {
  if (tool.id === "teams") {
    return balancedTargetModels(items.length, Number(ts.teamCount), "Team");
  }

  if (tool.id === "groups") {
    return balancedTargetModels(items.length, Number(ts.groupCount), "Group");
  }

  if (tool.id === "pairs") {
    const count = Math.ceil(items.length / 2);
    return Array.from({ length: count }, (_, index) => ({
      id: "target:" + index,
      label: "Pair " + (index + 1),
      capacity: index === count - 1 && items.length % 2 === 1 ? 1 : 2
    }));
  }

  if (tool.id === "assignment") {
    const labels = parseList(ts.targetText);
    return balancedTargetModels(items.length, labels.length, "Target")
      .map((target, index) => ({
        ...target,
        label: labels[index] || target.label
      }));
  }

  if (tool.id === "secret-santa") {
    return items.map((item) => ({
      id: String(item.id),
      label: item.label,
      capacity: 1
    }));
  }

  if (tool.id === "tournament") {
    if (items.length < 2) return [];
    const bracketSize = 2 ** Math.ceil(Math.log2(items.length));
    const matchCount = bracketSize / 2;
    const byeCount = bracketSize - items.length;
    return Array.from({ length: matchCount }, (_, index) => ({
      id: "target:" + index,
      label: "Match " + (index + 1),
      capacity: index < byeCount ? 1 : 2
    }));
  }

  return [];
}

function constraintContext(tool, ts) {
  const items = constraintItemsForTool(ts);
  return {
    items,
    targets: constraintTargetsForTool(tool, ts, items),
    fields: Array.isArray(ts.workingSet?.fields)
      ? ts.workingSet.fields.map((field) => ({ ...field }))
      : []
  };
}

function historyPairsForTool(tool, ts) {
  const active = (ts.rules || []).filter(
    (rule) => rule.enabled !== false && rule.type === "historyAvoid"
  );
  if (!active.length) return new Set();

  const depth = Math.max(
    ...active.map((rule) => Number(rule.params?.depth) || 5)
  );
  const relevant = state.history
    .filter((entry) => entry.toolId === tool.id)
    .slice(0, depth);

  const output = new Set();
  const addGroupPairs = (group) => {
    const labels = (group || []).map((value) =>
      typeof value === "string"
        ? value
        : value?.label || value?.source || String(value || "")
    );
    for (let left = 0; left < labels.length; left += 1) {
      for (let right = left + 1; right < labels.length; right += 1) {
        output.add(historyPairKey(labels[left], labels[right]));
      }
    }
  };

  for (const entry of relevant) {
    if (Array.isArray(entry.detail?.groups)) {
      entry.detail.groups.forEach(addGroupPairs);
    }
    if (Array.isArray(entry.detail?.pairs)) {
      entry.detail.pairs.forEach(addGroupPairs);
    }
    if (Array.isArray(entry.detail?.matches)) {
      for (const match of entry.detail.matches) {
        if (match?.a && match?.b) {
          output.add(historyPairKey(match.a, match.b));
        }
      }
    }
  }

  return output;
}

function constraintValidation(tool, ts) {
  const context = constraintContext(tool, ts);
  return {
    context,
    validation: validateRules({
      toolId: tool.id,
      rules: ts.rules || [],
      items: context.items,
      targets: context.targets,
      fields: context.fields
    })
  };
}

function renderRuleStrip(tool, ts) {
  let rules = [];

  if (
    constraintTools.has(tool.id)
    && (ts.rules || []).some((rule) => rule.enabled !== false)
  ) {
    const activeRules = ts.rules.filter((rule) => rule.enabled !== false);
    const required = activeRules.filter((rule) => rule.strength !== "soft").length;
    const preferred = activeRules.filter((rule) => rule.strength === "soft").length;
    panel.querySelector(".fairness-body").append(
      node("div", { class: "fairness-method" }, [
        node("strong", { text: "Constrained randomization" }),
        node("p", {
          text:
            "The solver searches randomly among configurations that satisfy required rules, then uses preferences to rank valid candidates. "
            + "This is not guaranteed to be uniform over every mathematically valid arrangement. "
            + required + " required and " + preferred + " preferred rules are active. "
            + "Search effort: " + (ts.solverEffort || "automatic") + "."
        })
      ])
    );
  } else if (selectionTools.has(tool.id)) {
    const model = currentSelectionModel(tool.id, ts);
    if (!model) return null;
    rules = selectionRuleSummary(model, {
      allowRepeats: ts.allowRepeats,
      multi: tool.id === "sampler"
    });
  } else if (tool.id === "dice" && ts.diceMode === "expression") {
    const expression = String(ts.diceExpression || "").replace(/\s+/g, "").toLowerCase();
    rules.push("Expression");
    if (/(kh|kl|dh|dl)\d+/.test(expression)) rules.push("Keep/drop");
    if (/r(?:<=|>=|!=|=|<|>)?\d+/.test(expression)) rules.push("Reroll");
    if (/!/.test(expression)) rules.push("Explode");
    if (expression === "2d20kh1") rules.unshift("Advantage");
    if (expression === "2d20kl1") rules.unshift("Disadvantage");
  } else if (tool.id === "number") {
    if (ts.numberMode === "decimal") rules.push(ts.numberPrecision + " decimals");
    if (ts.numberCount > 1) rules.push(ts.numberCount + " values");
    if (ts.numberUnique && ts.numberCount > 1) rules.push("Unique");
  } else if (constraintTools.has(tool.id)) {
    const active = (ts.rules || []).filter((rule) => rule.enabled !== false);
    const required = active.filter((rule) => rule.strength !== "soft").length;
    const preferred = active.filter((rule) => rule.strength === "soft").length;
    if (required) rules.push(required + " required");
    if (preferred) rules.push(preferred + " prefer");
    if (active.length) rules.push(
      (ts.solverEffort || "automatic")[0].toUpperCase()
      + (ts.solverEffort || "automatic").slice(1)
    );
  }

  if (!rules.length) return null;

  return node("div", {
    class: "tool-rule-strip",
    "aria-label": "Active rules"
  }, rules.map((rule) =>
    node("span", { class: "rule-chip", text: rule })
  ));
}

function dieTrace(die) {
  const parts = die.chain.map((part) => {
    if (part.attempts.length <= 1) return String(part.value);
    return part.attempts.join("→");
  });
  const text = parts.join(" + ");
  return die.chain.length > 1 ? text + " = " + die.total : text;
}

function diceExpressionBreakdown(result) {
  return node("div", {
    class: "dice-expression-groups",
    "aria-label": "Dice roll breakdown"
  }, result.diceGroups.map((group) =>
    node("section", { class: "dice-group-card" }, [
      node("div", { class: "dice-group-head" }, [
        node("strong", { text: group.notation }),
        node("span", { text: "Subtotal " + group.value })
      ]),
      node("div", { class: "dice-traces" },
        group.dice.map((die) =>
          node("span", {
            class: "dice-trace" + (die.kept ? "" : " is-dropped"),
            title: die.kept ? "Kept die" : "Dropped die",
            text: dieTrace(die)
          })
        )
      )
    ])
  ));
}

function diceModeControl(tool, ts) {
  return node("div", {
    class: "segmented dice-mode",
    "aria-label": "Dice mode"
  }, [
    node("button", {
      class: ts.diceMode === "quick" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.diceMode = "quick";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Quick"),
    node("button", {
      class: ts.diceMode === "expression" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.diceMode = "expression";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Expression")
  ]);
}

function dicePresetRow(tool, ts, presets) {
  return node("div", {
    class: "dice-presets",
    "aria-label": "Dice presets"
  }, presets.map((preset) =>
    node("button", {
      class: "dice-preset",
      type: "button",
      onClick: () => {
        if (preset.expression) {
          ts.diceMode = "expression";
          ts.diceExpression = preset.expression;
        } else {
          ts.diceMode = "quick";
          ts.diceCount = preset.count;
          ts.diceSides = preset.sides;
        }
        invalidateTool(tool.id, ts);
        render();
      }
    }, preset.label)
  ));
}

function diceExpressionEditor(tool, ts) {
  const wrap = node("div", { class: "dice-expression-editor" });
  const input = node("input", {
    class: "field dice-expression-input",
    type: "text",
    value: ts.diceExpression,
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": "Dice expression",
    placeholder: "e.g. 4d6kh3+2"
  });

  input.addEventListener("input", () => {
    ts.diceExpression = input.value;
    invalidateTool(tool.id, ts);
  });
  input.addEventListener("change", render);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      ts.diceExpression = input.value;
      runTool(tool.id);
    }
  });

  wrap.append(node("div", { class: "control" }, [
    node("label", { text: "Expression" }),
    input
  ]));

  const presets = [
    { label: "D20", expression: "1d20" },
    { label: "2D6", expression: "2d6" },
    { label: "D100", expression: "1d100" },
    { label: "Advantage", expression: "2d20kh1" },
    { label: "Disadvantage", expression: "2d20kl1" },
    { label: "4D6 keep 3", expression: "4d6kh3" },
    { label: "Exploding D6", expression: "1d6!" },
    { label: "Reroll 1s", expression: "4d6r=1" }
  ];
  wrap.append(dicePresetRow(tool, ts, presets));

  try {
    const description = describeDiceExpression(ts.diceExpression);
    wrap.append(node("div", { class: "dice-expression-preview" }, [
      node("strong", { text: description.canonical }),
      ...description.groups.map((group) =>
        node("span", { text: group })
      )
    ]));
  } catch (error) {
    wrap.append(node("div", {
      class: "dice-expression-preview is-invalid",
      text: error?.message || "Expression is incomplete."
    }));
  }

  wrap.append(node("button", {
    class: "dice-help-toggle",
    type: "button",
    "aria-expanded": String(Boolean(ts.diceHelpOpen)),
    onClick: () => {
      ts.diceHelpOpen = !ts.diceHelpOpen;
      render();
    }
  }, ts.diceHelpOpen ? "Hide notation help" : "Notation help"));

  if (ts.diceHelpOpen) {
    wrap.append(node("div", { class: "dice-help" }, [
      node("div", { text: "NdS — roll N dice with S sides" }),
      node("div", { text: "kh / kl — keep highest / lowest" }),
      node("div", { text: "dh / dl — drop highest / lowest" }),
      node("div", { text: "r<2, r=1 — reroll while condition matches" }),
      node("div", { text: "! — explode on the maximum face" }),
      node("div", { text: "!>=5 — explode on a custom condition" }),
      node("div", { text: "+ - * / and parentheses — arithmetic composition" })
    ]));
  }

  return wrap;
}

function diceHistoryPanel(ts) {
  if (!ts.diceHistory?.length) return null;

  return node("section", { class: "dice-history" }, [
    node("div", { class: "dice-history-head" }, [
      node("strong", { text: "Recent rolls" }),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => {
          ts.diceHistory = [];
          render();
        }
      }, "Clear")
    ]),
    ...ts.diceHistory.map((entry) =>
      node("div", { class: "dice-history-row" }, [
        node("span", { text: entry.label }),
        node("strong", { text: String(entry.total) })
      ])
    )
  ]);
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
    if (ts.diceMode === "expression") {
      wrap.append(
        node("div", {
          class: "stage-label",
          text: result ? result.expression : "Dice expression"
        }),
        node("div", {
          class: "stage-result",
          text: result ? String(result.total) : "ROLL"
        }),
        node("div", {
          class: "stage-sub dice-expression-source",
          text: result ? result.canonical : ts.diceExpression
        }),
        result?.diceGroups?.length
          ? diceExpressionBreakdown(result)
          : null
      );
    } else {
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
    }
  } else if (tool.id === "number") {
    if (result?.displayValues?.length > 1) {
      wrap.append(
        node("div", { class: "stage-label", text: "Random numbers" }),
        node("div", {
          class: "stage-result",
          text: result.count + " VALUES",
          style: { fontSize: "clamp(36px,9vw,58px)" }
        }),
        resultList(result.displayValues)
      );
    } else {
      wrap.append(
        node("div", { class: "stage-label", text: "Random number" }),
        node("div", {
          class: "stage-result",
          text: result?.displayValues?.[0] || "GENERATE"
        }),
        node("div", {
          class: "stage-sub",
          text: ts.numberMode === "decimal"
            ? "Uniform " + ts.numberPrecision + "-decimal grid"
            : "Uniform integer"
        })
      );
    }
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

  const sourceOptions = [
    node("option", { value: "", text: "Temporary list / current run" })
  ];

  for (const pool of state.pools.filter((item) => !item.archived)) {
    sourceOptions.push(node("option", {
      value: "pool:" + pool.id,
      text: pool.name + " · " + poolStats(pool).active + " active"
    }));

    for (const view of poolViewsFor(pool.id)) {
      sourceOptions.push(node("option", {
        value: "view:" + view.id,
        text: "↳ " + view.name + " · View"
      }));
    }
  }

  const poolSelect = node("select", {
    class: "field",
    "aria-label": "Input source"
  }, sourceOptions);

  if (ts.workingSet?.source?.viewId) {
    poolSelect.value = "view:" + ts.workingSet.source.viewId;
  } else if (ts.workingSet?.source?.poolId) {
    poolSelect.value = "pool:" + ts.workingSet.source.poolId;
  }

  poolSelect.addEventListener("change", () => {
    const value = poolSelect.value;

    if (!value) {
      ts.workingSet = null;
      ts.workingSetDirty = true;
      render();
      return;
    }

    if (value.startsWith("pool:")) {
      const pool = poolById(value.slice(5));
      if (!pool) return;
      applyWorkingSetToTool(tool.id, ts, createWorkingSet(pool));
      ts.workingSetDirty = false;
      render();
      return;
    }

    if (value.startsWith("view:")) {
      const view = state.poolViews.find((candidate) => candidate.id === value.slice(5));
      const pool = view ? poolById(view.poolId) : null;
      if (!pool || !view) return;
      const workingSet = workingSetFromView(pool, view);
      workingSet.source.viewId = view.id;
      workingSet.source.viewName = view.name;
      applyWorkingSetToTool(tool.id, ts, workingSet);
      ts.workingSetDirty = false;
      render();
    }
  });

  const textarea = node("textarea", {
    class: "field",
    "aria-label": tool.name + " entries",
    placeholder: "One option per line"
  });
  textarea.value = ts.listText;
  textarea.addEventListener("input", () => {
    ts.listText = textarea.value;
    ts.workingSetDirty = Boolean(ts.workingSet);
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
    invalidateTool(tool.id, ts);
  });
  textarea.addEventListener("change", render);

  const sourceControl = node("div", {
    class: "control",
    style: { marginBottom: "10px" }
  }, [
    node("label", { text: "Source" }),
    poolSelect
  ]);

  if (ts.workingSet?.source) {
    const source = ts.workingSet.source;
    const latestPool = poolById(source.poolId);
    const stale = latestPool && latestPool.revision !== source.revision;

    sourceControl.append(node("div", {
      class: "working-set-source" + (ts.workingSetDirty ? " is-dirty" : "")
    }, [
      node("div", { class: "working-set-copy" }, [
        node("strong", {
          text: source.viewName
            ? source.name + " / " + source.viewName
            : source.name
        }),
        node("span", {
          text:
            "Copied from revision " + source.revision
            + (ts.workingSetDirty ? " · edited for this run" : "")
            + (stale ? " · source updated" : "")
        })
      ]),
      node("div", { class: "working-set-actions" }, [
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => openPoolEditor(source.poolId)
        }, "Edit source"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            const pool = poolById(source.poolId);
            if (!pool) return;
            if (source.viewId) {
              const view = state.poolViews.find((item) => item.id === source.viewId);
              if (!view) return;
              const workingSet = workingSetFromView(pool, view);
              workingSet.source.viewId = view.id;
              workingSet.source.viewName = view.name;
              applyWorkingSetToTool(tool.id, ts, workingSet);
            } else {
              applyWorkingSetToTool(tool.id, ts, createWorkingSet(pool));
            }
            ts.workingSetDirty = false;
            render();
          }
        }, "Refresh"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            ts.workingSet = null;
            ts.workingSetDirty = true;
            render();
          }
        }, "Detach")
      ])
    ]));
  }

  const runControl = node("div", {
    class: "control",
    style: { marginBottom: "12px" }
  }, [
    node("div", { class: "control-label-row" }, [
      node("label", { text: "Entries — this run" }),
      node("button", {
        class: "text-action",
        type: "button",
        onClick: () => {
          state.modal = {
            type: "save-tool-pool",
            toolId: tool.id,
            name: "",
            kind: tool.id === "teams" || tool.id === "groups" || tool.id === "pairs"
              ? "people"
              : "choices"
          };
          render();
        }
      }, "Save as Pool")
    ]),
    textarea
  ]);

  wrap.append(sourceControl, runControl);
  return wrap;
}
function updateSelectionEntry(ts, key, patch) {
  const entry = (ts.selectionEntries || []).find((candidate) => candidate.key === key);
  if (!entry) return;
  Object.assign(entry, patch);
}

function selectionRulesControl(tool, ts) {
  reconcileToolSelection(tool.id, ts);

  let model;
  let modelError = null;
  try {
    model = normalizeSelection(parseList(ts.listText), ts.selectionEntries);
  } catch (error) {
    modelError = error?.message || "Selection rules are invalid.";
    model = {
      entries: ts.selectionEntries.map((entry, index) => ({
        ...entry,
        index,
        probability: 0,
        eligible: false
      })),
      customWeights: true,
      excludedCount: ts.selectionEntries.filter((entry) => entry.excluded).length,
      zeroWeightCount: 0
    };
  }

  const rules = modelError
    ? ["Invalid weights"]
    : selectionRuleSummary(model, {
        allowRepeats: ts.allowRepeats,
        multi: tool.id === "sampler"
      });

  const section = node("section", { class: "selection-rules" });
  section.append(node("button", {
    class: "selection-rules-toggle",
    type: "button",
    "aria-expanded": String(Boolean(ts.selectionOpen)),
    onClick: () => {
      ts.selectionOpen = !ts.selectionOpen;
      render();
    }
  }, [
    node("span", { text: "Selection rules" }),
    node("span", {
      class: "selection-rule-summary",
      text: rules.length ? rules.join(" • ") : "Equal chances"
    }),
    node("span", {
      class: "selection-chevron",
      text: ts.selectionOpen ? "−" : "+"
    })
  ]));

  if (!ts.selectionOpen) return section;

  if (modelError) {
    section.append(toolError(modelError));
  }

  const toolbar = node("div", { class: "selection-toolbar" }, [
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        ts.selectionEntries = ts.selectionEntries.map((entry) => ({
          ...entry,
          weight: 1
        }));
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Equalize"),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        ts.selectionEntries = ts.selectionEntries.map((entry) => ({
          ...entry,
          weight: 1,
          excluded: false
        }));
        ts.allowRepeats = false;
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Reset")
  ]);

  if (tool.id === "sampler") {
    const repeat = node("input", {
      type: "checkbox",
      checked: ts.allowRepeats,
      "aria-label": "Allow repeated winners"
    });
    repeat.addEventListener("change", () => {
      ts.allowRepeats = repeat.checked;
      invalidateTool(tool.id, ts);
      render();
    });
    toolbar.prepend(node("label", { class: "repeat-toggle" }, [
      repeat,
      node("span", { text: "Allow repeats" })
    ]));
  }

  section.append(toolbar);

  const table = node("div", {
    class: "weight-table",
    role: "table",
    "aria-label": "Entry weights and probabilities"
  });

  for (const entry of model.entries) {
    const exclude = node("input", {
      type: "checkbox",
      checked: entry.excluded,
      "aria-label": "Exclude " + entry.label
    });
    exclude.addEventListener("change", () => {
      updateSelectionEntry(ts, entry.key, { excluded: exclude.checked });
      invalidateTool(tool.id, ts);
      render();
    });

    const weight = node("input", {
      class: "weight-input",
      type: "number",
      min: "0",
      step: "0.1",
      value: String(entry.weight),
      "aria-label": "Weight for " + entry.label,
      disabled: entry.excluded ? "disabled" : null
    });
    weight.addEventListener("change", () => {
      const value = Number(weight.value);
      updateSelectionEntry(ts, entry.key, { weight: value });
      invalidateTool(tool.id, ts);
      render();
    });

    const status = entry.excluded
      ? "Excluded"
      : percentage(entry.probability);

    table.append(node("div", {
      class: "weight-row" + (entry.excluded ? " is-excluded" : ""),
      role: "row"
    }, [
      node("label", { class: "exclude-cell" }, [
        exclude,
        node("span", { class: "sr-only", text: "Exclude" })
      ]),
      node("div", { class: "weight-label", role: "cell" }, [
        node("strong", { text: entry.label }),
        node("small", {
          text: entry.weight === 0 && !entry.excluded
            ? "Weight 0 — cannot be selected"
            : "Entry " + (entry.index + 1)
        })
      ]),
      node("div", { class: "weight-control", role: "cell" }, [
        node("span", { class: "weight-caption", text: "Weight" }),
        weight
      ]),
      node("output", {
        class: "probability-cell",
        role: "cell",
        text: status
      })
    ]));
  }

  section.append(table);
  return section;
}

function ruleTypeLabel(type) {
  return ({
    together: "Keep together",
    apart: "Keep apart",
    fixed: "Fixed placement",
    capacity: "Capacity",
    requiredTag: "Required tag",
    maxTag: "Maximum tag",
    balanceField: "Balance numeric field",
    historyAvoid: "Avoid recent pairings"
  })[type] || type;
}

function openAddRuleModal(tool, ts) {
  const { context } = constraintValidation(tool, ts);
  const types = ruleTypesForTool(tool.id);
  const firstType = types[0] || "apart";

  state.modal = {
    type: "add-rule",
    toolId: tool.id,
    ruleType: firstType,
    strength: ["balanceField", "historyAvoid"].includes(firstType)
      ? "soft"
      : "hard",
    priority: 10,
    itemA: context.items[0]?.id || "",
    itemB: context.items[1]?.id || context.items[0]?.id || "",
    targetId: context.targets[0]?.id || "",
    tag: "",
    count: 1,
    max: Math.max(1, context.targets[0]?.capacity || 2),
    fieldId: context.fields.find((field) => field.type === "number")?.id || "",
    depth: 5,
    error: null
  };
  render();
}

function constraintRulesControl(tool, ts) {
  const { context, validation } = constraintValidation(tool, ts);
  const active = (ts.rules || []).filter((rule) => rule.enabled !== false);
  const required = active.filter((rule) => rule.strength !== "soft").length;
  const preferred = active.filter((rule) => rule.strength === "soft").length;

  const section = node("section", { class: "constraint-rules" });
  section.append(node("button", {
    class: "selection-rules-toggle",
    type: "button",
    "aria-expanded": String(Boolean(ts.rulesOpen)),
    onClick: () => {
      ts.rulesOpen = !ts.rulesOpen;
      render();
    }
  }, [
    node("span", { text: "Rules & balance" }),
    node("span", {
      class: "selection-rule-summary",
      text: active.length
        ? [
            required ? required + " required" : null,
            preferred ? preferred + " prefer" : null,
            (ts.solverEffort || "automatic")
          ].filter(Boolean).join(" • ")
        : "No constraints"
    }),
    node("span", {
      class: "selection-chevron",
      text: ts.rulesOpen ? "−" : "+"
    })
  ]));

  if (!ts.rulesOpen) return section;

  const effort = node("select", {
    class: "field solver-effort-select",
    "aria-label": "Solver effort"
  }, [
    node("option", { value: "fast", text: "Fast" }),
    node("option", { value: "automatic", text: "Automatic" }),
    node("option", { value: "thorough", text: "Thorough" })
  ]);
  effort.value = ts.solverEffort || "automatic";
  effort.addEventListener("change", () => {
    ts.solverEffort = effort.value;
    invalidateTool(tool.id, ts);
  });

  section.append(node("div", { class: "constraint-toolbar" }, [
    node("div", { class: "constraint-effort" }, [
      node("span", { text: "Search effort" }),
      effort
    ]),
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => openAddRuleModal(tool, ts)
    }, "+ Add rule"),
    ts.rules.length
      ? node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            ts.rules = [];
            invalidateTool(tool.id, ts);
            render();
          }
        }, "Clear")
      : null
  ]));

  if (validation.errors.length) {
    section.append(node("div", { class: "constraint-validation is-error" }, [
      node("strong", { text: "Rules cannot run yet" }),
      ...validation.errors.slice(0, 6).map((error) =>
        node("span", { text: error.message })
      )
    ]));
  }

  if (validation.warnings.length) {
    section.append(node("div", { class: "constraint-validation is-warning" }, [
      node("strong", { text: "Warnings" }),
      ...validation.warnings.slice(0, 4).map((warning) =>
        node("span", { text: warning.message })
      )
    ]));
  }

  if (!ts.rules.length) {
    section.append(node("div", { class: "constraint-empty" }, [
      node("strong", { text: "No rules yet" }),
      node("span", {
        text: context.fields.some((field) => field.type === "number")
          ? "Add hard constraints or soft preferences. Numeric Pool fields can also be balanced."
          : "Add together/apart/fixed/capacity rules. Pool tags and numeric fields unlock metadata rules."
      })
    ]));
    return section;
  }

  const list = node("div", { class: "constraint-rule-list" });

  for (const rule of ts.rules) {
    const enabled = node("input", {
      type: "checkbox",
      checked: rule.enabled !== false,
      "aria-label": "Enable " + ruleTypeLabel(rule.type)
    });
    enabled.addEventListener("change", () => {
      rule.enabled = enabled.checked;
      invalidateTool(tool.id, ts);
      render();
    });

    const strength = node("select", {
      class: "constraint-strength",
      "aria-label": "Rule strength"
    }, [
      node("option", { value: "hard", text: "Required" }),
      node("option", { value: "soft", text: "Prefer" })
    ]);
    strength.value = rule.strength === "soft" ? "soft" : "hard";
    strength.addEventListener("change", () => {
      rule.strength = strength.value;
      invalidateTool(tool.id, ts);
      render();
    });

    const ruleErrors = validation.errors.filter((error) => error.ruleId === rule.id);

    list.append(node("article", {
      class:
        "constraint-rule-card"
        + (rule.enabled === false ? " is-disabled" : "")
        + (ruleErrors.length ? " is-invalid" : "")
    }, [
      node("label", { class: "constraint-rule-enabled" }, [enabled]),
      node("div", { class: "constraint-rule-copy" }, [
        node("strong", { text: summarizeRule(rule, context) }),
        node("span", {
          text:
            ruleTypeLabel(rule.type)
            + " · "
            + ruleStrengthLabel(rule)
            + (rule.strength === "soft" ? " · priority " + rule.priority : "")
        }),
        ...ruleErrors.map((error) =>
          node("small", { class: "rule-error-copy", text: error.message })
        )
      ]),
      strength,
      node("button", {
        class: "small-action",
        type: "button",
        "aria-label": "Remove rule",
        onClick: () => {
          ts.rules = ts.rules.filter((candidate) => candidate.id !== rule.id);
          invalidateTool(tool.id, ts);
          render();
        }
      }, "×")
    ]));
  }

  section.append(list);
  return section;
}

function genericFairnessDescription(tool, ts) {
  switch (tool.id) {
    case "coin":
      return ["Uniform binary choice", "Heads and Tails each have a 50% chance."];
    case "dice":
      if (ts.diceMode === "expression") {
        return [
          "Dice expression",
          "Every physical die roll is uniform over its faces. Rerolls and explosions create additional uniform rolls; keep/drop and arithmetic are deterministic post-processing. The final total is therefore not generally uniform."
        ];
      }
      return ["Uniform dice", "Every face on each D" + ts.diceSides + " has equal probability."];
    case "number":
      if (ts.numberMode === "decimal") {
        return [
          "Uniform decimal grid",
          "Values are selected uniformly from the inclusive fixed-precision grid at " + ts.numberPrecision + " decimal places."
            + (ts.numberUnique && ts.numberCount > 1
              ? " Multiple draws are sampled without replacement."
              : "")
        ];
      }
      return [
        ts.numberUnique && ts.numberCount > 1 ? "Uniform unique integers" : "Uniform integer",
        "Every whole number in the configured inclusive range has equal probability."
          + (ts.numberUnique && ts.numberCount > 1
            ? " Multiple draws are sampled without replacement."
            : "")
      ];
    case "shuffle":
      return ["Uniform shuffle", "Uses Fisher–Yates over the current entries."];
    case "teams":
    case "groups":
      return ["Random partition", "Entries are shuffled, then distributed round-robin so group sizes differ by at most one."];
    case "pairs":
      return ["Random pairing", "Entries are shuffled, then paired in order. An odd final entry is unmatched."];
    case "assignment":
      return ["Random assignment", "Sources and targets are shuffled independently, then targets are distributed as evenly as possible."];
    case "ladder":
      return ["Random permutation", "The ladder topology encodes a uniformly shuffled outcome permutation."];
    case "tournament":
      return ["Random draw", "Entrants are shuffled before first-round slots and required byes are assigned."];
    case "secret-santa":
      return ["Random valid assignment", "A derangement is generated so every person gives to exactly one different person."];
    case "elimination":
      return ["Uniform elimination", "Each remaining entrant has equal probability of being eliminated on the next draw."];
    case "cards":
      return ["Shuffled deck", "A 52-card deck is Fisher–Yates shuffled once, then drawn without replacement."];
    case "chance":
      return ["Configured Bernoulli chance", "YES uses the exact configured " + ts.chance + "% probability."];
    case "lottery":
      return ["Uniform sample", "Numbers are sampled without replacement, so every valid set is drawn from the same uniform process."];
    case "color":
      return ["Uniform 24-bit color", "Each HEX value from #000000 through #FFFFFF is equally likely."];
    case "date":
      return ["Uniform calendar day", "Each included calendar date has equal probability."];
    case "time":
      return ["Uniform minute", "Each minute in the configured window has equal probability."];
    case "coordinate":
      return ["Uniform grid point", "X and Y are independently uniform over their inclusive integer ranges."];
    case "direction":
      return ["Uniform compass direction", "Each of the eight directions has a 12.5% chance."];
    case "letter":
      return ["Uniform letter", "Each letter A–Z has a 1/26 chance."];
    case "rps":
      return ["Uniform RPS", "Rock, Paper, and Scissors each have a 1/3 chance."];
    default:
      return ["Randomized operation", "This tool uses the registered Random Core operation for its result."];
  }
}

function fairnessPanel(tool, ts) {
  const open = Boolean(ts.fairnessOpen);
  const panel = node("section", { class: "fairness-panel" });
  const modeTitle = state.settings.randomness.mode === "seeded"
    ? "Seeded deterministic"
    : "Secure random";
  const modeCopy = state.settings.randomness.mode === "seeded"
    ? "Reproducible from the seed and sequence position. Predictable to anyone who knows them; this is not secure randomness."
    : "Uses Web Crypto as the entropy source. This describes the random source, not a proof that a host or modified app cannot manipulate a setup.";

  panel.append(node("button", {
    class: "fairness-toggle",
    type: "button",
    "aria-expanded": String(open),
    onClick: () => {
      ts.fairnessOpen = !ts.fairnessOpen;
      render();
    }
  }, [
    node("span", { class: "fairness-icon", text: "◎", "aria-hidden": "true" }),
    node("span", { class: "fairness-toggle-copy" }, [
      node("strong", { text: "Fairness" }),
      node("small", { text: modeTitle })
    ]),
    node("span", { text: open ? "−" : "+" })
  ]));

  if (!open) return panel;

  panel.append(node("div", { class: "fairness-body" }, [
    node("div", { class: "fairness-method" }, [
      node("strong", { text: modeTitle }),
      node("p", { text: modeCopy })
    ])
  ]));

  if (selectionTools.has(tool.id)) {
    const model = currentSelectionModel(tool.id, ts);
    if (model) {
      const selectionTitle = model.customWeights
        ? "Weighted selection"
        : "Equal effective chances";
      let selectionCopy =
        model.eligibleCount + " of " + model.entries.length + " entries are eligible. ";
      if (tool.id === "sampler" && ts.allowRepeats) {
        selectionCopy += "Every draw uses the displayed probabilities and selected entries remain eligible.";
      } else if (tool.id === "sampler") {
        selectionCopy += "Displayed percentages are first-draw chances; after each winner, that entry is removed and the remaining weights renormalize.";
      } else {
        selectionCopy += "Probability equals effective weight divided by total eligible weight.";
      }

      panel.querySelector(".fairness-body").append(
        node("div", { class: "fairness-method" }, [
          node("strong", { text: selectionTitle }),
          node("p", { text: selectionCopy })
        ]),
        node("div", { class: "fairness-probabilities" },
          model.entries.map((entry) =>
            node("div", {
              class: "fairness-probability-row" + (!entry.eligible ? " is-ineligible" : "")
            }, [
              node("span", { text: entry.label }),
              node("strong", {
                text: entry.excluded ? "Excluded" : percentage(entry.probability)
              })
            ])
          )
        )
      );
    }
  } else {
    const [title, copy] = genericFairnessDescription(tool, ts);
    panel.querySelector(".fairness-body").append(
      node("div", { class: "fairness-method" }, [
        node("strong", { text: title }),
        node("p", { text: copy })
      ])
    );
  }

  return panel;
}

function numberModeControl(tool, ts) {
  return node("div", {
    class: "segmented number-mode",
    "aria-label": "Number mode"
  }, [
    node("button", {
      class: ts.numberMode === "integer" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.numberMode = "integer";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Integer"),
    node("button", {
      class: ts.numberMode === "decimal" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.numberMode = "decimal";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Decimal")
  ]);
}

function numberPresetRow(tool, ts) {
  const presets = [
    { label: "1–10", mode: "integer", min: 1, max: 10, count: 1 },
    { label: "1–100", mode: "integer", min: 1, max: 100, count: 1 },
    { label: "3 unique", mode: "integer", min: 1, max: 100, count: 3, unique: true },
    { label: "0.00–1.00", mode: "decimal", min: 0, max: 1, count: 1, precision: 2 }
  ];

  return node("div", { class: "dice-presets number-presets" },
    presets.map((preset) =>
      node("button", {
        class: "dice-preset",
        type: "button",
        onClick: () => {
          ts.numberMode = preset.mode;
          ts.numberMin = preset.min;
          ts.numberMax = preset.max;
          ts.numberCount = preset.count;
          ts.numberUnique = Boolean(preset.unique);
          if (preset.precision) ts.numberPrecision = preset.precision;
          invalidateTool(tool.id, ts);
          render();
        }
      }, preset.label)
    )
  );
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

    if (selectionTools.has(tool.id)) {
      controls.append(selectionRulesControl(tool, ts));
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
    controls.append(diceModeControl(tool, ts));

    if (ts.diceMode === "expression") {
      controls.append(diceExpressionEditor(tool, ts));
    } else {
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
      controls.append(dicePresetRow(tool, ts, [
        { label: "D6", count: 1, sides: 6 },
        { label: "D20", count: 1, sides: 20 },
        { label: "2D6", count: 2, sides: 6 },
        { label: "D100", count: 1, sides: 100 }
      ]));
    }

    const recent = diceHistoryPanel(ts);
    if (recent) controls.append(recent);
  } else if (tool.id === "number") {
    controls.append(numberModeControl(tool, ts));

    grid.append(
      numberControl(
        "Minimum", "number-min", ts.numberMin, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "numberMin", value)
      ),
      numberControl(
        "Maximum", "number-max", ts.numberMax, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "numberMax", value)
      ),
      numberControl(
        "How many", "number-count", ts.numberCount, 1, 100,
        (value) => configSetter(tool.id, ts, "numberCount", value)
      )
    );

    if (ts.numberMode === "decimal") {
      grid.append(numberControl(
        "Decimal places", "number-precision", ts.numberPrecision, 1, 6,
        (value) => configSetter(tool.id, ts, "numberPrecision", value)
      ));
    }

    controls.append(grid);

    if (ts.numberCount > 1) {
      const unique = node("input", {
        type: "checkbox",
        checked: ts.numberUnique,
        "aria-label": "Require unique generated numbers"
      });
      unique.addEventListener("change", () => {
        ts.numberUnique = unique.checked;
        invalidateTool(tool.id, ts);
        render();
      });
      controls.append(node("label", { class: "number-unique-toggle" }, [
        unique,
        node("span", { text: "No duplicate values" })
      ]));
    }

    controls.append(numberPresetRow(tool, ts));
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

  controls.append(fairnessPanel(tool, ts));

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

  if (selectionTools.has(id)) {
    reconcileToolSelection(id, ts);
  }

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

    if (id === "dice") {
      const label = result.mode === "expression"
        ? result.expression
        : ts.diceCount + "d" + ts.diceSides;
      ts.diceHistory = [
        {
          label,
          total: result.total,
          mode: result.mode,
          timestamp: Date.now()
        },
        ...(ts.diceHistory || [])
      ].slice(0, 10);
    }

    if (id === "ladder") {
      ts.ladder = output.detail?.ladder || null;
    }

    let animationDuration = 0;

    if (id === "wheel") {
      const index = output.detail.selectedIndex;
      const model = normalizeSelection(config.items, config.selectionEntries || []);
      const segment = wheelSegmentForIndex(model, index);
      const desired = (360 - segment.center) % 360;
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

  let text = tool.name + ": " + summarizeResult(tool.id, ts.result);

  if (selectionTools.has(tool.id)) {
    const model = currentSelectionModel(tool.id, ts);
    if (model) {
      const rules = selectionRuleSummary(model, {
        allowRepeats: ts.allowRepeats,
        multi: tool.id === "sampler"
      });
      if (rules.length) text += " · " + rules.join(" · ");
    }
  }

  text += state.settings.randomness.mode === "seeded"
    ? " · Seeded"
    : " · Secure Random";

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
    if (result.mode === "expression") {
      return result.expression + " = " + result.total;
    }
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

function poolEditorFieldInput(field, item, editor) {
  const current = item.values?.[field.id];

  if (field.type === "boolean") {
    const select = node("select", {
      class: "pool-cell-input",
      "aria-label": field.name + " for " + item.label
    }, [
      node("option", { value: "", text: "—" }),
      node("option", { value: "true", text: "Yes" }),
      node("option", { value: "false", text: "No" })
    ]);
    select.value = current === true ? "true" : current === false ? "false" : "";
    select.addEventListener("change", () => {
      item.values[field.id] = select.value === ""
        ? ""
        : select.value === "true";
    });
    return select;
  }

  const input = node("input", {
    class: "pool-cell-input",
    type: field.type === "number" ? "number" : "text",
    value: current ?? "",
    placeholder: field.name,
    "aria-label": field.name + " for " + item.label
  });
  input.addEventListener("input", () => {
    item.values[field.id] = field.type === "number"
      ? (input.value === "" ? "" : Number(input.value))
      : input.value;
  });
  return input;
}

function renderPoolEditorModal(modal, editor) {
  const draft = editor.draft;
  const stats = poolStats(draft);
  const duplicates = duplicateSummary(draft);
  modal.classList.add("pool-editor-modal");

  const titleInput = node("input", {
    class: "pool-title-input",
    value: draft.name,
    "aria-label": "Pool name"
  });
  titleInput.addEventListener("input", () => {
    draft.name = titleInput.value;
  });

  const description = node("textarea", {
    class: "field pool-description-input",
    placeholder: "Optional description",
    "aria-label": "Pool description"
  });
  description.value = draft.description;
  description.addEventListener("input", () => {
    draft.description = description.value;
  });

  const kind = node("select", {
    class: "field",
    "aria-label": "Pool kind"
  }, ["generic", "people", "choices", "tasks", "cards"].map((value) =>
    node("option", { value, text: value[0].toUpperCase() + value.slice(1) })
  ));
  kind.value = draft.kind;
  kind.addEventListener("change", () => {
    draft.kind = kind.value;
  });

  modal.append(
    node("div", { class: "pool-editor-heading" }, [
      titleInput,
      node("span", {
        class: "pool-revision",
        text: "Revision " + editor.baseRevision
      })
    ]),
    description,
    node("div", { class: "pool-editor-meta" }, [
      kind,
      node("span", { text: stats.active + "/" + stats.total + " active" }),
      node("span", { text: stats.tags + " tags" }),
      node("span", { text: stats.fields + " fields" }),
      duplicates.groupCount
        ? node("span", {
            class: "warning",
            text: duplicates.groupCount + " duplicate groups"
          })
        : node("span", { text: "No duplicate labels" })
    ])
  );

  if (duplicates.groupCount) {
    modal.append(node("section", { class: "duplicate-review" }, [
      node("strong", { text: "Duplicate review" }),
      node("span", {
        text: "Duplicates are allowed and remain separate items with separate IDs."
      }),
      ...duplicates.groups.slice(0, 8).map((group) =>
        node("div", { class: "duplicate-review-row" }, [
          node("span", { text: group[0].label }),
          node("strong", { text: group.length + " copies" })
        ])
      )
    ]));
  }

  if (editor.error) modal.append(toolError(editor.error));

  const search = node("input", {
    class: "field",
    type: "search",
    placeholder: "Search labels, tags, and fields…",
    value: editor.search,
    "aria-label": "Search Pool items"
  });
  search.addEventListener("input", () => {
    editor.search = search.value;
  });
  search.addEventListener("change", render);

  const activeFilter = node("select", {
    class: "field",
    "aria-label": "Active item filter"
  }, [
    node("option", { value: "all", text: "All items" }),
    node("option", { value: "active", text: "Active only" }),
    node("option", { value: "inactive", text: "Inactive only" })
  ]);
  activeFilter.value = editor.active;
  activeFilter.addEventListener("change", () => {
    editor.active = activeFilter.value;
    render();
  });

  const tagFilter = node("input", {
    class: "field",
    type: "text",
    placeholder: "Filter tag",
    value: editor.tagFilter,
    "aria-label": "Filter Pool by tag"
  });
  tagFilter.addEventListener("change", () => {
    editor.tagFilter = tagFilter.value.trim();
    render();
  });

  modal.append(node("div", { class: "pool-filter-bar" }, [
    search,
    activeFilter,
    tagFilter,
    node("button", {
      class: "secondary",
      type: "button",
      onClick: async () => {
        try {
          await persistPoolDraft(editor);
          openPoolImport(draft.id);
        } catch (error) {
          editor.error = error?.message || "Could not save before import.";
          render();
        }
      }
    }, "Import")
  ]));

  const fieldsBox = node("section", { class: "pool-fields-box" }, [
    node("div", { class: "pool-section-head" }, [
      node("strong", { text: "Structured fields" }),
      node("span", {
        text: draft.fields.length
          ? "Custom data travels with each item."
          : "Optional metadata for future rules and balancing."
      })
    ])
  ]);

  if (draft.fields.length) {
    fieldsBox.append(node("div", { class: "field-chip-row" },
      draft.fields.map((field) =>
        node("span", { class: "field-chip" }, [
          node("span", { text: field.name + " · " + field.type }),
          node("button", {
            type: "button",
            "aria-label": "Remove field " + field.name,
            onClick: () => {
              draft.fields = draft.fields.filter((item) => item.id !== field.id);
              for (const poolItem of draft.items) {
                delete poolItem.values[field.id];
              }
              render();
            }
          }, "×")
        ])
      )
    ));
  }

  const newFieldName = node("input", {
    class: "field",
    placeholder: "Field name",
    "aria-label": "New field name"
  });
  const newFieldType = node("select", {
    class: "field",
    "aria-label": "New field type"
  }, ["text", "number", "boolean", "category"].map((value) =>
    node("option", { value, text: value })
  ));

  fieldsBox.append(node("div", { class: "field-add-row" }, [
    newFieldName,
    newFieldType,
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        try {
          draft.fields.push(createPoolField(newFieldName.value, newFieldType.value));
          render();
        } catch (error) {
          editor.error = error.message;
          render();
        }
      }
    }, "Add field")
  ]));
  modal.append(fieldsBox);

  const profileName = node("input", {
    class: "field",
    placeholder: "Weight profile name",
    "aria-label": "Weight profile name"
  });

  const profilesBox = node("section", { class: "pool-profiles-box" }, [
    node("div", { class: "pool-section-head" }, [
      node("strong", { text: "Weight profiles" }),
      node("span", {
        text: "Save reusable default-weight sets without changing other item data."
      })
    ]),
    node("div", { class: "pool-profile-create" }, [
      profileName,
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => {
          const name = profileName.value.trim();
          if (!name) {
            editor.error = "Weight profile name is required.";
            render();
            return;
          }
          draft.weightProfiles.push({
            id: crypto.randomUUID(),
            name,
            weights: Object.fromEntries(
              draft.items.map((item) => [item.id, item.weight])
            )
          });
          render();
        }
      }, "Save weights")
    ])
  ]);

  if (draft.weightProfiles.length) {
    profilesBox.append(node("div", { class: "pool-profile-list" },
      draft.weightProfiles.map((profile) =>
        node("div", { class: "pool-profile-item" }, [
          node("span", { text: profile.name }),
          node("button", {
            class: "small-action",
            type: "button",
            onClick: () => {
              draft.items.forEach((item) => {
                const value = Number(profile.weights?.[item.id]);
                if (Number.isFinite(value) && value >= 0) item.weight = value;
              });
              render();
            }
          }, "Apply"),
          node("button", {
            class: "small-action",
            type: "button",
            onClick: () => {
              draft.weightProfiles = draft.weightProfiles.filter(
                (item) => item.id !== profile.id
              );
              render();
            }
          }, "Remove")
        ])
      )
    ));
  }

  modal.append(profilesBox);

  const visibleIds = new Set(
    filterPoolItems(draft, {
      search: editor.search,
      active: editor.active,
      tags: editor.tagFilter ? [editor.tagFilter] : []
    }).map((item) => item.id)
  );
  const visible = draft.items.filter((item) => visibleIds.has(item.id));

  const selected = editor.selected;
  const bulkTag = node("input", {
    class: "field bulk-tag-input",
    placeholder: "Tag selected",
    "aria-label": "Tag selected items"
  });

  modal.append(node("div", { class: "pool-bulk-bar" }, [
    node("span", {
      text: selected.size + " selected · " + visible.length + " visible"
    }),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        visible.forEach((item) => selected.add(item.id));
        render();
      }
    }, "Select visible"),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        selected.clear();
        render();
      }
    }, "Clear"),
    node("button", {
      class: "small-action",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        draft.items.forEach((item) => {
          if (selected.has(item.id)) item.active = true;
        });
        render();
      }
    }, "Activate"),
    node("button", {
      class: "small-action",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        draft.items.forEach((item) => {
          if (selected.has(item.id)) item.active = false;
        });
        render();
      }
    }, "Deactivate"),
    bulkTag,
    node("button", {
      class: "small-action",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        const value = bulkTag.value.trim();
        if (!value) return;
        draft.items.forEach((item) => {
          if (selected.has(item.id) && !item.tags.includes(value)) {
            item.tags.push(value);
          }
        });
        render();
      }
    }, "Add tag"),
    node("button", {
      class: "small-action danger-lite",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        draft.items = draft.items.filter((item) => !selected.has(item.id));
        selected.clear();
        render();
      }
    }, "Remove")
  ]));

  const table = node("div", { class: "pool-editor-table" });
  for (const item of visible) {
    const selectItem = node("input", {
      type: "checkbox",
      checked: selected.has(item.id),
      "aria-label": "Select " + item.label
    });
    selectItem.addEventListener("change", () => {
      if (selectItem.checked) selected.add(item.id);
      else selected.delete(item.id);
    });

    const active = node("input", {
      type: "checkbox",
      checked: item.active,
      "aria-label": "Active " + item.label
    });
    active.addEventListener("change", () => {
      item.active = active.checked;
    });

    const label = node("input", {
      class: "pool-cell-input pool-label-input",
      value: item.label,
      "aria-label": "Item label"
    });
    label.addEventListener("input", () => {
      item.label = label.value;
    });

    const weight = node("input", {
      class: "pool-cell-input pool-weight-input",
      type: "number",
      min: "0",
      step: "0.1",
      value: String(item.weight),
      "aria-label": "Default weight for " + item.label
    });
    weight.addEventListener("change", () => {
      const value = Number(weight.value);
      item.weight = Number.isFinite(value) && value >= 0 ? value : 1;
      weight.value = String(item.weight);
    });

    const tags = node("input", {
      class: "pool-cell-input pool-tags-input",
      value: item.tags.join(", "),
      placeholder: "tags",
      "aria-label": "Tags for " + item.label
    });
    tags.addEventListener("change", () => {
      item.tags = Array.from(new Set(
        tags.value.split(",").map((tag) => tag.trim()).filter(Boolean)
      ));
    });

    table.append(node("div", {
      class: "pool-editor-row" + (!item.active ? " is-inactive" : ""),
      style: {
        gridTemplateColumns:
          "28px 28px minmax(130px,1.4fr) 80px minmax(120px,1fr) "
          + "minmax(100px,1fr) ".repeat(draft.fields.length)
          + "40px"
      }
    }, [
      node("label", { class: "pool-select-cell" }, [selectItem]),
      node("label", { class: "pool-active-cell" }, [
        active,
        node("span", { class: "sr-only", text: "Active" })
      ]),
      label,
      weight,
      tags,
      ...draft.fields.map((field) => poolEditorFieldInput(field, item, editor)),
      node("button", {
        class: "small-action",
        type: "button",
        "aria-label": "Remove " + item.label,
        onClick: () => {
          draft.items = draft.items.filter((candidate) => candidate.id !== item.id);
          selected.delete(item.id);
          render();
        }
      }, "×")
    ]));
  }

  if (!visible.length) {
    table.append(emptyState(
      "No items match",
      "Change the filters or add another item."
    ));
  }

  modal.append(table);

  const newItem = node("input", {
    class: "field",
    placeholder: "Add item…",
    "aria-label": "New Pool item"
  });
  const addItem = () => {
    try {
      draft.items.push(createPoolItem(newItem.value));
      render();
    } catch (error) {
      editor.error = error.message;
      render();
    }
  };
  newItem.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  });

  modal.append(node("div", { class: "pool-add-item-row" }, [
    newItem,
    node("button", {
      class: "secondary",
      type: "button",
      onClick: addItem
    }, "Add item")
  ]));

  const existingViews = poolViewsFor(draft.id);
  const viewName = node("input", {
    class: "field",
    placeholder: "View name",
    value: editor.viewName,
    "aria-label": "New View name"
  });
  viewName.addEventListener("input", () => {
    editor.viewName = viewName.value;
  });

  const viewsBox = node("section", { class: "pool-views-box" }, [
    node("div", { class: "pool-section-head" }, [
      node("strong", { text: "Views" }),
      node("span", {
        text: "Save this filter dynamically or freeze the selected item IDs."
      })
    ]),
    node("div", { class: "pool-view-create" }, [
      viewName,
      node("button", {
        class: "small-action",
        type: "button",
        onClick: async () => {
          try {
            await persistPoolDraft(editor);
            const view = createPoolView({
              name: editor.viewName,
              poolId: editor.draft.id,
              mode: "dynamic",
              filters: {
                search: editor.search,
                active: editor.active === "all" ? "active" : editor.active,
                tags: editor.tagFilter ? [editor.tagFilter] : []
              }
            });
            await put("poolViews", view);
            state.poolViews.push(view);
            editor.viewName = "";
            render();
          } catch (error) {
            editor.error = error.message;
            render();
          }
        }
      }, "Save filter"),
      node("button", {
        class: "small-action",
        type: "button",
        disabled: selected.size ? null : "disabled",
        onClick: async () => {
          try {
            await persistPoolDraft(editor);
            const view = createPoolView({
              name: editor.viewName,
              poolId: editor.draft.id,
              mode: "static",
              itemIds: [...selected]
            });
            await put("poolViews", view);
            state.poolViews.push(view);
            editor.viewName = "";
            render();
          } catch (error) {
            editor.error = error.message;
            render();
          }
        }
      }, "Save selected")
    ])
  ]);

  if (existingViews.length) {
    viewsBox.append(node("div", { class: "pool-view-list" },
      existingViews.map((view) =>
        node("div", { class: "pool-view-item" }, [
          node("span", {
            text: view.name + " · " + (view.mode === "static" ? "static" : "dynamic")
          }),
          node("span", {
            text: resolvePoolView(draft, view).length + " active items"
          }),
          node("button", {
            class: "small-action",
            type: "button",
            onClick: async () => {
              await remove("poolViews", view.id);
              state.poolViews = state.poolViews.filter((item) => item.id !== view.id);
              render();
            }
          }, "Remove")
        ])
      )
    ));
  }
  modal.append(viewsBox);

  modal.append(node("div", { class: "pool-editor-footer" }, [
    node("button", {
      class: "danger",
      type: "button",
      onClick: async () => {
        if (!confirm("Permanently delete “" + draft.name + "”? Existing tool WorkingSets keep their copied data, but the source Pool and its Views will be removed.")) {
          return;
        }
        await remove("pools", draft.id);
        const views = poolViewsFor(draft.id);
        await Promise.all(views.map((view) => remove("poolViews", view.id)));
        state.poolViews = state.poolViews.filter((view) => view.poolId !== draft.id);
        state.pools = state.pools.filter((pool) => pool.id !== draft.id);
        state.modal = null;
        render();
      }
    }, "Delete permanently"),
    node("span", { class: "pool-editor-footer-spacer" }),
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
        try {
          const saved = await persistPoolDraft(editor);
          announce(saved.name + " saved at revision " + saved.revision + ".");
          state.modal = null;
          render();
        } catch (error) {
          editor.error = error?.name === "RevisionConflictError"
            ? "This Pool changed elsewhere. Close the editor and reopen the latest revision."
            : error?.message || "Could not save Pool.";
          render();
        }
      }
    }, "Save Pool")
  ]));
}

function renderPoolImportModal(modal, importer) {
  modal.classList.add("pool-import-modal");
  const sourcePool = importer.poolId ? poolById(importer.poolId) : null;

  modal.append(
    node("h2", {
      text: sourcePool ? "Import into " + sourcePool.name : "Import Pool"
    }),
    node("p", {
      text: "Paste CSV, TSV, or semicolon-delimited data. Special columns: label/name, weight, active, tags. Other columns become structured text fields."
    })
  );

  if (importer.error) modal.append(toolError(importer.error));

  if (!sourcePool) {
    const name = node("input", {
      class: "field",
      value: importer.poolName,
      placeholder: "Pool name",
      "aria-label": "Imported Pool name"
    });
    name.addEventListener("input", () => {
      importer.poolName = name.value;
    });
    modal.append(name);
  }

  if (sourcePool) {
    const mode = node("select", {
      class: "field",
      "aria-label": "Import mode"
    }, [
      node("option", { value: "append", text: "Append to current items" }),
      node("option", { value: "replace", text: "Replace all current items" })
    ]);
    mode.value = importer.mode;
    mode.addEventListener("change", () => {
      importer.mode = mode.value;
    });
    modal.append(mode);
  }

  const header = node("select", {
    class: "field",
    "aria-label": "Header row"
  }, [
    node("option", { value: "auto", text: "Detect header automatically" }),
    node("option", { value: "yes", text: "First row is header" }),
    node("option", { value: "no", text: "No header row" })
  ]);
  header.value = importer.hasHeader;
  header.addEventListener("change", () => {
    importer.hasHeader = header.value;
    importer.preview = null;
  });

  const input = node("textarea", {
    class: "field pool-import-text",
    placeholder: "name,weight,active,tags\nAnna,2,true,leader\nBen,1,true,guest",
    "aria-label": "CSV or spreadsheet data"
  });
  input.value = importer.text;
  input.addEventListener("input", () => {
    importer.text = input.value;
    importer.preview = null;
  });

  const buildPreview = () => {
    try {
      const hasHeader = importer.hasHeader === "auto"
        ? null
        : importer.hasHeader === "yes";
      importer.preview = parseDelimitedText(importer.text, { hasHeader });
      importer.error = null;
      render();
    } catch (error) {
      importer.error = error.message;
      importer.preview = null;
      render();
    }
  };

  modal.append(
    node("div", { class: "pool-import-options" }, [header]),
    input,
    node("div", { class: "button-row" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: buildPreview
      }, "Preview import")
    ])
  );

  if (importer.preview) {
    const preview = importer.preview;
    modal.append(node("section", { class: "pool-import-preview" }, [
      node("strong", {
        text: preview.rows.length + " data rows · " + preview.headers.length + " columns"
      }),
      node("div", { class: "field-chip-row" },
        preview.headers.map((name) => node("span", { class: "field-chip", text: name }))
      ),
      node("div", { class: "import-preview-table" },
        preview.rows.slice(0, 5).map((row) =>
          node("div", { class: "import-preview-row" },
            row.map((value) => node("span", { text: value }))
          )
        )
      )
    ]));
  }

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
        try {
          const hasHeader = importer.hasHeader === "auto"
            ? null
            : importer.hasHeader === "yes";
          const parsed = parseDelimitedText(importer.text, { hasHeader });
          if (!parsed.rows.length) throw new Error("No import rows found.");

          let pool = sourcePool
            ? normalizePool(sourcePool)
            : createPool({ name: importer.poolName, items: [] });

          const special = new Set(["label", "name", "weight", "active", "tag", "tags"]);
          const fieldColumns = {};
          const fields = [...pool.fields];

          for (const headerName of parsed.headers) {
            if (special.has(headerName.toLocaleLowerCase())) continue;
            let field = fields.find((candidate) =>
              candidate.name.toLocaleLowerCase() === headerName.toLocaleLowerCase()
            );
            if (!field) {
              field = createPoolField(headerName, "text");
              fields.push(field);
            }
            fieldColumns[field.id] = headerName;
          }

          const items = importRowsToPoolItems(parsed, { fieldColumns });
          if (!items.length) throw new Error("No labeled items were found.");

          if (sourcePool) {
            const next = mutatePool(pool, (draft) => {
              draft.fields = fields;
              draft.items = importer.mode === "replace"
                ? items
                : [...draft.items, ...items];
            });
            await putWithRevision("pools", next, sourcePool.revision);
            state.pools = state.pools.map((item) => item.id === next.id ? next : item);
            state.modal = null;
            openPoolEditor(next.id);
          } else {
            pool = normalizePool({
              ...pool,
              fields,
              items,
              revision: 1
            });
            await put("pools", pool);
            state.pools.unshift(pool);
            requestPersistentStorage();
            state.modal = null;
            openPoolEditor(pool.id);
          }
        } catch (error) {
          importer.error = error?.message || "Could not import data.";
          render();
        }
      }
    }, sourcePool ? "Import items" : "Create Pool")
  ]));
}

function renderSaveToolPoolModal(modal, config) {
  const ts = ensureToolState(config.toolId);
  const tool = getTool(config.toolId);
  const name = node("input", {
    class: "field",
    placeholder: "Pool name",
    value: config.name,
    "aria-label": "Pool name"
  });
  name.addEventListener("input", () => {
    config.name = name.value;
  });

  const kind = node("select", {
    class: "field",
    "aria-label": "Pool kind"
  }, ["generic", "people", "choices", "tasks"].map((value) =>
    node("option", { value, text: value })
  ));
  kind.value = config.kind;
  kind.addEventListener("change", () => {
    config.kind = kind.value;
  });

  modal.append(
    node("h2", { text: "Save current list as Pool" }),
    node("p", {
      text: "This saves the current run input as a reusable source. Later edits to the Pool will not rewrite this run automatically."
    }),
    name,
    kind,
    node("div", { class: "modal-actions" }, [
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
          try {
            const labels = parseList(ts.listText);
            if (!labels.length) throw new Error("Current list is empty.");

            const weights = selectionTools.has(tool.id)
              ? reconcileSelectionEntries(labels, ts.selectionEntries || [])
              : labels.map(() => ({ weight: 1 }));

            const pool = createPool({
              name: config.name,
              kind: config.kind,
              items: labels.map((label, index) => ({
                label,
                weight: weights[index]?.weight ?? 1,
                active: true
              }))
            });

            await put("pools", pool);
            state.pools.unshift(pool);
            applyWorkingSetToTool(tool.id, ts, createWorkingSet(pool));
            ts.workingSetDirty = false;
            requestPersistentStorage();
            state.modal = null;
            render();
          } catch (error) {
            config.error = error.message;
            render();
          }
        }
      }, "Save Pool")
    ])
  );

  if (config.error) modal.prepend(toolError(config.error));
}

function renderModal() {
  if (!state.modal) return null;

  const backdrop = node("div", {
    class: "modal-backdrop",
    onClick: (event) => {
      if (event.target === backdrop) {
        if (typeof state.modal === "object" && state.modal.type === "pool-editor") {
          return;
        }
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
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "pool-editor"
  ) {
    renderPoolEditorModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "pool-import"
  ) {
    renderPoolImportModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "save-tool-pool"
  ) {
    renderSaveToolPoolModal(modal, state.modal);
  } else if (state.modal === "pool") {
    modal.append(
      node("h2", { text: "New Pool" }),
      node("p", {
        text: "Start with a quick pasted list. You can add tags, fields, weights, and Views after creation."
      })
    );

    const name = node("input", {
      class: "field",
      placeholder: "Pool name",
      "aria-label": "Pool name"
    });
    const description = node("input", {
      class: "field",
      placeholder: "Description (optional)",
      "aria-label": "Pool description"
    });
    const kind = node("select", {
      class: "field",
      "aria-label": "Pool kind"
    }, ["generic", "people", "choices", "tasks", "cards"].map((value) =>
      node("option", { value, text: value[0].toUpperCase() + value.slice(1) })
    ));
    const items = node("textarea", {
      class: "field",
      placeholder: "Anna\nBen\nDavid\nSarah",
      "aria-label": "Pool items"
    });
    const error = node("div", {
      class: "tool-error modal-error",
      role: "alert",
      hidden: "hidden"
    });

    modal.append(
      node("div", { class: "pool-create-grid" }, [
        name,
        kind,
        description
      ]),
      items,
      error
    );

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
          try {
            const labels = parseList(items.value);
            if (!labels.length) throw new Error("Add at least one item.");
            const pool = createPool({
              name: name.value,
              description: description.value,
              kind: kind.value,
              labels
            });
            await put("pools", pool);
            state.pools.unshift(pool);
            requestPersistentStorage();
            state.modal = null;
            openPoolEditor(pool.id);
          } catch (failure) {
            error.hidden = false;
            error.replaceChildren(
              node("strong", { text: "Could not create Pool" }),
              node("span", { text: failure.message })
            );
          }
        }
      }, "Create Pool")
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
          applyWorkingSetToTool(id, ts, createWorkingSet(pool));
          ts.workingSetDirty = false;
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
      if (typeof state.modal === "object" && state.modal.type === "pool-editor") {
        announce("Use Save Pool or Cancel to close the Pool editor.");
        return;
      }
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
