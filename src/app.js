import { createRng, pick, shuffle, sample, partition, pairs, randomHexColor } from "./random-core.js";
import { CATEGORIES, TOOLS, getTool, searchTools } from "./registry.js";
import { getAll, put, remove, clear, getSettings, saveSettings, requestPersistentStorage } from "./storage.js";

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

const palette = ["#7c5cff", "#2ee5ff", "#ffca3a", "#ff5577", "#40e38b", "#4d8dff", "#ff63c3", "#ff923e"];

function node(tag, options, children) {
  const element = document.createElement(tag);
  const opts = options || {};
  for (const [key, value] of Object.entries(opts)) {
    if (value == null) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "html") element.innerHTML = value;
    else if (key === "dataset") Object.assign(element.dataset, value);
    else if (key === "style") Object.assign(element.style, value);
    else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "checked") element.checked = Boolean(value);
    else if (key === "value") element.value = value;
    else element.setAttribute(key, value);
  }
  const list = Array.isArray(children) ? children : children == null ? [] : [children];
  for (const child of list) {
    if (child == null) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

function iconButton(label, glyph, handler, extraClass) {
  return node("button", {
    class: "icon-button " + (extraClass || ""),
    type: "button",
    "aria-label": label,
    title: label,
    onClick: handler
  }, glyph);
}

function announce(text) {
  announcer.textContent = "";
  window.setTimeout(() => {
    announcer.textContent = text;
  }, 20);
}

function rng() {
  if (state.settings.randomness.mode === "seeded") {
    const position = Number.isSafeInteger(state.settings.randomness.position)
      ? state.settings.randomness.position
      : 0;
    const source = createRng({
      mode: "seeded",
      seed: (state.settings.randomness.seed || "ARCADE-2026") + "::" + position
    });
    state.settings.randomness.position = position + 1;
    saveSettings(state.settings).catch(() => {});
    return source;
  }
  return createRng(state.settings.randomness);
}

function currentTool() {
  return getTool(state.toolId);
}

function parseList(text) {
  return String(text || "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultList(toolId) {
  const defaults = {
    wheel: ["Pizza", "Sushi", "Korean", "Burgers", "Indian", "Tacos"],
    picker: ["Anna", "Ben", "David", "Sarah"],
    shuffle: ["Anna", "Ben", "David", "Sarah", "Luke"],
    teams: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"],
    pairs: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"]
  };
  return (defaults[toolId] || ["Option A", "Option B", "Option C"]).join("\n");
}

function ensureToolState(toolId) {
  if (!state.tool[toolId]) {
    state.tool[toolId] = {
      listText: defaultList(toolId),
      result: null,
      animating: false,
      wheelRotation: 0,
      diceCount: 2,
      diceSides: 6,
      numberMin: 1,
      numberMax: 100,
      teamCount: 2,
      chance: 50,
      lotteryCount: 6,
      lotteryMax: 49,
      dateStart: new Date().toISOString().slice(0, 10),
      dateEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      deck: null
    };
  }
  return state.tool[toolId];
}

async function loadData() {
  const [pools, history, favorites, settings] = await Promise.all([
    getAll("pools"),
    getAll("history"),
    getAll("favorites"),
    getSettings()
  ]);
  state.pools = pools.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  state.history = history.sort((a, b) => b.timestamp - a.timestamp).slice(0, 500);
  state.favorites = favorites.map((item) => item.id);
  state.settings = settings;
}

async function record(tool, summary, detail) {
  const entry = {
    id: crypto.randomUUID(),
    toolId: tool.id,
    toolName: tool.name,
    icon: tool.icon,
    resultSummary: summary,
    detail: detail || null,
    timestamp: Date.now()
  };
  state.history.unshift(entry);
  state.history = state.history.slice(0, 500);
  await put("history", entry);
}

function setView(view) {
  state.view = view;
  state.toolId = null;
  state.modal = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTool(id) {
  state.toolId = id;
  state.view = "tool";
  ensureToolState(id);
  state.modal = null;
  render();
  history.replaceState({}, "", location.pathname + "?tool=" + encodeURIComponent(id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeTool() {
  history.replaceState({}, "", location.pathname);
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
    node("span", { class: "tool-icon", text: tool.icon }),
    node("strong", { text: tool.name }),
    node("small", { text: tool.blurb })
  ]);
}

function topBar() {
  const randomness = state.settings.randomness.mode === "seeded" ? "Seeded" : "Secure";
  return node("header", { class: "topbar" }, [
    node("div", { class: "brand" }, [
      node("div", { class: "brand-icon", text: "✦", "aria-hidden": "true" }),
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
        node("span", { text: randomness })
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
  return node("nav", { class: "bottom-nav", "aria-label": "Primary navigation" },
    items.map(([id, glyph, label]) => node("button", {
      class: "nav-button " + (state.view === id ? "active" : ""),
      type: "button",
      "aria-current": state.view === id ? "page" : null,
      onClick: () => setView(id)
    }, [node("span", { text: glyph, "aria-hidden": "true" }), label]))
  );
}

function renderPlay() {
  const content = node("main", { class: "content" });
  const hero = node("section", { class: "hero" }, [
    node("div", { class: "kicker", text: "Arcade of randomness" }),
    node("h1", { text: "Pick. Roll. Shuffle. Decide." }),
    node("p", { text: "One vibrant toolbox for quick chance, teams, lists, games, generators, and decisions." })
  ]);

  const searchWrap = node("label", { class: "search-box" }, [
    node("span", { text: "⌕", "aria-hidden": "true" }),
    node("span", { class: "sr-only", text: "Search randomizers" })
  ]);
  const search = node("input", {
    type: "search",
    placeholder: "Try “teams”, “d20”, “dinner”, “lottery”…",
    value: state.search,
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
  content.append(hero);

  if (state.search.trim()) {
    const found = searchTools(state.search);
    content.append(sectionHeader("Search results", found.length + " found"));
    content.append(found.length ? node("div", { class: "tool-grid" }, found.map(toolCard)) : emptyState("No randomizer found", "Try a broader word or browse the Arcade."));
    return content;
  }

  const quick = node("div", { class: "quick-grid" }, [
    quickButton("◐", "Coin", "coin"),
    quickButton("⬡", "Dice", "dice"),
    quickButton("◉", "Wheel", "wheel"),
    quickButton("#", "Number", "number")
  ]);
  hero.append(quick);

  const favoriteTools = TOOLS.filter((tool) => state.favorites.includes(tool.id));
  if (favoriteTools.length) {
    content.append(sectionHeader("Favorites", "Your shortcuts"));
    content.append(node("div", { class: "tool-grid" }, favoriteTools.map(toolCard)));
  }

  const popular = ["coin", "dice", "wheel", "picker", "teams", "cards", "lottery", "shuffle"]
    .map(getTool).filter(Boolean);
  content.append(sectionHeader("Ready to play", "Fast, useful, no setup"));
  content.append(node("div", { class: "tool-grid" }, popular.map(toolCard)));

  return content;
}

function quickButton(glyph, label, id) {
  return node("button", { class: "quick-button", type: "button", onClick: () => openTool(id) }, [
    node("span", { text: glyph, "aria-hidden": "true" }),
    label
  ]);
}

function sectionHeader(title, note) {
  return node("div", { class: "section-head section" }, [
    node("h2", { text: title }),
    node("p", { text: note || "" })
  ]);
}

function emptyState(title, copy, actionLabel, action) {
  const box = node("div", { class: "empty" }, [
    node("strong", { text: title }),
    node("span", { text: copy })
  ]);
  if (actionLabel && action) {
    box.append(node("div", { style: { marginTop: "16px" } },
      node("button", { class: "secondary", type: "button", onClick: action }, actionLabel)
    ));
  }
  return box;
}

function renderArcade() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Arcade" }),
    node("p", { class: "view-subtitle", text: "Every randomizer currently available in the arcade. The catalog is registry-driven so new experiences slot in without rebuilding navigation." })
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
    node("p", { class: "view-subtitle", text: "Save a list once, then reuse it in Wheel, Picker, Shuffle, Teams, and Pairs." }),
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
    content.append(emptyState("No saved Pools yet", "Paste a list once and reuse it across compatible randomizers.", "Create Pool", () => {
      state.modal = "pool";
      render();
    }));
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
    node("p", { class: "view-subtitle", text: "Recent committed random results stored locally on this device." })
  ]);

  if (state.history.length) {
    content.append(node("div", { class: "button-row", style: { marginBottom: "16px" } }, [
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
    content.append(emptyState("Nothing here yet", "Run a randomizer and the committed result will appear here."));
    return content;
  }

  const list = node("div", { class: "history-list" });
  for (const item of state.history) {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.timestamp));
    list.append(node("button", {
      class: "history-item",
      type: "button",
      style: { textAlign: "left", color: "inherit", cursor: "pointer" },
      onClick: () => item.toolId === "studio" ? setView("studio") : openTool(item.toolId)
    }, [
      node("div", { class: "history-icon", text: item.icon || "✦" }),
      node("div", { class: "history-copy" }, [
        node("strong", { text: item.toolName + " → " + item.resultSummary }),
        node("span", { text: date })
      ])
    ]));
  }
  content.append(list);
  return content;
}

function renderStudio() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Decision Studio" }),
    node("p", { class: "view-subtitle", text: "A first runnable decision pipeline: reduce a list to finalists, then make one final secure or seeded pick. This uses the same Random Core as every tool." })
  ]);

  const panel = node("div", { class: "controls" });
  const input = node("textarea", { class: "field", id: "studio-input", "aria-label": "Decision options" });
  input.value = state.tool.studioText || "Pizza\nSushi\nKorean\nBurgers\nIndian\nTacos";
  input.addEventListener("input", () => {
    state.tool.studioText = input.value;
  });

  const finalist = node("input", { class: "field", id: "studio-count", type: "number", min: "2", value: state.tool.studioCount || 3, "aria-label": "Number of finalists" });
  finalist.addEventListener("input", () => state.tool.studioCount = Number(finalist.value));

  panel.append(
    node("div", { class: "control" }, [node("label", { text: "Options" }), input]),
    node("div", { class: "control", style: { marginTop: "10px" } }, [node("label", { text: "Finalists" }), finalist]),
    node("button", { class: "primary action-button", type: "button", style: { marginTop: "12px" }, onClick: runStudio }, "RUN DECISION")
  );

  const flow = node("div", { class: "studio-flow" }, [
    studioNode("1", "Input Pool", "Your options"),
    studioNode("2", "Sample Finalists", "Unique random sample"),
    studioNode("3", "Final Pick", "One winner from the finalists")
  ]);

  content.append(panel, flow);
  if (state.studioResult) {
    content.append(sectionHeader("Result", "Committed pipeline result"));
    content.append(node("div", { class: "tool-stage accent-purple" }, node("div", { class: "stage-content" }, [
      node("div", { class: "stage-label", text: "Finalists" }),
      node("div", { class: "result-list" }, state.studioResult.finalists.map((value, index) =>
        node("div", { class: "result-row" }, [node("span", { class: "rank", text: String(index + 1) }), node("strong", { text: value })])
      )),
      node("div", { class: "stage-label", style: { marginTop: "24px" }, text: "Final decision" }),
      node("div", { class: "stage-result", text: state.studioResult.winner })
    ])));
  }
  return content;
}

function studioNode(index, title, copy) {
  return node("div", { class: "studio-node" }, [
    node("strong", { text: index + ". " + title }),
    node("span", { text: copy })
  ]);
}

async function runStudio() {
  const items = parseList(document.getElementById("studio-input").value);
  const count = Number(document.getElementById("studio-count").value);
  if (items.length < 2) return alert("Add at least two options.");
  if (!Number.isSafeInteger(count) || count < 2 || count > items.length) return alert("Finalist count must be between 2 and the number of options.");
  const source = rng();
  const finalists = sample(items, count, source);
  const winner = pick(finalists, source);
  state.studioResult = { finalists, winner };
  await record({ id: "studio", name: "Decision Studio", icon: "◆" }, winner, { finalists });
  announce("Decision result: " + winner);
  render();
}

function renderTool() {
  const tool = currentTool();
  const toolState = ensureToolState(tool.id);
  const content = node("main", { class: "content" });
  const favorite = state.favorites.includes(tool.id);

  const head = node("div", { class: "tool-head accent-" + tool.accent }, [
    iconButton("Back", "←", closeTool),
    node("span", { class: "tool-symbol", text: tool.icon, "aria-hidden": "true" }),
    node("h1", { text: tool.name }),
    iconButton(favorite ? "Remove favorite" : "Add favorite", favorite ? "★" : "☆", () => toggleFavorite(tool.id), favorite ? "favorite-star" : ""),
    iconButton("Randomness settings", "⚙", () => {
      state.modal = "settings";
      render();
    })
  ]);

  const stage = buildStage(tool, toolState);
  const controls = buildControls(tool, toolState);

  content.append(node("section", { class: "tool-screen accent-" + tool.accent }, [head, stage, controls]));
  return content;
}

function buildStage(tool, ts) {
  const stage = node("div", { class: "tool-stage accent-" + tool.accent });
  const wrap = node("div", { class: "stage-content" });
  const result = ts.result;

  if (tool.id === "coin") {
    const orb = node("div", { class: "stage-orb " + (ts.animating ? "flipping" : ""), text: result ? (result === "Heads" ? "H" : "T") : "?" });
    wrap.append(orb, node("div", { class: "stage-label", text: "Coin Flip" }), node("div", { class: "stage-result", text: result || "READY" }));
  } else if (tool.id === "dice") {
    const values = result?.values || Array.from({ length: ts.diceCount }, () => "•");
    const row = node("div", { class: "dice-row " + (ts.animating ? "rolling" : "") },
      values.map((value) => node("div", { class: "die", text: String(value) }))
    );
    wrap.append(row, node("div", { class: "stage-label", text: result ? "Total" : "Dice ready" }), node("div", { class: "stage-result", text: result ? String(result.total) : "ROLL" }));
  } else if (tool.id === "wheel") {
    const items = parseList(ts.listText);
    const gradient = makeWheelGradient(Math.max(items.length, 1));
    const wheelWrap = node("div", { class: "wheel-wrap" });
    const wheel = node("div", { class: "wheel", style: { background: gradient, transform: "rotate(" + (ts.previousWheelRotation || 0) + "deg)" } });
    const pointer = node("div", { class: "wheel-pointer", "aria-hidden": "true" });
    const label = node("div", { class: "wheel-center-label", text: items.length + " entries" });
    wheelWrap.append(wheel, pointer, label);
    wrap.append(wheelWrap, node("div", { class: "stage-label", text: "Result" }), node("div", { class: "stage-result", text: result || "SPIN", style: { fontSize: result && result.length > 18 ? "42px" : "" } }));
    if (ts.pendingWheelRotation != null) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wheel.style.transform = "rotate(" + ts.pendingWheelRotation + "deg)";
      }));
    }
  } else if (tool.id === "cards") {
    wrap.append(
      node("div", { class: "card-deck", text: "✦", "aria-hidden": "true" }),
      node("div", { class: "stage-label", text: result ? "Drawn card" : "52-card deck" }),
      node("div", { class: "stage-result play-card", text: result?.card || "DRAW" }),
      node("div", { class: "stage-sub", text: result ? result.remaining + " cards remain" : "Shuffle happens before the first draw" })
    );
  } else if (tool.id === "color") {
    const color = result || "#7C5CFF";
    wrap.append(
      node("div", { class: "color-swatch", style: { background: color } }),
      node("div", { class: "stage-label", text: "HEX Color" }),
      node("div", { class: "stage-result", text: color })
    );
  } else if (tool.id === "shuffle" && Array.isArray(result)) {
    wrap.append(node("div", { class: "stage-label", text: "Random order" }), resultList(result), node("div", { class: "stage-sub", text: result.length + " items" }));
  } else if (tool.id === "teams" && Array.isArray(result)) {
    wrap.append(node("div", { class: "stage-label", text: "Random teams" }), teamsResult(result));
  } else if (tool.id === "pairs" && Array.isArray(result)) {
    wrap.append(node("div", { class: "stage-label", text: "Random pairs" }), resultList(result.map((pair) => pair.join("  ↔  "))));
  } else if (tool.id === "lottery" && Array.isArray(result)) {
    wrap.append(node("div", { class: "stage-label", text: "Draw" }), node("div", { class: "stage-result", text: result.join(" · "), style: { fontSize: "clamp(34px,10vw,62px)" } }));
  } else {
    const text = result?.summary || result || readyLabel(tool.id);
    wrap.append(
      node("div", { class: "stage-label", text: stageLabel(tool.id) }),
      node("div", { class: "stage-result", text: String(text), style: { fontSize: String(text).length > 20 ? "42px" : "" } }),
      result?.sub ? node("div", { class: "stage-sub", text: result.sub }) : null
    );
  }

  stage.append(wrap);
  return stage;
}

function resultList(items) {
  return node("div", { class: "result-list" }, items.map((item, index) =>
    node("div", { class: "result-row" }, [
      node("span", { class: "rank", text: String(index + 1) }),
      node("strong", { text: String(item) })
    ])
  ));
}

function teamsResult(groups) {
  return node("div", { class: "teams-grid" }, groups.map((group, index) =>
    node("div", { class: "team-card", style: { "--accent": palette[index % palette.length] } }, [
      node("strong", { text: "Team " + (index + 1) }),
      ...group.map((person) => node("div", { class: "team-member", text: person }))
    ])
  ));
}

function readyLabel(id) {
  const labels = {
    picker: "PICK",
    number: "GENERATE",
    chance: "TRY",
    date: "PICK DATE",
    direction: "SPIN",
    letter: "DRAW"
  };
  return labels[id] || "READY";
}

function stageLabel(id) {
  const labels = {
    picker: "Selected",
    number: "Random number",
    chance: "Chance result",
    date: "Random date",
    direction: "Direction",
    letter: "Random letter"
  };
  return labels[id] || "Result";
}

function buildControls(tool, ts) {
  const controls = node("div", { class: "controls" });
  const grid = node("div", { class: "control-grid" });

  if (["wheel", "picker", "shuffle", "teams", "pairs"].includes(tool.id)) {
    controls.append(listControls(tool, ts));
    if (tool.id === "teams") {
      grid.append(numberControl("Teams", "team-count", ts.teamCount, 2, 12, (value) => ts.teamCount = value));
      controls.append(grid);
    }
  } else if (tool.id === "dice") {
    grid.append(
      stepperControl("Dice", ts.diceCount, 1, 8, (value) => { ts.diceCount = value; render(); }),
      selectControl("Sides", ["2", "4", "6", "8", "10", "12", "20", "37", "100"], String(ts.diceSides), (value) => { ts.diceSides = Number(value); render(); })
    );
    controls.append(grid);
  } else if (tool.id === "number") {
    grid.append(
      numberControl("Minimum", "number-min", ts.numberMin, -1000000, 1000000, (value) => ts.numberMin = value),
      numberControl("Maximum", "number-max", ts.numberMax, -1000000, 1000000, (value) => ts.numberMax = value)
    );
    controls.append(grid);
  } else if (tool.id === "chance") {
    grid.append(numberControl("Success chance %", "chance", ts.chance, 0, 100, (value) => ts.chance = value));
    controls.append(grid);
  } else if (tool.id === "lottery") {
    grid.append(
      numberControl("Numbers", "lottery-count", ts.lotteryCount, 1, 50, (value) => ts.lotteryCount = value),
      numberControl("From 1 to", "lottery-max", ts.lotteryMax, 1, 10000, (value) => ts.lotteryMax = value)
    );
    controls.append(grid);
  } else if (tool.id === "date") {
    grid.append(
      dateControl("From", ts.dateStart, (value) => ts.dateStart = value),
      dateControl("To", ts.dateEnd, (value) => ts.dateEnd = value)
    );
    controls.append(grid);
  }

  const actions = node("div", { class: "button-row" });
  const action = node("button", {
    class: "primary action-button",
    type: "button",
    onClick: () => runTool(tool.id)
  }, actionLabel(tool.id, ts));
  actions.append(action);

  if (tool.id === "cards" && ts.deck) {
    actions.append(node("button", { class: "secondary", type: "button", onClick: () => {
      ts.deck = null;
      ts.result = null;
      render();
    } }, "Reset deck"));
  }

  if (ts.result) {
    actions.append(node("button", { class: "secondary", type: "button", onClick: shareCurrentResult }, "Share"));
  }

  controls.append(actions);

  const modeText = state.settings.randomness.mode === "seeded"
    ? "Seeded sequence · " + state.settings.randomness.seed
    : "Secure Web Crypto randomness";
  controls.append(node("div", { class: "notice", style: { marginTop: "12px" }, text: modeText + ". The result is decided before its animation." }));
  return controls;
}

function actionLabel(id, ts) {
  if (ts.animating) return "SHOW RESULT";
  const labels = {
    coin: ts.result ? "FLIP AGAIN" : "FLIP",
    dice: ts.result ? "ROLL AGAIN" : "ROLL",
    wheel: ts.result ? "SPIN AGAIN" : "SPIN",
    picker: ts.result ? "PICK AGAIN" : "PICK",
    number: "GENERATE",
    shuffle: "SHUFFLE",
    teams: ts.result ? "REMIX" : "MIX TEAMS",
    pairs: ts.result ? "REMATCH" : "MAKE PAIRS",
    cards: "DRAW",
    chance: "TRY CHANCE",
    lottery: "DRAW NUMBERS",
    color: "NEW COLOR",
    date: "PICK DATE",
    direction: "SPIN DIRECTION",
    letter: "DRAW LETTER"
  };
  return labels[id] || "RANDOMIZE";
}

function listControls(tool, ts) {
  const wrap = node("div");
  const poolSelect = node("select", { class: "field", "aria-label": "Use saved Pool" }, [
    node("option", { value: "", text: "Current list" }),
    ...state.pools.map((pool) => node("option", { value: pool.id, text: pool.name + " · " + pool.items.length }))
  ]);
  poolSelect.addEventListener("change", () => {
    const pool = state.pools.find((item) => item.id === poolSelect.value);
    if (!pool) return;
    ts.listText = pool.items.map((item) => item.label).join("\n");
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
  });

  wrap.append(
    node("div", { class: "control", style: { marginBottom: "10px" } }, [node("label", { text: "Source" }), poolSelect]),
    node("div", { class: "control", style: { marginBottom: "12px" } }, [node("label", { text: "Entries" }), textarea])
  );
  return wrap;
}

function stepperControl(label, value, min, max, onChange) {
  const output = node("output", { text: String(value) });
  const dec = node("button", { type: "button", "aria-label": "Decrease " + label, onClick: () => {
    const next = Math.max(min, value - 1);
    onChange(next);
  } }, "−");
  const inc = node("button", { type: "button", "aria-label": "Increase " + label, onClick: () => {
    const next = Math.min(max, value + 1);
    onChange(next);
  } }, "+");
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    node("div", { class: "stepper" }, [dec, output, inc])
  ]);
}

function selectControl(label, options, value, onChange) {
  const select = node("select", { class: "field" }, options.map((option) => node("option", { value: option, text: "D" + option })));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return node("div", { class: "control" }, [node("label", { text: label }), select]);
}

function numberControl(label, id, value, min, max, onChange) {
  const input = node("input", { class: "field", id, type: "number", min: String(min), max: String(max), value: String(value) });
  input.addEventListener("input", () => onChange(Number(input.value)));
  return node("div", { class: "control" }, [node("label", { for: id, text: label }), input]);
}

function dateControl(label, value, onChange) {
  const input = node("input", { class: "field", type: "date", value });
  input.addEventListener("input", () => onChange(input.value));
  return node("div", { class: "control" }, [node("label", { text: label }), input]);
}

function makeWheelGradient(count) {
  if (count < 1) return palette[0];
  const parts = [];
  const step = 360 / count;
  for (let i = 0; i < count; i += 1) {
    const start = (i * step).toFixed(3);
    const end = ((i + 1) * step).toFixed(3);
    parts.push(palette[i % palette.length] + " " + start + "deg " + end + "deg");
  }
  return "conic-gradient(" + parts.join(",") + ")";
}

async function runTool(id) {
  const tool = getTool(id);
  const ts = ensureToolState(id);
  if (ts.animating) {
    ts.animating = false;
    render();
    return;
  }

  const source = rng();
  try {
    let summary = "";
    let detail = null;
    let animationDuration = 0;

    if (id === "coin") {
      const result = source.int(0, 1) === 0 ? "Heads" : "Tails";
      ts.result = result;
      ts.animating = true;
      summary = result;
      animationDuration = 850;
    } else if (id === "dice") {
      const count = Math.max(1, Math.min(8, Number(ts.diceCount) || 1));
      const sides = Math.max(1, Math.min(100, Number(ts.diceSides) || 6));
      const values = Array.from({ length: count }, () => source.int(1, sides));
      ts.result = { values, total: values.reduce((a, b) => a + b, 0) };
      ts.animating = true;
      summary = String(ts.result.total);
      detail = { values, sides };
      animationDuration = 720;
    } else if (id === "number") {
      const min = Number(ts.numberMin);
      const max = Number(ts.numberMax);
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || max - min + 1 > 0x100000000) throw new Error("Choose a valid integer range of at most 4,294,967,296 values.");
      ts.result = source.int(min, max);
      summary = String(ts.result);
    } else if (id === "wheel") {
      const items = parseList(ts.listText);
      if (items.length < 2) throw new Error("Add at least two Wheel entries.");
      const index = source.int(0, items.length - 1);
      ts.result = items[index];
      const segment = 360 / items.length;
      const desired = (360 - (index + 0.5) * segment) % 360;
      const previous = ts.wheelRotation || 0;
      const current = ((previous % 360) + 360) % 360;
      const delta = (desired - current + 360) % 360;
      const target = previous + 1080 + delta;
      ts.previousWheelRotation = previous;
      ts.pendingWheelRotation = target;
      ts.wheelRotation = target;
      ts.animating = true;
      summary = ts.result;
      detail = { entries: items.length, selectedIndex: index };
      animationDuration = 1700;
    } else if (id === "picker") {
      const items = parseList(ts.listText);
      if (!items.length) throw new Error("Add at least one entry.");
      ts.result = pick(items, source);
      summary = ts.result;
    } else if (id === "shuffle") {
      const items = parseList(ts.listText);
      if (items.length < 2) throw new Error("Add at least two entries.");
      ts.result = shuffle(items, source);
      summary = ts.result.slice(0, 3).join(", ") + (ts.result.length > 3 ? "…" : "");
      detail = { order: ts.result };
    } else if (id === "teams") {
      const items = parseList(ts.listText);
      const count = Math.max(2, Math.min(12, Number(ts.teamCount) || 2));
      if (items.length < count) throw new Error("You need at least as many people as teams.");
      ts.result = partition(items, count, source);
      summary = count + " teams";
      detail = { groups: ts.result };
    } else if (id === "pairs") {
      const items = parseList(ts.listText);
      if (items.length < 2) throw new Error("Add at least two people.");
      ts.result = pairs(items, source);
      summary = ts.result.length + " groups";
      detail = { pairs: ts.result };
    } else if (id === "cards") {
      if (!ts.deck || ts.deck.length === 0) ts.deck = shuffle(makeDeck(), source);
      const card = ts.deck.shift();
      ts.result = { card, remaining: ts.deck.length };
      summary = card;
      detail = { remaining: ts.deck.length };
    } else if (id === "chance") {
      const chance = Math.max(0, Math.min(100, Number(ts.chance) || 0));
      const success = source.float() * 100 < chance;
      ts.result = { summary: success ? "YES" : "NO", sub: chance + "% success chance" };
      summary = ts.result.summary;
      detail = { chance };
    } else if (id === "lottery") {
      const count = Number(ts.lotteryCount);
      const max = Number(ts.lotteryMax);
      if (!Number.isSafeInteger(count) || !Number.isSafeInteger(max) || count < 1 || max < 1 || count > max || max > 10000) throw new Error("Choose a valid draw count and range up to 10,000.");
      const numbers = Array.from({ length: max }, (_, index) => index + 1);
      ts.result = sample(numbers, count, source).sort((a, b) => a - b);
      summary = ts.result.join(", ");
    } else if (id === "color") {
      ts.result = randomHexColor(source);
      summary = ts.result;
    } else if (id === "date") {
      const start = Date.parse(ts.dateStart + "T00:00:00Z");
      const end = Date.parse(ts.dateEnd + "T00:00:00Z");
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error("Choose a valid date range.");
      const days = Math.floor((end - start) / 86400000);
      const offset = source.int(0, days);
      const date = new Date(start + offset * 86400000);
      ts.result = {
        summary: new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" }).format(date),
        iso: date.toISOString().slice(0, 10)
      };
      summary = ts.result.summary;
    } else if (id === "direction") {
      ts.result = pick(["N", "NE", "E", "SE", "S", "SW", "W", "NW"], source);
      summary = ts.result;
    } else if (id === "letter") {
      ts.result = String.fromCharCode(65 + source.int(0, 25));
      summary = ts.result;
    }

    await record(tool, summary, detail);
    render();
    if (animationDuration) window.setTimeout(() => finishAnimation(id), animationDuration);
    announce(tool.name + " result: " + summary);
  } catch (error) {
    alert(error.message || "This randomizer could not run.");
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

function makeDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const cards = [];
  for (const suit of suits) for (const rank of ranks) cards.push(rank + suit);
  return cards;
}

async function shareCurrentResult() {
  const tool = currentTool();
  const ts = ensureToolState(tool.id);
  if (!ts.result) return;
  const summary = summarizeResult(tool.id, ts.result);
  const text = tool.name + ": " + summary;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Randomizer Arcade", text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      announce("Result copied.");
    }
  } catch {
    // User cancellation is not an error state.
  }
}

function summarizeResult(id, result) {
  if (id === "dice") return result.values.join(" + ") + " = " + result.total;
  if (id === "teams") return result.map((group, index) => "Team " + (index + 1) + ": " + group.join(", ")).join(" | ");
  if (id === "shuffle") return result.join(", ");
  if (id === "pairs") return result.map((group) => group.join(" & ")).join(" | ");
  if (id === "lottery") return result.join(", ");
  if (typeof result === "object") return result.summary || result.card || JSON.stringify(result);
  return String(result);
}

function renderModal() {
  if (!state.modal) return null;
  const backdrop = node("div", { class: "modal-backdrop", onClick: (event) => {
    if (event.target === backdrop) {
      state.modal = null;
      render();
    }
  } });
  const modal = node("section", { class: "modal", role: "dialog", "aria-modal": "true" });

  if (state.modal === "settings") {
    modal.append(
      node("h2", { text: "Randomness" }),
      node("p", { text: "Secure mode uses Web Crypto. Seeded mode gives a reproducible deterministic sequence for testing and shared challenges." })
    );
    const segments = node("div", { class: "segmented" });
    for (const mode of ["secure", "seeded"]) {
      segments.append(node("button", {
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
    modal.append(segments);
    if (state.settings.randomness.mode === "seeded") {
      const seed = node("input", { class: "field", value: state.settings.randomness.seed || "ARCADE-2026", "aria-label": "Seed", style: { marginTop: "12px" } });
      seed.addEventListener("change", async () => {
        state.settings.randomness.seed = seed.value || "ARCADE-2026";
        state.settings.randomness.position = 0;
        await saveSettings(state.settings);
      });
      modal.append(seed);
    }
    modal.append(node("div", { class: "modal-actions" }, [
      node("button", { class: "secondary", type: "button", onClick: () => { state.modal = null; render(); } }, "Done")
    ]));
  } else if (state.modal === "pool") {
    modal.append(node("h2", { text: "New Pool" }), node("p", { text: "One item per line. Duplicate labels are allowed and remain separate entries." }));
    const name = node("input", { class: "field", placeholder: "Pool name", "aria-label": "Pool name" });
    const items = node("textarea", { class: "field", placeholder: "Anna\nBen\nDavid\nSarah", "aria-label": "Pool items", style: { marginTop: "10px" } });
    modal.append(name, items, node("div", { class: "modal-actions" }, [
      node("button", { class: "secondary", type: "button", onClick: () => { state.modal = null; render(); } }, "Cancel"),
      node("button", { class: "primary", type: "button", onClick: async () => {
        const labels = parseList(items.value);
        if (!name.value.trim() || !labels.length) return alert("Add a Pool name and at least one item.");
        const now = new Date().toISOString();
        const pool = {
          id: crypto.randomUUID(),
          name: name.value.trim(),
          items: labels.map((label) => ({ id: crypto.randomUUID(), label, active: true })),
          createdAt: now,
          updatedAt: now,
          revision: 1
        };
        await put("pools", pool);
        state.pools.unshift(pool);
        state.modal = null;
        requestPersistentStorage();
        render();
      } }, "Save Pool")
    ]));
  } else if (typeof state.modal === "object" && state.modal.type === "use-pool") {
    const pool = state.pools.find((item) => item.id === state.modal.poolId);
    modal.append(node("h2", { text: pool ? pool.name : "Pool" }), node("p", { text: "Choose a compatible randomizer." }));
    const choices = ["picker", "wheel", "shuffle", "teams", "pairs"];
    modal.append(node("div", { class: "tool-grid" }, choices.map((id) => {
      const tool = getTool(id);
      return node("button", {
        class: "tool-card accent-" + tool.accent,
        type: "button",
        onClick: () => {
          const ts = ensureToolState(id);
          ts.listText = pool.items.map((item) => item.label).join("\n");
          state.modal = null;
          openTool(id);
        }
      }, [node("span", { class: "tool-icon", text: tool.icon }), node("strong", { text: tool.name }), node("small", { text: tool.blurb })]);
    })));
  }

  backdrop.append(modal);
  return backdrop;
}

function render() {
  if (!state.settings) return;
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
  document.querySelectorAll(".modal-backdrop").forEach((item, index, all) => {
    if (index < all.length - 1) item.remove();
  });
}

async function init() {
  await loadData();

  const params = new URLSearchParams(location.search);
  const requestedTool = params.get("tool");
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
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && state.view === "tool" && event.target === document.body) {
      event.preventDefault();
      runTool(state.toolId);
    }
  });
}

init().catch((error) => {
  root.replaceChildren(node("div", { class: "boot-screen" }, [
    node("div", { class: "brand-mark", text: "!" }),
    node("strong", { text: "Could not start Randomizer Arcade" }),
    node("span", { text: error.message || "Unknown startup error." })
  ]));
});
