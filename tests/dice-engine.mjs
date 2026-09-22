import assert from "node:assert/strict";
import { SeededRandom } from "../src/random-core.js";
import {
  DiceExpressionError,
  tokenizeDiceExpression,
  parseDiceExpression,
  formatDiceAst,
  rollDiceExpression,
  describeDiceExpression
} from "../src/dice-engine.js";

{
  const tokens = tokenizeDiceExpression("4d6kh3 + 2");
  assert.equal(tokens[0].type, "NUMBER");
  assert.equal(tokens[1].type, "D");
  assert.equal(tokens[3].type, "KH");
}

{
  const ast = parseDiceExpression("2d20kh1+5");
  assert.equal(ast.type, "binary");
  assert.equal(ast.left.type, "dice");
  assert.equal(ast.left.keepDrop.kind, "kh");
  assert.equal(ast.left.keepDrop.amount, 1);
  assert.equal(formatDiceAst(ast), "(2d20kh1 + 5)");
}

{
  const ast = parseDiceExpression("6d6r<2!kh4");
  assert.equal(ast.type, "dice");
  assert.equal(ast.reroll.comparator, "<");
  assert.equal(ast.reroll.threshold, 2);
  assert.equal(ast.explode.implicitMax, true);
  assert.equal(ast.keepDrop.kind, "kh");
}

{
  const golden = rollDiceExpression(
    "2d20kh1+3",
    new SeededRandom("dice-golden-v1")
  );
  assert.deepEqual(
    golden.diceGroups[0].dice.map((die) => die.total),
    [10, 7]
  );
  assert.equal(golden.total, 13);
  assert.equal(golden.canonical, "(2d20kh1 + 3)");
}

{
  const result = rollDiceExpression(
    "2d6+1d4+3",
    new SeededRandom("multi-term")
  );
  assert.equal(result.diceGroups.length, 2);
  assert.equal(
    result.total,
    result.diceGroups[0].value + result.diceGroups[1].value + 3
  );
}

{
  const result = rollDiceExpression(
    "4d6kh3",
    new SeededRandom("keep-high")
  );
  const dice = result.diceGroups[0].dice;
  assert.equal(dice.filter((die) => die.kept).length, 3);
  assert.equal(
    result.total,
    dice.filter((die) => die.kept).reduce((sum, die) => sum + die.total, 0)
  );
}

{
  const advantage = rollDiceExpression(
    "2d20kh1",
    new SeededRandom("advantage")
  );
  const values = advantage.diceGroups[0].dice.map((die) => die.total);
  assert.equal(advantage.total, Math.max(...values));

  const disadvantage = rollDiceExpression(
    "2d20kl1",
    new SeededRandom("advantage")
  );
  const lowValues = disadvantage.diceGroups[0].dice.map((die) => die.total);
  assert.equal(disadvantage.total, Math.min(...lowValues));
}

{
  const reroll = rollDiceExpression(
    "20d6r<3",
    new SeededRandom("reroll")
  );
  const group = reroll.diceGroups[0];
  assert.ok(group.dice.every((die) =>
    die.chain.every((part) => part.value >= 3)
  ));
  assert.ok(group.dice.some((die) =>
    die.chain.some((part) => part.attempts.length > 1)
  ));
}

{
  const exploding = rollDiceExpression(
    "20d2!",
    new SeededRandom("explode")
  );
  assert.ok(exploding.randomRollCount >= 20);
  assert.ok(exploding.diceGroups[0].dice.some((die) => die.chain.length > 1));
}

{
  const arithmetic = rollDiceExpression(
    "(2d6+2)*3/2",
    new SeededRandom("arithmetic")
  );
  assert.ok(Number.isFinite(arithmetic.total));
  assert.equal(arithmetic.total, arithmetic.evaluation.value);
}

{
  const detail = describeDiceExpression("6d6r<2!kh4+2");
  assert.equal(detail.groups.length, 1);
  assert.match(detail.groups[0], /keep highest 4/);
  assert.match(detail.groups[0], /reroll/);
  assert.match(detail.groups[0], /explode/);
}

assert.throws(
  () => parseDiceExpression("1d1!"),
  (error) => error instanceof DiceExpressionError
    && error.code === "NON_TERMINATING_EXPLODE"
);

assert.throws(
  () => parseDiceExpression("1d6r>=1"),
  (error) => error instanceof DiceExpressionError
    && error.code === "NON_TERMINATING_REROLL"
);

assert.throws(
  () => parseDiceExpression("4d6kh5"),
  (error) => error instanceof DiceExpressionError
    && error.code === "INVALID_KEEP_AMOUNT"
);

assert.throws(
  () => rollDiceExpression("1/0", new SeededRandom("div-zero")),
  (error) => error instanceof DiceExpressionError
    && error.code === "DIVISION_BY_ZERO"
);

console.log("Dice expression certification tests passed.");
