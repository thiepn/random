import {
  pick,
  shuffle,
  sample,
  partition,
  pairs,
  derangement,
  weightedIndex,
  weightedSample,
  randomHexColor
} from "./random-core.js";
import { normalizeSelection } from "./selection-model.js";
import {
  DiceExpressionError,
  rollDiceExpression
} from "./dice-engine.js";

const MAX_UINT32_RANGE = 0x100000000;

export class ToolValidationError extends Error {
  constructor(message, code = "INVALID_CONFIG") {
    super(message);
    this.name = "ToolValidationError";
    this.code = code;
  }
}

function requireItems(items, minimum, label = "entries") {
  if (!Array.isArray(items) || items.length < minimum) {
    throw new ToolValidationError(
      minimum === 1
        ? `Add at least one ${label}.`
        : `Add at least ${minimum} ${label}.`,
      "NOT_ENOUGH_ITEMS"
    );
  }
}

function requireInteger(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ToolValidationError(
      `${label} must be a whole number from ${min} to ${max}.`,
      "INVALID_INTEGER"
    );
  }
  return value;
}

function requireRange(min, max, label) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new ToolValidationError(`Choose a valid ${label} range.`, "INVALID_RANGE");
  }
  if (max - min + 1 > MAX_UINT32_RANGE) {
    throw new ToolValidationError(
      `${label} range can contain at most 4,294,967,296 integer values.`,
      "RANGE_TOO_LARGE"
    );
  }
}

function selectionModel(items, config) {
  try {
    return normalizeSelection(items, config.selectionEntries || []);
  } catch (error) {
    throw new ToolValidationError(
      error?.message || "Selection rules are invalid.",
      error?.code || "INVALID_SELECTION_CONFIG"
    );
  }
}

function selectionFairness(model, {
  operation,
  allowRepeats = null,
  probabilityMeaning = "single-draw"
} = {}) {
  return {
    kind: "selection",
    operation,
    mode: model.customWeights ? "weighted" : "uniform",
    candidateCount: model.entries.length,
    eligibleCount: model.eligibleCount,
    excludedCount: model.excludedCount,
    zeroWeightCount: model.zeroWeightCount,
    uniformAmongEligible: model.uniformAmongEligible,
    allowRepeats,
    probabilityMeaning,
    probabilities: model.entries.map((entry) => ({
      index: entry.index,
      label: entry.label,
      weight: entry.weight,
      excluded: entry.excluded,
      eligible: entry.eligible,
      probability: entry.probability
    }))
  };
}

export function makeStandardDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const cards = [];
  for (const suit of suits) {
    for (const rank of ranks) cards.push(rank + suit);
  }
  return cards;
}

export function buildLadder(count, rng) {
  requireInteger(count, "Player count", 2, 100);
  const targetBottomOrder = shuffle(
    Array.from({ length: count }, (_, index) => index),
    rng
  );
  const current = Array.from({ length: count }, (_, index) => index);
  const rungs = [];

  for (let position = 0; position < count; position += 1) {
    const wanted = targetBottomOrder[position];
    let index = current.indexOf(wanted);
    while (index > position) {
      const left = index - 1;
      [current[left], current[index]] = [current[index], current[left]];
      rungs.push({ left });
      index -= 1;
    }
  }

  const bottomForSource = Array(count);
  current.forEach((sourceIndex, bottomIndex) => {
    bottomForSource[sourceIndex] = bottomIndex;
  });

  return { rungs, bottomOrder: current, bottomForSource };
}

export function createTournamentDraw(entrants, rng) {
  requireItems(entrants, 2, "entrants");
  const ordered = shuffle(entrants, rng);
  const bracketSize = 2 ** Math.ceil(Math.log2(ordered.length));
  const byeCount = bracketSize - ordered.length;
  const matches = [];
  let cursor = 0;

  for (let matchIndex = 0; matchIndex < bracketSize / 2; matchIndex += 1) {
    if (matchIndex < byeCount) {
      matches.push({ a: ordered[cursor++], b: null, bye: true });
    } else {
      matches.push({ a: ordered[cursor++], b: ordered[cursor++], bye: false });
    }
  }

  return { matches, bracketSize, byeCount };
}

export function executeTool(toolId, config, rng) {
  const items = Array.isArray(config.items) ? config.items : [];

  switch (toolId) {
    case "coin": {
      const result = rng.int(0, 1) === 0 ? "Heads" : "Tails";
      return { result, summary: result };
    }

    case "dice": {
      if (config.diceMode === "expression") {
        try {
          const rolled = rollDiceExpression(config.diceExpression, rng);
          const result = {
            mode: "expression",
            expression: rolled.source,
            canonical: rolled.canonical,
            total: rolled.total,
            diceGroups: rolled.diceGroups,
            evaluation: rolled.evaluation,
            randomRollCount: rolled.randomRollCount,
            version: rolled.version
          };
          return {
            result,
            summary: String(result.total),
            detail: {
              expression: result.expression,
              canonical: result.canonical,
              total: result.total,
              diceGroups: result.diceGroups,
              randomRollCount: result.randomRollCount,
              version: result.version
            },
            fairness: {
              kind: "dice-expression",
              mode: "uniform-faces",
              expression: result.expression,
              canonical: result.canonical,
              randomRollCount: result.randomRollCount,
              groups: result.diceGroups.map((group) => ({
                notation: group.notation,
                count: group.count,
                sides: group.sides,
                keepDrop: group.keepDrop,
                reroll: group.reroll,
                explode: group.explode
              }))
            }
          };
        } catch (error) {
          if (error instanceof DiceExpressionError) {
            throw new ToolValidationError(
              error.message,
              error.code || "INVALID_DICE_EXPRESSION"
            );
          }
          throw error;
        }
      }

      const count = requireInteger(config.diceCount, "Dice count", 1, 8);
      const sides = requireInteger(config.diceSides, "Die sides", 1, 100);
      const values = Array.from({ length: count }, () => rng.int(1, sides));
      const result = {
        mode: "quick",
        values,
        total: values.reduce((sum, value) => sum + value, 0),
        sides
      };
      return {
        result,
        summary: String(result.total),
        detail: { values, sides, mode: "quick" },
        fairness: {
          kind: "dice",
          mode: "uniform-faces",
          count,
          sides
        }
      };
    }

    case "number": {
      const min = Number(config.numberMin);
      const max = Number(config.numberMax);
      requireRange(min, max, "number");
      const result = rng.int(min, max);
      return { result, summary: String(result) };
    }

    case "wheel": {
      requireItems(items, 2, "Wheel entries");
      const model = selectionModel(items, config);
      if (model.eligibleCount < 2) {
        throw new ToolValidationError(
          "Wheel needs at least two eligible entries with weight above zero.",
          "NOT_ENOUGH_ELIGIBLE_ITEMS"
        );
      }

      let selectedEntry;
      if (!model.customWeights) {
        selectedEntry = pick(model.eligibleEntries, rng);
      } else {
        const selectedPosition = weightedIndex(
          model.eligibleEntries.map((entry) => entry.effectiveWeight),
          rng
        );
        selectedEntry = model.eligibleEntries[selectedPosition];
      }

      const fairness = selectionFairness(model, {
        operation: "wheel",
        probabilityMeaning: "single-draw"
      });

      return {
        result: selectedEntry.label,
        summary: selectedEntry.label,
        detail: {
          entries: items.length,
          selectedIndex: selectedEntry.index,
          fairness
        },
        fairness
      };
    }

    case "picker": {
      requireItems(items, 1);
      const model = selectionModel(items, config);
      if (model.eligibleCount < 1) {
        throw new ToolValidationError(
          "Pick One needs at least one eligible entry with weight above zero.",
          "NO_ELIGIBLE_ITEMS"
        );
      }

      let selectedEntry;
      if (!model.customWeights) {
        selectedEntry = pick(model.eligibleEntries, rng);
      } else {
        const selectedPosition = weightedIndex(
          model.eligibleEntries.map((entry) => entry.effectiveWeight),
          rng
        );
        selectedEntry = model.eligibleEntries[selectedPosition];
      }

      const fairness = selectionFairness(model, {
        operation: "picker",
        probabilityMeaning: "single-draw"
      });

      return {
        result: selectedEntry.label,
        summary: selectedEntry.label,
        detail: { selectedIndex: selectedEntry.index, fairness },
        fairness
      };
    }

    case "sampler": {
      requireItems(items, 1);
      const model = selectionModel(items, config);
      if (model.eligibleCount < 1) {
        throw new ToolValidationError(
          "Pick Several needs at least one eligible entry with weight above zero.",
          "NO_ELIGIBLE_ITEMS"
        );
      }

      const allowRepeats = Boolean(config.allowRepeats);
      const maxCount = allowRepeats ? 100 : model.eligibleCount;
      const count = requireInteger(config.sampleCount, "Winner count", 1, maxCount);

      let selectedEntries;
      if (!model.customWeights) {
        if (allowRepeats) {
          selectedEntries = Array.from(
            { length: count },
            () => pick(model.eligibleEntries, rng)
          );
        } else {
          selectedEntries = sample(model.eligibleEntries, count, rng);
        }
      } else {
        selectedEntries = weightedSample(
          model.eligibleEntries,
          model.eligibleEntries.map((entry) => entry.effectiveWeight),
          count,
          rng,
          { replacement: allowRepeats }
        ).map((draw) => draw.item);
      }

      const result = selectedEntries.map((entry) => entry.label);
      const fairness = selectionFairness(model, {
        operation: "sampler",
        allowRepeats,
        probabilityMeaning: allowRepeats
          ? "each-draw"
          : "first-draw-then-renormalized"
      });

      return {
        result,
        summary: result.join(", "),
        detail: {
          selected: result,
          selectedIndices: selectedEntries.map((entry) => entry.index),
          fairness
        },
        fairness
      };
    }

    case "shuffle": {
      requireItems(items, 2);
      const result = shuffle(items, rng);
      return {
        result,
        summary: result.slice(0, 3).join(", ") + (result.length > 3 ? "…" : ""),
        detail: { order: result }
      };
    }

    case "teams": {
      requireItems(items, 2, "people");
      const count = requireInteger(config.teamCount, "Team count", 2, Math.min(12, items.length));
      const result = partition(items, count, rng);
      return { result, summary: `${count} teams`, detail: { groups: result } };
    }

    case "groups": {
      requireItems(items, 2);
      const count = requireInteger(config.groupCount, "Group count", 2, Math.min(20, items.length));
      const result = partition(items, count, rng);
      return { result, summary: `${count} groups`, detail: { groups: result } };
    }

    case "pairs": {
      requireItems(items, 2, "people");
      const result = pairs(items, rng);
      return { result, summary: `${result.length} groups`, detail: { pairs: result } };
    }

    case "assignment": {
      requireItems(items, 1, "sources");
      const targets = Array.isArray(config.targets) ? config.targets : [];
      requireItems(targets, 1, "targets");
      const orderedSources = shuffle(
        items.map((source, originalIndex) => ({ source, originalIndex })),
        rng
      );
      const orderedTargets = shuffle(targets, rng);
      const assigned = orderedSources.map((entry, index) => ({
        ...entry,
        target: orderedTargets[index % orderedTargets.length]
      }));
      assigned.sort((a, b) => a.originalIndex - b.originalIndex);
      const result = assigned.map(({ source, target }) => ({ source, target }));
      return { result, summary: `${result.length} assignments`, detail: { assignments: result } };
    }

    case "ladder": {
      requireItems(items, 2, "players");
      const outcomes = Array.isArray(config.outcomes) ? config.outcomes : [];
      if (outcomes.length !== items.length) {
        throw new ToolValidationError(
          "Ladder needs exactly one outcome for every player.",
          "LADDER_SIZE_MISMATCH"
        );
      }
      const ladder = buildLadder(items.length, rng);
      const result = items.map((source, sourceIndex) => ({
        source,
        target: outcomes[ladder.bottomForSource[sourceIndex]],
        bottomIndex: ladder.bottomForSource[sourceIndex]
      }));
      return {
        result,
        summary: `${result.length} ladder paths`,
        detail: { ladder, mapping: result }
      };
    }

    case "tournament": {
      const draw = createTournamentDraw(items, rng);
      const result = draw.matches;
      return {
        result,
        summary: `${draw.matches.length} first-round slots`,
        detail: draw
      };
    }

    case "secret-santa": {
      requireItems(items, 2, "people");
      if (new Set(items).size !== items.length) {
        throw new ToolValidationError(
          "Secret Santa currently requires unique participant names.",
          "DUPLICATE_NAMES"
        );
      }
      const receivers = derangement(items, rng);
      const assignments = items.map((source, index) => ({
        source,
        target: receivers[index]
      }));
      return {
        result: { summary: "ASSIGNMENTS READY", sub: `${items.length} private matches` },
        summary: `${items.length} private assignments generated`,
        detail: null,
        statePatch: { secretAssignments: assignments, secretReveal: null }
      };
    }

    case "elimination": {
      requireItems(items, 2, "entrants");
      const signature = items.join("\u001f");
      const needsReset = config.eliminationSignature !== signature || !Array.isArray(config.eliminationRemaining);
      const remaining = needsReset ? [...items] : [...config.eliminationRemaining];
      const out = needsReset ? [] : [...(config.eliminationOut || [])];

      if (remaining.length <= 1) {
        throw new ToolValidationError(
          "This elimination is complete. Reset it to start again.",
          "ELIMINATION_COMPLETE"
        );
      }

      const eliminated = pick(remaining, rng);
      remaining.splice(remaining.indexOf(eliminated), 1);
      out.push(eliminated);
      const winner = remaining.length === 1 ? remaining[0] : null;
      const result = {
        eliminated,
        winner,
        summary: winner ? `WINNER: ${winner}` : `${eliminated} OUT`,
        sub: winner ? "Last entrant standing" : `${remaining.length} remain`
      };

      return {
        result,
        summary: winner ? `Winner: ${winner}` : `Eliminated: ${eliminated}`,
        detail: { remaining: remaining.length, eliminatedCount: out.length },
        statePatch: {
          eliminationSignature: signature,
          eliminationRemaining: remaining,
          eliminationOut: out
        }
      };
    }

    case "cards": {
      let deck = Array.isArray(config.deck) ? [...config.deck] : null;
      if (!deck) deck = shuffle(makeStandardDeck(), rng);
      if (deck.length === 0) {
        throw new ToolValidationError(
          "The deck is empty. Reset or reshuffle the deck to draw again.",
          "DECK_EMPTY"
        );
      }
      const card = deck.shift();
      const result = { card, remaining: deck.length };
      return {
        result,
        summary: card,
        detail: { remaining: deck.length },
        statePatch: { deck }
      };
    }

    case "chance": {
      const chance = Number(config.chance);
      if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
        throw new ToolValidationError("Chance must be from 0% to 100%.", "INVALID_CHANCE");
      }
      const success = rng.float() * 100 < chance;
      const result = { summary: success ? "YES" : "NO", sub: `${chance}% success chance` };
      return { result, summary: result.summary, detail: { chance } };
    }

    case "lottery": {
      const count = requireInteger(config.lotteryCount, "Number count", 1, 50);
      const max = requireInteger(config.lotteryMax, "Maximum number", 1, 10000);
      if (count > max) {
        throw new ToolValidationError(
          "You cannot draw more unique numbers than the range contains.",
          "SAMPLE_TOO_LARGE"
        );
      }
      const numbers = Array.from({ length: max }, (_, index) => index + 1);
      const result = sample(numbers, count, rng).sort((a, b) => a - b);
      return { result, summary: result.join(", ") };
    }

    case "color": {
      const result = randomHexColor(rng);
      return { result, summary: result };
    }

    case "date": {
      const start = Date.parse(String(config.dateStart) + "T00:00:00Z");
      const end = Date.parse(String(config.dateEnd) + "T00:00:00Z");
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        throw new ToolValidationError("Choose a valid date range.", "INVALID_DATE_RANGE");
      }
      const days = Math.floor((end - start) / 86400000);
      const offset = rng.int(0, days);
      const date = new Date(start + offset * 86400000);
      return {
        result: { iso: date.toISOString().slice(0, 10), timestamp: date.getTime() },
        summary: date.toISOString().slice(0, 10)
      };
    }

    case "time": {
      const toMinutes = (value) => {
        const parts = String(value).split(":").map(Number);
        return parts.length === 2 && parts.every(Number.isFinite)
          ? parts[0] * 60 + parts[1]
          : NaN;
      };
      const start = toMinutes(config.timeStart);
      const end = toMinutes(config.timeEnd);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > 1439 || start > end) {
        throw new ToolValidationError(
          "Choose a valid time range within one day.",
          "INVALID_TIME_RANGE"
        );
      }
      const minutes = rng.int(start, end);
      const result = String(Math.floor(minutes / 60)).padStart(2, "0")
        + ":"
        + String(minutes % 60).padStart(2, "0");
      return { result, summary: result };
    }

    case "coordinate": {
      const xMin = Number(config.xMin);
      const xMax = Number(config.xMax);
      const yMin = Number(config.yMin);
      const yMax = Number(config.yMax);
      requireRange(xMin, xMax, "X");
      requireRange(yMin, yMax, "Y");
      const x = rng.int(xMin, xMax);
      const y = rng.int(yMin, yMax);
      const result = { summary: `(${x}, ${y})`, x, y };
      return { result, summary: result.summary };
    }

    case "direction": {
      const result = pick(["N", "NE", "E", "SE", "S", "SW", "W", "NW"], rng);
      return { result, summary: result };
    }

    case "letter": {
      const result = String.fromCharCode(65 + rng.int(0, 25));
      return { result, summary: result };
    }

    case "rps": {
      const result = pick(["ROCK", "PAPER", "SCISSORS"], rng);
      return { result, summary: result };
    }

    default:
      throw new ToolValidationError("This randomizer is not implemented.", "UNSUPPORTED_TOOL");
  }
}
