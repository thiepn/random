import assert from "node:assert/strict";
import { SeededRandom } from "../src/random-core.js";
import {
  NumberEngineError,
  generateRandomNumbers
} from "../src/number-engine.js";

{
  const rng = new SeededRandom("number-default");
  const result = generateRandomNumbers(
    { mode: "integer", min: 1, max: 100, count: 1, unique: false },
    rng
  );
  assert.equal(result.values.length, 1);
  assert.ok(result.values[0] >= 1 && result.values[0] <= 100);
}

{
  const result = generateRandomNumbers(
    { mode: "integer", min: -1000000, max: 1000000, count: 100, unique: true },
    new SeededRandom("number-unique")
  );
  assert.equal(result.values.length, 100);
  assert.equal(new Set(result.values).size, 100);
}

{
  const result = generateRandomNumbers(
    { mode: "decimal", min: 0, max: 1, precision: 2, count: 20, unique: true },
    new SeededRandom("number-decimal")
  );
  assert.equal(result.values.length, 20);
  assert.equal(new Set(result.displayValues).size, 20);
  assert.ok(result.displayValues.every((value) => /^\d+\.\d{2}$/.test(value)));
}

{
  const result = generateRandomNumbers(
    { mode: "decimal", min: -1.25, max: -1.2, precision: 2, count: 6, unique: true },
    new SeededRandom("number-negative-decimal")
  );
  assert.deepEqual(
    [...result.displayValues].sort(),
    ["-1.20", "-1.21", "-1.22", "-1.23", "-1.24", "-1.25"].sort()
  );
}

assert.throws(
  () => generateRandomNumbers(
    { mode: "decimal", min: 0.001, max: 1, precision: 2, count: 1 },
    new SeededRandom("bad-precision")
  ),
  (error) => error instanceof NumberEngineError
    && error.code === "BOUND_PRECISION_MISMATCH"
);

assert.throws(
  () => generateRandomNumbers(
    { mode: "integer", min: 1, max: 3, count: 4, unique: true },
    new SeededRandom("too-many")
  ),
  (error) => error instanceof NumberEngineError
    && error.code === "UNIQUE_COUNT_TOO_LARGE"
);

console.log("Number engine certification tests passed.");
