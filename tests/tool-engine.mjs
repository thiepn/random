import assert from "node:assert/strict";
import { SeededRandom, pick } from "../src/random-core.js";
import {
  executeTool,
  buildLadder,
  createTournamentDraw,
  makeStandardDeck,
  ToolValidationError
} from "../src/tool-engine.js";

function run(tool, config = {}, seed = tool) {
  return executeTool(tool, config, new SeededRandom(seed));
}

{
  const result = run("dice", { diceCount: 4, diceSides: 20 });
  assert.equal(result.result.values.length, 4);
  assert.ok(result.result.values.every((value) => value >= 1 && value <= 20));
  assert.equal(result.result.total, result.result.values.reduce((a, b) => a + b, 0));
}

{
  const result = run("sampler", { items: ["A", "B", "C", "D"], sampleCount: 3 });
  assert.equal(result.result.length, 3);
  assert.equal(new Set(result.result).size, 3);
}

{
  const seed = "picker-default-compat";
  const input = ["A", "B", "C", "D"];
  const expected = pick(input, new SeededRandom(seed));
  const actual = run("picker", { items: input, selectionEntries: [] }, seed);
  assert.equal(actual.result, expected);
}

{
  for (let index = 0; index < 80; index += 1) {
    const result = run("picker", {
      items: ["Never", "Sometimes", "Often"],
      selectionEntries: [
        { key: "Never\u001f1", label: "Never", weight: 0, excluded: false },
        { key: "Sometimes\u001f1", label: "Sometimes", weight: 1, excluded: false },
        { key: "Often\u001f1", label: "Often", weight: 4, excluded: false }
      ]
    }, "weighted-picker-" + index);
    assert.notEqual(result.result, "Never");
    const total = result.fairness.probabilities.reduce(
      (sum, entry) => sum + entry.probability,
      0
    );
    assert.ok(Math.abs(total - 1) < 1e-12);
  }
}

{
  const result = run("wheel", {
    items: ["Excluded", "A", "B"],
    selectionEntries: [
      { key: "Excluded\u001f1", label: "Excluded", weight: 100, excluded: true },
      { key: "A\u001f1", label: "A", weight: 1, excluded: false },
      { key: "B\u001f1", label: "B", weight: 3, excluded: false }
    ]
  }, "weighted-wheel");
  assert.notEqual(result.result, "Excluded");
  assert.equal(result.fairness.eligibleCount, 2);
  assert.equal(result.fairness.excludedCount, 1);
}

{
  const unique = run("sampler", {
    items: ["A", "B", "C", "D"],
    sampleCount: 3,
    allowRepeats: false,
    selectionEntries: [
      { key: "A\u001f1", label: "A", weight: 1, excluded: false },
      { key: "B\u001f1", label: "B", weight: 2, excluded: false },
      { key: "C\u001f1", label: "C", weight: 3, excluded: false },
      { key: "D\u001f1", label: "D", weight: 4, excluded: false }
    ]
  }, "weighted-sampler-unique");
  assert.equal(new Set(unique.result).size, 3);
  assert.equal(unique.fairness.probabilityMeaning, "first-draw-then-renormalized");

  const repeated = run("sampler", {
    items: ["A", "B"],
    sampleCount: 5,
    allowRepeats: true,
    selectionEntries: [
      { key: "A\u001f1", label: "A", weight: 1, excluded: false },
      { key: "B\u001f1", label: "B", weight: 0, excluded: false }
    ]
  }, "weighted-sampler-repeat");
  assert.deepEqual(repeated.result, ["A", "A", "A", "A", "A"]);
  assert.equal(repeated.fairness.allowRepeats, true);
  assert.equal(repeated.fairness.probabilityMeaning, "each-draw");
}

{
  const result = run("groups", { items: ["A", "B", "C", "D", "E"], groupCount: 2 });
  assert.equal(result.result.flat().length, 5);
  assert.ok(Math.max(...result.result.map((group) => group.length)) - Math.min(...result.result.map((group) => group.length)) <= 1);
}

{
  const result = run("assignment", {
    items: ["A", "B", "C", "D", "E", "F"],
    targets: ["X", "Y", "Z"]
  });
  const counts = new Map(["X", "Y", "Z"].map((target) => [target, 0]));
  result.result.forEach(({ target }) => counts.set(target, counts.get(target) + 1));
  assert.ok(Math.max(...counts.values()) - Math.min(...counts.values()) <= 1);
}

{
  const ladder = buildLadder(6, new SeededRandom("ladder"));
  assert.equal(ladder.bottomForSource.length, 6);
  assert.equal(new Set(ladder.bottomForSource).size, 6);
  assert.ok(ladder.rungs.every(({ left }) => left >= 0 && left < 5));
}

{
  const result = run("ladder", {
    items: ["A", "B", "C", "D"],
    outcomes: ["1", "2", "3", "4"]
  });
  assert.equal(new Set(result.result.map((row) => row.target)).size, 4);
  assert.ok(result.detail.ladder.rungs.length >= 0);
}

{
  const draw = createTournamentDraw(["A", "B", "C", "D", "E", "F"], new SeededRandom("tournament"));
  assert.equal(draw.bracketSize, 8);
  assert.equal(draw.byeCount, 2);
  assert.equal(draw.matches.length, 4);
  const participants = draw.matches.flatMap((match) => [match.a, match.b].filter(Boolean));
  assert.deepEqual([...participants].sort(), ["A", "B", "C", "D", "E", "F"]);
}

{
  const result = run("secret-santa", { items: ["A", "B", "C", "D", "E"] });
  result.statePatch.secretAssignments.forEach(({ source, target }) => assert.notEqual(source, target));
  assert.equal(new Set(result.statePatch.secretAssignments.map((entry) => entry.target)).size, 5);
}

{
  let state = { items: ["A", "B", "C"], eliminationSignature: "", eliminationRemaining: null, eliminationOut: [] };
  const first = run("elimination", state, "elim-1");
  state = { ...state, ...first.statePatch };
  const second = run("elimination", state, "elim-2");
  assert.equal(second.statePatch.eliminationRemaining.length, 1);
  assert.ok(second.result.winner);
}

{
  const deck = makeStandardDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck).size, 52);
  let config = { deck: null };
  for (let i = 0; i < 52; i += 1) {
    const step = run("cards", config, "deck-" + i);
    config = { deck: step.statePatch.deck };
  }
  assert.equal(config.deck.length, 0);
  assert.throws(() => run("cards", config, "deck-empty"), ToolValidationError);
}

{
  assert.throws(
    () => run("wheel", { items: ["only"] }),
    (error) => error instanceof ToolValidationError && error.code === "NOT_ENOUGH_ITEMS"
  );
}

console.log("Tool engine certification tests passed.");
