const DEFAULT_LIMITS = Object.freeze({
  maxDice: 1000,
  maxSides: 1000000,
  maxAstNodes: 256,
  maxRolls: 10000,
  maxRerollsPerRoll: 100,
  maxExplosionsPerDie: 100
});

export class DiceExpressionError extends Error {
  constructor(message, code = "INVALID_DICE_EXPRESSION", position = null) {
    super(message);
    this.name = "DiceExpressionError";
    this.code = code;
    this.position = position;
  }
}

function token(type, value, position) {
  return { type, value, position };
}

export function tokenizeDiceExpression(source) {
  const input = String(source ?? "");
  const tokens = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const rest = input.slice(index);
    const lower = rest.toLowerCase();

    const modifier = /^(kh|kl|dh|dl)/i.exec(rest);
    if (modifier) {
      tokens.push(token(modifier[1].toUpperCase(), modifier[1].toLowerCase(), index));
      index += modifier[1].length;
      continue;
    }

    const comparator = /^(<=|>=|!=|==|=|<|>)/.exec(rest);
    if (comparator) {
      const normalized = comparator[1] === "==" ? "=" : comparator[1];
      tokens.push(token("COMPARE", normalized, index));
      index += comparator[1].length;
      continue;
    }

    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) {
        throw new DiceExpressionError("Number is too large.", "NUMBER_OVERFLOW", index);
      }
      tokens.push(token("NUMBER", value, index));
      index += number[0].length;
      continue;
    }

    if (lower.startsWith("d")) {
      tokens.push(token("D", "d", index));
      index += 1;
      continue;
    }

    if (lower.startsWith("r")) {
      tokens.push(token("R", "r", index));
      index += 1;
      continue;
    }

    if (char === "!") {
      tokens.push(token("BANG", "!", index));
      index += 1;
      continue;
    }

    const single = {
      "+": "PLUS",
      "-": "MINUS",
      "*": "STAR",
      "/": "SLASH",
      "(": "LPAREN",
      ")": "RPAREN"
    }[char];

    if (single) {
      tokens.push(token(single, char, index));
      index += 1;
      continue;
    }

    throw new DiceExpressionError(
      `Unexpected character “${char}”.`,
      "UNEXPECTED_CHARACTER",
      index
    );
  }

  tokens.push(token("EOF", null, input.length));
  return tokens;
}

class Parser {
  constructor(tokens, limits) {
    this.tokens = tokens;
    this.index = 0;
    this.nodeCount = 0;
    this.limits = limits;
  }

  current() {
    return this.tokens[this.index];
  }

  peek(offset = 1) {
    return this.tokens[this.index + offset] || this.tokens[this.tokens.length - 1];
  }

  match(type) {
    if (this.current().type !== type) return null;
    const current = this.current();
    this.index += 1;
    return current;
  }

  expect(type, message) {
    const found = this.match(type);
    if (found) return found;
    throw new DiceExpressionError(
      message || `Expected ${type}.`,
      "UNEXPECTED_TOKEN",
      this.current().position
    );
  }

  node(value) {
    this.nodeCount += 1;
    if (this.nodeCount > this.limits.maxAstNodes) {
      throw new DiceExpressionError(
        "Dice expression is too complex.",
        "AST_LIMIT",
        this.current().position
      );
    }
    return value;
  }

  parse() {
    const expression = this.parseAdditive();
    this.expect("EOF", "Unexpected content after the expression.");
    return expression;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();

    while (this.current().type === "PLUS" || this.current().type === "MINUS") {
      const operator = this.current().value;
      this.index += 1;
      const right = this.parseMultiplicative();
      left = this.node({ type: "binary", operator, left, right });
    }

    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();

    while (this.current().type === "STAR" || this.current().type === "SLASH") {
      const operator = this.current().value;
      this.index += 1;
      const right = this.parseUnary();
      left = this.node({ type: "binary", operator, left, right });
    }

    return left;
  }

  parseUnary() {
    if (this.current().type === "PLUS" || this.current().type === "MINUS") {
      const operator = this.current().value;
      const position = this.current().position;
      this.index += 1;
      return this.node({
        type: "unary",
        operator,
        argument: this.parseUnary(),
        position
      });
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.match("LPAREN")) {
      const expression = this.parseAdditive();
      this.expect("RPAREN", "Missing closing parenthesis.");
      return expression;
    }

    if (this.current().type === "D") {
      return this.parseDice(1);
    }

    if (this.current().type === "NUMBER") {
      const numberToken = this.current();
      if (this.peek().type === "D") {
        this.index += 1;
        return this.parseDice(numberToken.value, true, numberToken.position);
      }
      this.index += 1;
      return this.node({
        type: "number",
        value: numberToken.value,
        position: numberToken.position
      });
    }

    throw new DiceExpressionError(
      "Expected a number, dice term, or parenthesized expression.",
      "EXPECTED_PRIMARY",
      this.current().position
    );
  }

  parseDice(count = 1, countAlreadyConsumed = false, countPosition = null) {
    const start = countPosition ?? this.current().position;

    if (!countAlreadyConsumed) {
      this.expect("D", "Expected d in dice notation.");
    } else {
      this.expect("D", "Expected d after dice count.");
    }

    const sidesToken = this.expect("NUMBER", "Dice notation needs a number of sides.");
    const sides = sidesToken.value;

    if (!Number.isSafeInteger(count) || count < 1 || count > this.limits.maxDice) {
      throw new DiceExpressionError(
        `Dice count must be a whole number from 1 to ${this.limits.maxDice}.`,
        "INVALID_DICE_COUNT",
        start
      );
    }

    if (!Number.isSafeInteger(sides) || sides < 1 || sides > this.limits.maxSides) {
      throw new DiceExpressionError(
        `Die sides must be a whole number from 1 to ${this.limits.maxSides}.`,
        "INVALID_DIE_SIDES",
        sidesToken.position
      );
    }

    let keepDrop = null;
    let reroll = null;
    let explode = null;

    while (true) {
      const current = this.current();

      if (["KH", "KL", "DH", "DL"].includes(current.type)) {
        if (keepDrop) {
          throw new DiceExpressionError(
            "A dice term can only have one keep/drop modifier.",
            "DUPLICATE_KEEP_DROP",
            current.position
          );
        }
        this.index += 1;
        const amount = this.expect(
          "NUMBER",
          current.value + " needs a whole-number amount."
        );
        if (!Number.isSafeInteger(amount.value) || amount.value < 0) {
          throw new DiceExpressionError(
            "Keep/drop amount must be a non-negative whole number.",
            "INVALID_KEEP_DROP",
            amount.position
          );
        }
        keepDrop = { kind: current.value, amount: amount.value };
        continue;
      }

      if (current.type === "R") {
        if (reroll) {
          throw new DiceExpressionError(
            "A dice term can only have one reroll condition.",
            "DUPLICATE_REROLL",
            current.position
          );
        }
        this.index += 1;
        let comparator = "=";
        if (this.current().type === "COMPARE") {
          comparator = this.current().value;
          this.index += 1;
        }
        const threshold = this.expect("NUMBER", "Reroll needs a threshold.");
        if (!Number.isSafeInteger(threshold.value)) {
          throw new DiceExpressionError(
            "Reroll threshold must be a whole number.",
            "INVALID_REROLL_THRESHOLD",
            threshold.position
          );
        }
        reroll = { comparator, threshold: threshold.value };
        continue;
      }

      if (current.type === "BANG") {
        if (explode) {
          throw new DiceExpressionError(
            "A dice term can only have one explode condition.",
            "DUPLICATE_EXPLODE",
            current.position
          );
        }
        this.index += 1;
        if (this.current().type === "COMPARE") {
          const comparator = this.current().value;
          this.index += 1;
          const threshold = this.expect("NUMBER", "Explode condition needs a threshold.");
          if (!Number.isSafeInteger(threshold.value)) {
            throw new DiceExpressionError(
              "Explode threshold must be a whole number.",
              "INVALID_EXPLODE_THRESHOLD",
              threshold.position
            );
          }
          explode = { comparator, threshold: threshold.value };
        } else {
          explode = { comparator: "=", threshold: sides, implicitMax: true };
        }
        continue;
      }

      break;
    }

    validateModifiers({ count, sides, keepDrop, reroll, explode }, start);

    return this.node({
      type: "dice",
      count,
      sides,
      keepDrop,
      reroll,
      explode,
      position: start
    });
  }
}

function compare(value, condition) {
  if (!condition) return false;
  const threshold = condition.threshold;
  switch (condition.comparator) {
    case "=": return value === threshold;
    case "!=": return value !== threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    default: return false;
  }
}

function conditionMatchesEveryFace(sides, condition) {
  if (!condition) return false;
  for (let face = 1; face <= Math.min(sides, 10000); face += 1) {
    if (!compare(face, condition)) return false;
  }

  if (sides <= 10000) return true;

  const probes = [1, 2, Math.floor(sides / 2), sides - 1, sides];
  return probes.every((value) => compare(value, condition));
}

function validateModifiers(node, position) {
  const { count, sides, keepDrop, reroll, explode } = node;

  if (keepDrop) {
    if (keepDrop.kind === "kh" || keepDrop.kind === "kl") {
      if (keepDrop.amount < 1 || keepDrop.amount > count) {
        throw new DiceExpressionError(
          `${keepDrop.kind} amount must be from 1 to ${count}.`,
          "INVALID_KEEP_AMOUNT",
          position
        );
      }
    } else if (keepDrop.amount < 0 || keepDrop.amount >= count) {
      throw new DiceExpressionError(
        `${keepDrop.kind} amount must be from 0 to ${Math.max(0, count - 1)}.`,
        "INVALID_DROP_AMOUNT",
        position
      );
    }
  }

  if (reroll && conditionMatchesEveryFace(sides, reroll)) {
    throw new DiceExpressionError(
      "Reroll condition matches every face and would never terminate.",
      "NON_TERMINATING_REROLL",
      position
    );
  }

  if (explode && conditionMatchesEveryFace(sides, explode)) {
    throw new DiceExpressionError(
      "Explode condition matches every face and would never terminate.",
      "NON_TERMINATING_EXPLODE",
      position
    );
  }
}

export function parseDiceExpression(source, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  const text = String(source ?? "").trim();
  if (!text) {
    throw new DiceExpressionError("Enter a dice expression.", "EMPTY_EXPRESSION", 0);
  }
  if (text.length > 1000) {
    throw new DiceExpressionError("Dice expression is too long.", "SOURCE_LIMIT", 1000);
  }
  return new Parser(tokenizeDiceExpression(text), limits).parse();
}

function modifierText(node) {
  let text = "";
  if (node.keepDrop) text += node.keepDrop.kind + node.keepDrop.amount;
  if (node.reroll) text += "r" + node.reroll.comparator + node.reroll.threshold;
  if (node.explode) {
    text += "!";
    if (!node.explode.implicitMax) {
      text += node.explode.comparator + node.explode.threshold;
    }
  }
  return text;
}

export function formatDiceAst(node) {
  switch (node.type) {
    case "number":
      return String(node.value);
    case "dice":
      return `${node.count}d${node.sides}${modifierText(node)}`;
    case "unary":
      return node.operator + formatDiceAst(node.argument);
    case "binary":
      return `(${formatDiceAst(node.left)} ${node.operator} ${formatDiceAst(node.right)})`;
    default:
      return "?";
  }
}

function ensureFinite(value, position) {
  if (!Number.isFinite(value)) {
    throw new DiceExpressionError(
      "Expression result is not finite.",
      "NON_FINITE_RESULT",
      position
    );
  }
  return value;
}

function rollFace(node, rng, runtime) {
  if (runtime.rolls >= runtime.limits.maxRolls) {
    throw new DiceExpressionError(
      "Dice expression exceeded the maximum roll budget.",
      "ROLL_LIMIT",
      node.position
    );
  }
  runtime.rolls += 1;
  return rng.int(1, node.sides);
}

function rollWithRerolls(node, rng, runtime) {
  const attempts = [];
  let value = rollFace(node, rng, runtime);
  attempts.push(value);

  if (node.reroll) {
    let rerolls = 0;
    while (compare(value, node.reroll)) {
      rerolls += 1;
      if (rerolls > runtime.limits.maxRerollsPerRoll) {
        throw new DiceExpressionError(
          "Reroll limit exceeded.",
          "REROLL_LIMIT",
          node.position
        );
      }
      value = rollFace(node, rng, runtime);
      attempts.push(value);
    }
  }

  return { value, attempts };
}

function rollDie(node, rng, runtime, index) {
  const chain = [];
  let explosionCount = 0;

  while (true) {
    const rolled = rollWithRerolls(node, rng, runtime);
    chain.push(rolled);

    if (!node.explode || !compare(rolled.value, node.explode)) break;

    explosionCount += 1;
    if (explosionCount > runtime.limits.maxExplosionsPerDie) {
      throw new DiceExpressionError(
        "Explosion limit exceeded.",
        "EXPLOSION_LIMIT",
        node.position
      );
    }
  }

  return {
    index,
    chain,
    total: chain.reduce((sum, part) => sum + part.value, 0),
    kept: true
  };
}

function applyKeepDrop(dice, modifier) {
  if (!modifier) return;

  const order = dice
    .map((die, index) => ({ index, total: die.total }))
    .sort((a, b) => a.total - b.total || a.index - b.index);

  const keep = new Set();

  if (modifier.kind === "kh") {
    order.slice(-modifier.amount).forEach((entry) => keep.add(entry.index));
  } else if (modifier.kind === "kl") {
    order.slice(0, modifier.amount).forEach((entry) => keep.add(entry.index));
  } else if (modifier.kind === "dh") {
    order.slice(0, Math.max(0, order.length - modifier.amount))
      .forEach((entry) => keep.add(entry.index));
  } else if (modifier.kind === "dl") {
    order.slice(modifier.amount).forEach((entry) => keep.add(entry.index));
  }

  dice.forEach((die, index) => {
    die.kept = keep.has(index);
  });
}

function evaluateNode(node, rng, runtime) {
  if (node.type === "number") {
    return {
      type: "number",
      value: node.value,
      source: String(node.value)
    };
  }

  if (node.type === "unary") {
    const argument = evaluateNode(node.argument, rng, runtime);
    const value = node.operator === "-" ? -argument.value : argument.value;
    return {
      type: "unary",
      operator: node.operator,
      argument,
      value: ensureFinite(value, node.position)
    };
  }

  if (node.type === "binary") {
    const left = evaluateNode(node.left, rng, runtime);
    const right = evaluateNode(node.right, rng, runtime);
    let value;

    switch (node.operator) {
      case "+": value = left.value + right.value; break;
      case "-": value = left.value - right.value; break;
      case "*": value = left.value * right.value; break;
      case "/":
        if (right.value === 0) {
          throw new DiceExpressionError(
            "Division by zero.",
            "DIVISION_BY_ZERO",
            node.position
          );
        }
        value = left.value / right.value;
        break;
      default:
        throw new DiceExpressionError("Unknown arithmetic operator.", "UNKNOWN_OPERATOR");
    }

    return {
      type: "binary",
      operator: node.operator,
      left,
      right,
      value: ensureFinite(value, node.position)
    };
  }

  if (node.type === "dice") {
    const dice = Array.from(
      { length: node.count },
      (_, index) => rollDie(node, rng, runtime, index)
    );

    applyKeepDrop(dice, node.keepDrop);

    const value = dice
      .filter((die) => die.kept)
      .reduce((sum, die) => sum + die.total, 0);

    return {
      type: "dice",
      notation: formatDiceAst(node),
      count: node.count,
      sides: node.sides,
      keepDrop: node.keepDrop,
      reroll: node.reroll,
      explode: node.explode,
      dice,
      value: ensureFinite(value, node.position)
    };
  }

  throw new DiceExpressionError("Unknown AST node.", "UNKNOWN_AST_NODE");
}

function collectDiceGroups(result, groups = []) {
  if (!result) return groups;
  if (result.type === "dice") groups.push(result);
  else if (result.type === "binary") {
    collectDiceGroups(result.left, groups);
    collectDiceGroups(result.right, groups);
  } else if (result.type === "unary") {
    collectDiceGroups(result.argument, groups);
  }
  return groups;
}

export function rollDiceExpression(source, rng, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  const ast = parseDiceExpression(source, limits);
  const runtime = { limits, rolls: 0 };
  const evaluation = evaluateNode(ast, rng, runtime);

  return {
    version: "dice-expression.v1",
    source: String(source).trim(),
    canonical: formatDiceAst(ast),
    ast,
    evaluation,
    diceGroups: collectDiceGroups(evaluation),
    total: evaluation.value,
    randomRollCount: runtime.rolls
  };
}

export function describeDiceExpression(source, options = {}) {
  const ast = parseDiceExpression(source, options);
  const groups = [];

  function visit(node) {
    if (node.type === "dice") {
      const parts = [`${node.count} × D${node.sides}`];
      if (node.keepDrop) {
        const names = {
          kh: "keep highest",
          kl: "keep lowest",
          dh: "drop highest",
          dl: "drop lowest"
        };
        parts.push(`${names[node.keepDrop.kind]} ${node.keepDrop.amount}`);
      }
      if (node.reroll) {
        parts.push(
          `reroll while value ${node.reroll.comparator} ${node.reroll.threshold}`
        );
      }
      if (node.explode) {
        parts.push(
          node.explode.implicitMax
            ? "explode on maximum face"
            : `explode while value ${node.explode.comparator} ${node.explode.threshold}`
        );
      }
      groups.push(parts.join(" · "));
    } else if (node.type === "binary") {
      visit(node.left);
      visit(node.right);
    } else if (node.type === "unary") {
      visit(node.argument);
    }
  }

  visit(ast);

  return {
    canonical: formatDiceAst(ast),
    groups
  };
}

export const DICE_EXPRESSION_LIMITS = DEFAULT_LIMITS;
