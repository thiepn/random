import assert from "node:assert/strict";
import { SeededRandom } from "../src/random-core.js";
import { executeTool } from "../src/tool-engine.js";
import {
  createPreset,
  resolvePresetInput
} from "../src/preset-model.js";
import {
  createSessionTemplate,
  createTemplateSession,
  completeTemplateStep,
  previousStepItems,
  resultToItems
} from "../src/session-template-model.js";
import {
  createPartySession,
  appendPartyRun,
  makeAudienceState
} from "../src/party-model.js";
import {
  createCustomExperience,
  exportCustomExperience,
  importCustomExperience
} from "../src/custom-experience-model.js";
import { executeCustomExperience } from "../src/custom-engine.js";
import { createRun } from "../src/session-model.js";
import {
  createPortablePackage,
  serializePortablePackage,
  parsePortablePackage,
  mergePortableStores,
  PORTABLE_STORES
} from "../src/data-portability.js";

function emptyStores() {
  return Object.fromEntries(PORTABLE_STORES.map((name) => [name, []]));
}

{
  const custom = createCustomExperience({
    name: "Release Picker",
    primitive: "pick",
    config: {
      entries: [
        { label: "Alpha", weight: 1 },
        { label: "Beta", weight: 3 },
        { label: "Gamma", weight: 2 }
      ]
    }
  });

  const before = executeCustomExperience(
    custom,
    {},
    new SeededRandom("phase16-custom")
  );
  const imported = importCustomExperience(exportCustomExperience(custom));
  const after = executeCustomExperience(
    imported,
    {},
    new SeededRandom("phase16-custom")
  );

  assert.deepEqual(after.result, before.result);
  assert.deepEqual(after.fairness, before.fairness);
}

let preset;
let presetRun;
let party;

{
  preset = createPreset({
    name: "Frozen release picker",
    toolId: "picker",
    inputBinding: {
      mode: "frozen",
      sourceLabel: "Release candidates",
      items: [
        { id: "a", label: "Alpha", weight: 1 },
        { id: "b", label: "Beta", weight: 1 },
        { id: "c", label: "Gamma", weight: 1 }
      ]
    },
    configSnapshot: {}
  });

  const resolved = resolvePresetInput(preset);
  const items = resolved.workingSet.items.map((item) => item.label);
  const decision = executeTool(
    "picker",
    { items },
    new SeededRandom("phase16-preset")
  );

  presetRun = createRun({
    toolId: "picker",
    toolName: "Pick One",
    inputSnapshot: {
      source: resolved.workingSet.source,
      items
    },
    configSnapshot: preset.configSnapshot,
    result: decision.result,
    summary: String(decision.result),
    fairness: decision.fairness,
    randomContext: {
      mode: "seeded",
      seed: "PRIVATE-RELEASE-SEED"
    }
  });

  assert.ok(items.includes(presetRun.result));

  party = appendPartyRun(
    createPartySession({
      toolId: "picker",
      toolName: "Pick One"
    }),
    presetRun.id
  );

  const audience = makeAudienceState({
    party,
    tool: {
      id: "picker",
      name: "Pick One",
      icon: "✦",
      accent: "cyan"
    },
    run: presetRun,
    stage: "result"
  });

  assert.equal(audience.result, presetRun.result);
  const publicJson = JSON.stringify(audience);
  assert.equal(publicJson.includes("PRIVATE-RELEASE-SEED"), false);
  assert.equal(publicJson.includes("inputSnapshot"), false);
  assert.equal(publicJson.includes("configSnapshot"), false);
}

let template;
let templateSession;

{
  template = createSessionTemplate({
    name: "Release chain",
    steps: [
      {
        id: "shuffle",
        name: "Shuffle",
        toolId: "shuffle",
        input: { kind: "prompt" }
      },
      {
        id: "pick",
        name: "Pick",
        toolId: "picker",
        input: {
          kind: "previous",
          sourceStepId: "shuffle"
        }
      }
    ]
  });

  templateSession = createTemplateSession(template);

  const first = executeTool(
    "shuffle",
    { items: ["A", "B", "C", "D"] },
    new SeededRandom("phase16-template-shuffle")
  );
  const firstItems = resultToItems("shuffle", first.result);
  assert.equal(firstItems.length, 4);

  templateSession = completeTemplateStep(
    templateSession,
    0,
    "run:template:1",
    firstItems
  );

  const carried = previousStepItems(templateSession, template, 1);
  assert.deepEqual(carried, firstItems);

  const second = executeTool(
    "picker",
    { items: carried },
    new SeededRandom("phase16-template-pick")
  );
  assert.ok(carried.includes(second.result));

  templateSession = completeTemplateStep(
    templateSession,
    1,
    "run:template:2",
    resultToItems("picker", second.result)
  );
  assert.equal(templateSession.status, "completed");
}

{
  const stores = emptyStores();
  stores.presets.push(preset);
  stores.runs.push(presetRun);
  stores.partySessions.push(party);
  stores.sessionTemplates.push(template);
  stores.templateSessions.push(templateSession);
  stores.settings.push({
    id: "app",
    value: { randomness: { mode: "secure" } }
  });

  const portable = createPortablePackage({
    stores,
    scope: "full",
    device: {
      id: "phase16-device",
      name: "Release certification",
      platform: "Node"
    },
    appVersion: "implementation-16",
    databaseVersion: 11,
    createdAt: "2026-09-23T14:00:00.000Z"
  });

  const restored = parsePortablePackage(serializePortablePackage(portable));
  assert.equal(restored.payload.stores.presets.length, 1);
  assert.equal(restored.payload.stores.runs.length, 1);
  assert.equal(restored.payload.stores.partySessions.length, 1);
  assert.equal(restored.payload.stores.sessionTemplates.length, 1);
  assert.equal(restored.payload.stores.templateSessions.length, 1);

  const merged = mergePortableStores(emptyStores(), restored);
  assert.equal(merged.stores.presets[0].id, preset.id);
  assert.equal(merged.stores.runs[0].id, presetRun.id);
  assert.equal(merged.stores.partySessions[0].id, party.id);
  assert.equal(merged.stores.sessionTemplates[0].id, template.id);
  assert.equal(merged.stores.templateSessions[0].status, "completed");
}

console.log("cross-feature regression certification passed");
