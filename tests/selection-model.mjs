import assert from "node:assert/strict";
import {
  occurrenceKeys,
  reconcileSelectionEntries,
  normalizeSelection,
  selectionRuleSummary,
  percentage
} from "../src/selection-model.js";

{
  assert.deepEqual(
    occurrenceKeys(["A", "A", "B", "A"]),
    ["A\u001f1", "A\u001f2", "B\u001f1", "A\u001f3"]
  );
}

{
  const first = reconcileSelectionEntries(["A", "A", "B"], []);
  first[1].weight = 4;
  first[2].excluded = true;
  const next = reconcileSelectionEntries(["A", "A", "B", "C"], first);
  assert.equal(next[1].weight, 4);
  assert.equal(next[2].excluded, true);
  assert.equal(next[3].weight, 1);
}

{
  const model = normalizeSelection(
    ["A", "B", "C", "D"],
    [
      { key: "A\u001f1", label: "A", weight: 1, excluded: false },
      { key: "B\u001f1", label: "B", weight: 3, excluded: false },
      { key: "C\u001f1", label: "C", weight: 100, excluded: true },
      { key: "D\u001f1", label: "D", weight: 0, excluded: false }
    ]
  );
  assert.equal(model.eligibleCount, 2);
  assert.equal(model.excludedCount, 1);
  assert.equal(model.zeroWeightCount, 1);
  assert.equal(model.entries[0].probability, 0.25);
  assert.equal(model.entries[1].probability, 0.75);
  assert.equal(model.entries[2].probability, 0);
  assert.equal(model.entries[3].probability, 0);
  assert.equal(
    model.entries.reduce((sum, entry) => sum + entry.probability, 0),
    1
  );
  assert.deepEqual(
    selectionRuleSummary(model, { allowRepeats: false, multi: true }),
    ["Weighted", "1 excluded", "1 at 0%", "No repeats"]
  );
}

assert.equal(percentage(0), "0%");
assert.equal(percentage(0.125), "12.5%");
assert.equal(percentage(0.0005), "0.05%");

console.log("Selection model certification tests passed.");
