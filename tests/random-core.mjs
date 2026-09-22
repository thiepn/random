import assert from "node:assert/strict";
import {
  SeededRandom,
  unbiasedInt,
  shuffle,
  sample,
  weightedPick,
  partition,
  pairs
} from "../src/random-core.js";

const golden = new SeededRandom("golden-001");
assert.deepEqual(
  Array.from({ length: 10 }, () => golden.nextUint32()),
  [
    2494410989,
    1760700071,
    826613132,
    3391667775,
    1773340426,
    1001229940,
    4188725179,
    653842355,
    1068968647,
    4017908497
  ],
  "Seeded RNG golden vector changed"
);

for (const sides of [1, 2, 3, 6, 10, 37, 100, 255, 256, 257, 1000, 65535, 65536, 65537]) {
  const source = new SeededRandom("range-" + sides);
  for (let i = 0; i < 500; i += 1) {
    const value = unbiasedInt(source, 1, sides);
    assert.ok(value >= 1 && value <= sides, "Bounded integer escaped its range");
  }
}

{
  const input = ["a", "b", "c", "d", "e", "f"];
  const result = shuffle(input, new SeededRandom("shuffle"));
  assert.equal(result.length, input.length);
  assert.deepEqual([...result].sort(), [...input].sort());
}

{
  const input = Array.from({ length: 100 }, (_, i) => i);
  const result = sample(input, 30, new SeededRandom("sample"));
  assert.equal(result.length, 30);
  assert.equal(new Set(result).size, 30);
}

{
  const source = new SeededRandom("weighted");
  for (let i = 0; i < 100; i += 1) {
    assert.equal(weightedPick(["A", "B", "C"], [0, 0, 1], source), "C");
  }
}

{
  const input = Array.from({ length: 17 }, (_, i) => "P" + i);
  const groups = partition(input, 4, new SeededRandom("teams"));
  const flattened = groups.flat();
  assert.equal(flattened.length, input.length);
  assert.equal(new Set(flattened).size, input.length);
  const sizes = groups.map((group) => group.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
}

{
  const result = pairs(["A", "B", "C", "D", "E"], new SeededRandom("pairs"));
  assert.equal(result.flat().length, 5);
  assert.equal(new Set(result.flat()).size, 5);
  assert.equal(result.filter((group) => group.length === 1).length, 1);
}

console.log("Random Core certification tests passed.");
