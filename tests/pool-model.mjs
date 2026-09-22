import assert from "node:assert/strict";
import {
  POOL_SCHEMA_VERSION,
  normalizePool,
  createPool,
  mutatePool,
  createPoolField,
  activePoolItems,
  createWorkingSet,
  filterPoolItems,
  duplicateSummary,
  parseDelimitedText,
  importRowsToPoolItems,
  createPoolView,
  resolvePoolView,
  poolStats
} from "../src/pool-model.js";

{
  const old = normalizePool({
    id: "legacy",
    name: "Legacy",
    revision: 1,
    items: [
      { id: "a", label: "Anna", active: true },
      { id: "b", label: "Ben", active: false }
    ]
  });
  assert.equal(old.schemaVersion, POOL_SCHEMA_VERSION);
  assert.equal(old.items[0].weight, 1);
  assert.deepEqual(old.items[0].tags, []);
  assert.deepEqual(old.items[0].values, {});
}

{
  const pool = createPool({ name: "People", labels: ["Anna", "Ben"] });
  assert.equal(pool.revision, 1);
  const updated = mutatePool(pool, (draft) => {
    draft.name = "Friends";
    draft.items[0].tags.push("leader");
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.name, "Friends");
  assert.deepEqual(updated.items[0].tags, ["leader"]);
}

{
  const field = createPoolField("Skill", "number");
  const pool = createPool({
    name: "Team",
    fields: [field],
    items: [
      { label: "A", active: true, tags: ["red"], values: { [field.id]: 3 } },
      { label: "B", active: false, tags: ["blue"], values: { [field.id]: 5 } },
      { label: "C", active: true, tags: ["blue"], values: { [field.id]: 1 } }
    ]
  });
  assert.equal(activePoolItems(pool).length, 2);
  assert.equal(createWorkingSet(pool).items.length, 2);
  assert.equal(filterPoolItems(pool, { tags: ["blue"], active: "all" }).length, 2);
  assert.equal(filterPoolItems(pool, { tags: ["blue"], active: "active" }).length, 1);
  assert.equal(filterPoolItems(pool, { search: "5" }).length, 1);
}

{
  const pool = createPool({
    name: "Duplicates",
    labels: ["Anna", "anna", "Ben", "Anna"]
  });
  const summary = duplicateSummary(pool);
  assert.equal(summary.groupCount, 1);
  assert.equal(summary.itemCount, 3);
}

{
  const parsed = parseDelimitedText(
    'name,weight,active,tags\n"Anna, Jr",2,true,"leader|music"\nBen,1,false,guest'
  );
  assert.deepEqual(parsed.headers, ["name", "weight", "active", "tags"]);
  const items = importRowsToPoolItems(parsed);
  assert.equal(items.length, 2);
  assert.equal(items[0].label, "Anna, Jr");
  assert.equal(items[0].weight, 2);
  assert.equal(items[0].active, true);
  assert.deepEqual(items[0].tags, ["leader", "music"]);
  assert.equal(items[1].active, false);
}

{
  const parsed = parseDelimitedText("name,tag\nAnna,leader");
  const items = importRowsToPoolItems(parsed);
  assert.deepEqual(items[0].tags, ["leader"]);
}

{
  const parsed = parseDelimitedText("Anna\tLeader\nBen\tMember", { hasHeader: false });
  assert.equal(parsed.delimiter, "\t");
  assert.deepEqual(parsed.headers, ["label", "column_2"]);
}

{
  const pool = createPool({
    name: "People",
    items: [
      { label: "A", tags: ["leader"], active: true },
      { label: "B", tags: ["member"], active: true },
      { label: "C", tags: ["leader"], active: false }
    ]
  });
  const view = createPoolView({
    name: "Leaders",
    poolId: pool.id,
    filters: { tags: ["leader"], active: "active" }
  });
  assert.deepEqual(resolvePoolView(pool, view).map((item) => item.label), ["A"]);

  const stats = poolStats(pool);
  assert.equal(stats.total, 3);
  assert.equal(stats.active, 2);
  assert.equal(stats.inactive, 1);
  assert.equal(stats.tags, 2);
}

console.log("Pool model certification tests passed.");
