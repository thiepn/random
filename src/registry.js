export const CATEGORIES = [
  { id: "classics", name: "Classics", icon: "✦" },
  { id: "people", name: "People", icon: "◆" },
  { id: "generators", name: "Generators", icon: "◇" },
  { id: "games", name: "Games", icon: "◈" }
];

export const TOOLS = [
  {
    id: "coin", name: "Coin Flip", icon: "◐", category: "classics",
    blurb: "Heads, tails, or any binary decision.", accent: "gold",
    aliases: ["heads tails", "yes no", "binary", "50 50"]
  },
  {
    id: "dice", name: "Dice", icon: "⬡", category: "classics",
    blurb: "Roll D2 through D100 with multiple dice.", accent: "red",
    aliases: ["d6", "d20", "roll", "dice roller"]
  },
  {
    id: "wheel", name: "Wheel", icon: "◉", category: "classics",
    blurb: "Spin a vibrant wheel for any list.", accent: "rainbow",
    aliases: ["wheel of fortune", "spinner", "spin"]
  },
  {
    id: "picker", name: "Pick One", icon: "✦", category: "classics",
    blurb: "Pick one item instantly from any list.", accent: "cyan",
    aliases: ["random item", "name picker", "who goes first"]
  },
  {
    id: "number", name: "Number", icon: "#", category: "generators",
    blurb: "Generate an integer from any range.", accent: "cyan",
    aliases: ["random number", "integer", "range"]
  },
  {
    id: "shuffle", name: "Shuffle", icon: "⇄", category: "people",
    blurb: "Turn any list into a random order.", accent: "purple",
    aliases: ["random order", "turn order", "presentation order"]
  },
  {
    id: "teams", name: "Teams", icon: "◆", category: "people",
    blurb: "Split people into evenly sized random teams.", accent: "blue",
    aliases: ["groups", "split people", "make teams"]
  },
  {
    id: "pairs", name: "Pairs", icon: "∞", category: "people",
    blurb: "Make random partners and matchups.", accent: "pink",
    aliases: ["partners", "matchups", "pair people"]
  },
  {
    id: "cards", name: "Cards", icon: "▰", category: "games",
    blurb: "Shuffle a full deck and draw without replacement.", accent: "purple",
    aliases: ["deck", "playing cards", "draw card"]
  },
  {
    id: "chance", name: "Chance", icon: "%", category: "generators",
    blurb: "Test any percentage probability.", accent: "green",
    aliases: ["probability", "percent", "will it happen"]
  },
  {
    id: "lottery", name: "Lottery", icon: "✺", category: "games",
    blurb: "Draw unique lottery or raffle numbers.", accent: "gold",
    aliases: ["raffle", "bingo", "numbers"]
  },
  {
    id: "color", name: "Color", icon: "●", category: "generators",
    blurb: "Generate a random HEX color.", accent: "pink",
    aliases: ["hex", "rgb", "random color"]
  },
  {
    id: "date", name: "Date", icon: "▣", category: "generators",
    blurb: "Pick a random date between two dates.", accent: "blue",
    aliases: ["random day", "calendar"]
  },
  {
    id: "direction", name: "Direction", icon: "✥", category: "generators",
    blurb: "Choose one of eight compass directions.", accent: "orange",
    aliases: ["compass", "left right", "random direction"]
  },
  {
    id: "letter", name: "Letter", icon: "A", category: "generators",
    blurb: "Choose a random letter A–Z.", accent: "green",
    aliases: ["alphabet", "character"]
  }
];

export function getTool(id) {
  return TOOLS.find((tool) => tool.id === id);
}

export function searchTools(query) {
  const q = query.trim().toLowerCase();
  if (!q) return TOOLS;
  return TOOLS.filter((tool) =>
    [tool.name, tool.blurb, ...(tool.aliases || [])]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}
