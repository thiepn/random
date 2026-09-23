export const CATEGORIES = [
  { id: "classics", name: "Classics", icon: "✦", iconId: "category-classics" },
  { id: "people", name: "People", icon: "◆", iconId: "category-people" },
  { id: "generators", name: "Generators", icon: "◇", iconId: "category-generators" },
  { id: "games", name: "Games", icon: "◈", iconId: "category-games" }
];

export const TOOLS = [
  {
    id: "coin", name: "Coin Flip", icon: "◐", iconId: "coin", category: "classics",
    blurb: "Heads, tails, or any binary decision.", accent: "gold",
    aliases: ["heads tails", "yes no", "binary", "50 50"]
  },
  {
    id: "dice", name: "Dice", icon: "⬡", iconId: "dice", category: "classics",
    blurb: "Roll D2 through D100 with multiple dice.", accent: "red",
    aliases: ["d6", "d20", "roll", "dice roller"]
  },
  {
    id: "wheel", name: "Wheel", icon: "◉", iconId: "wheel", category: "classics",
    blurb: "Spin a vibrant wheel for any list.", accent: "rainbow",
    aliases: ["wheel of fortune", "spinner", "spin"]
  },
  {
    id: "picker", name: "Pick One", icon: "✦", iconId: "picker", category: "classics",
    blurb: "Pick one item instantly from any list.", accent: "cyan",
    aliases: ["random item", "name picker", "who goes first"]
  },
  {
    id: "number", name: "Number", icon: "#", iconId: "number", category: "generators",
    blurb: "Generate an integer from any range.", accent: "cyan",
    aliases: ["random number", "integer", "range"]
  },
  {
    id: "shuffle", name: "Shuffle", icon: "⇄", iconId: "shuffle", category: "people",
    blurb: "Turn any list into a random order.", accent: "purple",
    aliases: ["random order", "turn order", "presentation order"]
  },
  {
    id: "teams", name: "Teams", icon: "◆", iconId: "teams", category: "people",
    blurb: "Split people into evenly sized random teams.", accent: "blue",
    aliases: ["groups", "split people", "make teams"]
  },
  {
    id: "pairs", name: "Pairs", icon: "∞", iconId: "pairs", category: "people",
    blurb: "Make random partners and matchups.", accent: "pink",
    aliases: ["partners", "matchups", "pair people"]
  },
  {
    id: "cards", name: "Cards", icon: "▰", iconId: "cards", category: "games",
    blurb: "Shuffle a full deck and draw without replacement.", accent: "purple",
    aliases: ["deck", "playing cards", "draw card"]
  },
  {
    id: "chance", name: "Chance", icon: "%", iconId: "chance", category: "generators",
    blurb: "Test any percentage probability.", accent: "green",
    aliases: ["probability", "percent", "will it happen"]
  },
  {
    id: "lottery", name: "Lottery", icon: "✺", iconId: "lottery", category: "games",
    blurb: "Draw unique lottery or raffle numbers.", accent: "gold",
    aliases: ["raffle", "bingo", "numbers"]
  },
  {
    id: "color", name: "Color", icon: "●", iconId: "color", category: "generators",
    blurb: "Generate a random HEX color.", accent: "pink",
    aliases: ["hex", "rgb", "random color"]
  },
  {
    id: "date", name: "Date", icon: "▣", iconId: "date", category: "generators",
    blurb: "Pick a random date between two dates.", accent: "blue",
    aliases: ["random day", "calendar"]
  },
  {
    id: "direction", name: "Direction", icon: "✥", iconId: "direction", category: "generators",
    blurb: "Choose one of eight compass directions.", accent: "orange",
    aliases: ["compass", "left right", "random direction"]
  },
  {
    id: "letter", name: "Letter", icon: "A", iconId: "letter", category: "generators",
    blurb: "Choose a random letter A–Z.", accent: "green",
    aliases: ["alphabet", "character"]
  },
  {
    id: "sampler", name: "Pick Several", icon: "✣", iconId: "sampler", category: "classics",
    blurb: "Draw several unique winners from a list.", accent: "cyan",
    aliases: ["sample", "multiple winners", "giveaway"]
  },
  {
    id: "groups", name: "Groups", icon: "▦", iconId: "groups", category: "people",
    blurb: "Divide a list into neutral random groups.", accent: "blue",
    aliases: ["group people", "breakout groups", "divide"]
  },
  {
    id: "assignment", name: "Assignments", icon: "↦", iconId: "assignment", category: "people",
    blurb: "Randomly distribute people across tasks or roles.", accent: "purple",
    aliases: ["assign tasks", "roles", "chores"]
  },
  {
    id: "elimination", name: "Elimination", icon: "◎", iconId: "elimination", category: "games",
    blurb: "Eliminate random entrants until one winner remains.", accent: "red",
    aliases: ["last one standing", "eliminate", "survivor"]
  },
  {
    id: "ladder", name: "Ladder", icon: "╫", iconId: "ladder", category: "games",
    blurb: "Randomly map players to prizes or outcomes.", accent: "green",
    aliases: ["ghost leg", "sadari", "사다리"]
  },
  {
    id: "secret-santa", name: "Secret Santa", icon: "◈", iconId: "secret-santa", category: "people",
    blurb: "Create private no-self gift assignments.", accent: "red",
    aliases: ["gift exchange", "secret gift", "santa"]
  },
  {
    id: "tournament", name: "Tournament Draw", icon: "⌘", iconId: "tournament", category: "games",
    blurb: "Randomly seed entrants into matchups.", accent: "orange",
    aliases: ["bracket", "matchups", "draw"]
  },
  {
    id: "time", name: "Time", icon: "◷", iconId: "time", category: "generators",
    blurb: "Pick a random time within a daily window.", accent: "blue",
    aliases: ["random time", "hour", "schedule"]
  },
  {
    id: "coordinate", name: "Coordinates", icon: "⌖", iconId: "coordinate", category: "generators",
    blurb: "Generate a random point inside X/Y bounds.", accent: "cyan",
    aliases: ["x y", "grid", "point"]
  },
  {
    id: "rps", name: "Rock Paper Scissors", icon: "✊", iconId: "rps", category: "games",
    blurb: "Let chance choose rock, paper, or scissors.", accent: "pink",
    aliases: ["rps", "rock", "paper", "scissors"]
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
