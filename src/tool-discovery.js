// Shared task-aware discovery, used by Home, Arcade and the global tool finder.
const TASKS = Object.freeze({
  coin: ["flip a coin", "heads or tails", "yes or no"],
  dice: ["roll dice", "roll a d20", "board game dice"],
  wheel: ["spin a wheel", "spin a list", "wheel of names"],
  picker: ["choose dinner", "choose restaurant", "decide what to eat", "pick someone", "choose for us"],
  number: ["random number", "pick a number", "number between"],
  shuffle: ["random order", "shuffle names", "who goes first", "presentation order"],
  teams: ["split into teams", "make fair teams", "divide players into teams"],
  pairs: ["pair participants", "assign partners", "make random pairs"],
  cards: ["draw a playing card", "shuffle a deck", "pick a card"],
  chance: ["test a probability", "percent chance", "probability of success"],
  lottery: ["lottery numbers", "bingo numbers", "draw numbered balls"],
  color: ["random color", "choose a hex color", "pick a colour"],
  date: ["random date", "choose a day", "calendar date"],
  direction: ["random direction", "choose left or right", "compass heading"],
  letter: ["random letter", "choose a letter", "alphabet draw"],
  sampler: ["pick raffle winners", "draw raffle winners", "choose multiple winners", "select several people"],
  groups: ["split into groups", "make breakout groups", "divide class into groups"],
  assignment: ["assign chores", "assign tasks", "divide responsibilities", "choose roles"],
  elimination: ["eliminate contestants", "last one standing", "elimination game"],
  ladder: ["ladder game", "match players to prizes", "sadari game"],
  "secret-santa": ["secret gift exchange", "secret santa", "draw gift recipients"],
  tournament: ["create matchups", "tournament bracket", "seed a tournament"],
  time: ["random time", "choose an hour", "schedule a time"],
  coordinate: ["random coordinate", "choose a point", "random x y"],
  rps: ["rock paper scissors", "play rps", "choose rock paper scissors"]
});

const normalize = (value) => String(value ?? "").toLowerCase()
  .normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function fieldScore(field, query, tokens, weight) {
  const value = normalize(field);
  if (!value) return 0;
  if (value === query) return weight;
  if (value.startsWith(query + " ") || value.startsWith(query)) return weight * .82;
  if (value.includes(query)) return weight * .7;
  const words = value.split(" ");
  return tokens.every((token) => words.some((word) => word.startsWith(token)))
    ? weight * .54 : 0;
}

export function findToolsForTask(query, builtins = [], customs = []) {
  const q = normalize(query).slice(0, 120);
  const all = [...builtins, ...customs].filter((item) => item?.id && item.name);
  if (!q) return all;
  const terms = q.split(" ").filter(Boolean);
  return all.map((tool, index) => {
    const title = fieldScore(tool.name, q, terms, 200);
    const aliases = Math.max(0, ...(tool.aliases || []).map((x) =>
      fieldScore(x, q, terms, 155)));
    const tasks = Math.max(0, ...(TASKS[tool.id] || []).map((x) =>
      fieldScore(x, q, terms, 150)));
    const description = fieldScore(tool.blurb, q, terms, 65);
    const primitive = tool.custom ? fieldScore(tool.primitive, q, terms, 45) : 0;
    return { tool, index, score: Math.max(title, aliases, tasks, description, primitive) };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({tool}) => tool);
}

export function suggestedTools(builtins = [], customs = [], recentIds = [], favorites = [], limit = 8) {
  const all = [...builtins, ...customs].filter((item) => item?.id && item.name);
  const byId = new Map(all.map((item) => [item.id, item]));
  const ids = [...recentIds, ...favorites, "picker", "teams", "sampler", "shuffle",
    "wheel", "number", "dice", "assignment", ...all.map((tool) => tool.id)];
  const seen = new Set();
  return ids.filter((id) => {
    if (!byId.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, limit).map((id) => byId.get(id));
}

export function renderToolFinder(modal, {
  node, builtins, customs, recentIds = [], favorites = [], openTool
}) {
  if (typeof node !== "function" || typeof openTool !== "function") {
    throw new TypeError("Tool finder requires a DOM factory and a tool navigation action");
  }
  const input = node("input", {
    class: "field", type: "search",
    "aria-label": "Search tools or tasks",
    placeholder: "Try ‘split teams’ or ‘choose dinner’",
    autocomplete: "off", spellcheck: "false"
  });
  const count = node("p", { role: "status", "aria-live": "polite" });
  const results = node("div", {
    class: "tool-grid modal-tool-grid",
    "aria-label": "Matching randomizers"
  });
  const draw = () => {
    const q = input.value.trim();
    const all = q
      ? findToolsForTask(q, builtins, customs)
      : suggestedTools(builtins, customs, recentIds, favorites);
    const shown = all.slice(0, 8);
    count.textContent = q
      ? all.length + (all.length === 1 ? " matching tool" : " matching tools")
      : "Recent and useful tools";
    results.replaceChildren(...shown.map((tool) => node("button", {
      class: "tool-card accent-" + (tool.accent || "cyan"),
      type: "button",
      "aria-label": "Open " + tool.name,
      onClick: () => openTool(tool.id)
    }, [
      node("strong", { text: tool.name }),
      node("small", { text: tool.blurb || (tool.custom ? "Your custom randomizer" : "") })
    ])));
    if (!shown.length) results.append(node("p", {
      text: "No matches. Try a tool name or a different task."
    }));
  };
  input.addEventListener("input", draw);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "ArrowDown") {
      const first = results.querySelector("button");
      if (first) { event.preventDefault(); first.focus(); }
    }
    if (event.key === "Enter") {
      const first = results.querySelector("button");
      if (first) { event.preventDefault(); first.click(); }
    }
  });
  results.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const options = [...results.querySelectorAll("button")];
    const index = options.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    (options[next] || input).focus();
  });
  const tasks = [
    ["Choose dinner", "choose dinner"],
    ["Make teams", "split into teams"],
    ["Raffle winners", "pick raffle winners"],
    ["Assign chores", "assign chores"]
  ];
  const suggestions = node("div", { class: "working-set-actions" },
    tasks.map(([title, query]) => node("button", {
      class: "small-action", type: "button",
      onClick: () => { input.value = query; draw(); input.focus(); }
    }, title)));
  modal.append(
    node("h2", { text: "Find a randomizer" }),
    node("p", { text: "Search by tool name or what you want to do. Press Ctrl/⌘+K from anywhere in the arcade." }),
    input,
    suggestions,
    count,
    results
  );
  draw();
}
