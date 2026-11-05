// Pure preflight guidance: read the same setup as the runtime without drawing
// random values, changing inputs, altering saved presets, or creating a session.
import { entriesFromText } from "./list-input-assist.js";
import { normalizeSelection } from "./selection-model.js";

const LIST_MIN = Object.freeze({
  wheel: 2, picker: 1, sampler: 1, shuffle: 2, teams: 2,
  groups: 2, pairs: 2, assignment: 1, elimination: 2,
  ladder: 2, "secret-santa": 2, tournament: 2
});
const listField = 'textarea.field';

function issue(message, field = listField, fix = null) {
  return { message, field, fix };
}
function integer(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

export function checkToolSetup(tool, ts) {
  if (!tool || !ts || tool.custom) return null;
  const id = tool.id;
  if (Object.hasOwn(LIST_MIN, id)) {
    const items = entriesFromText(ts.listText);
    if (items.length < LIST_MIN[id]) {
      return issue("Add at least " + LIST_MIN[id] + (LIST_MIN[id] === 1
        ? " entry" : " entries") + " to continue.");
    }

    if (id === "wheel" || id === "picker" || id === "sampler") {
      let model;
      try {
        model = normalizeSelection(items, ts.selectionEntries || []);
      } catch (error) {
        return issue(error.message + " Open Selection rules to correct the weight.");
      }
      const min = id === "wheel" ? 2 : 1;
      if (model.eligibleCount < min) {
        return issue("At least " + min + (min === 1 ? " eligible entry is" :
          " eligible entries are") + " needed. Remove exclusions or raise zero weights in Selection rules.");
      }
      if (id === "sampler") {
        const max = ts.allowRepeats ? 100 : model.eligibleCount;
        if (!integer(ts.sampleCount, 1, max)) {
          return issue("You requested " + ts.sampleCount + " winners, but only " +
            model.eligibleCount + " entries are eligible" +
            (ts.allowRepeats ? " (repeated draws enabled)." :
              " without repeats. Reduce winners or allow repeats."),
            "#sample-count",
            integer(max, 1, 100) ? { label: "Set winners to " + max,
              key: "sampleCount", value: max } : null);
        }
      }
    }

    if (id === "teams" || id === "groups") {
      const key = id === "teams" ? "teamCount" : "groupCount";
      const max = Math.min(id === "teams" ? 12 : 20, items.length);
      if (!integer(ts[key], 2, max)) {
        return issue("You have " + items.length + " participants. Choose between 2 and " +
          max + " " + id + ".", id === "teams" ? "#team-count" : "#group-count",
          { label: "Use " + max + " " + id, key, value: max });
      }
    }

    if (id === "assignment" && !entriesFromText(ts.targetText).length) {
      return issue("Add at least one destination or task before assigning participants.",
        'textarea[aria-label="Targets / tasks"]');
    }
    if (id === "ladder") {
      const count = entriesFromText(ts.ladderOutcomes).length;
      if (count !== items.length) {
        return issue("Ladder has " + items.length + " players but " + count +
          " outcomes. Enter exactly one outcome for each player.",
          'textarea[aria-label="Outcomes / prizes"]');
      }
    }
    if (id === "secret-santa") {
      const seen = new Set();
      const duplicate = items.find((name) => {
        if (seen.has(name)) return true;
        seen.add(name);
        return false;
      });
      if (duplicate) {
        return issue("“" + duplicate + "” appears more than once. Secret Santa needs unique participant names.");
      }
    }
    return null;
  }

  if (id === "number") {
    const mode = ts.numberMode === "decimal" ? "decimal" : "integer";
    const min = Number(ts.numberMin);
    const max = Number(ts.numberMax);
    const count = Number(ts.numberCount);
    if (!integer(count, 1, 100)) return issue("Choose between 1 and 100 values.", "#number-count");
    const precision = Number(ts.numberPrecision);
    if (mode === "decimal" && !integer(precision, 1, 6)) {
      return issue("Choose 1 to 6 decimal places.", "#number-precision");
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return issue("Enter finite minimum and maximum values.", "#number-min");
    }
    if (min > max) return issue("Minimum is greater than maximum. Adjust the range.", "#number-min");
    const scale = mode === "decimal" ? 10 ** precision : 1;
    if (mode === "integer" && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max))) {
      return issue("Integer mode requires whole-number bounds.", "#number-min");
    }
    const lower = min * scale, upper = max * scale;
    if (!Number.isSafeInteger(Math.round(lower)) || !Number.isSafeInteger(Math.round(upper))
      || Math.abs(lower - Math.round(lower)) > 1e-7
      || Math.abs(upper - Math.round(upper)) > 1e-7) {
      return issue("The bounds must fit the selected decimal precision.", "#number-min");
    }
    const available = Math.round(upper) - Math.round(lower) + 1;
    if (!Number.isSafeInteger(available) || available > 0x100000000) {
      return issue("The range is too wide for this randomizer.", "#number-max");
    }
    if (ts.numberUnique && count > available) {
      return issue("Only " + available + " different values exist in this range. Reduce the count or turn off No duplicate values.",
        "#number-count",
        { label: "Draw " + available + " unique " + (available === 1 ? "value" : "values"),
          key: "numberCount", value: available });
    }
    return null;
  }
  if (id === "lottery") {
    if (!integer(ts.lotteryMax, 1, 10000)) return issue("Choose a maximum between 1 and 10,000.", "#lottery-max");
    if (!integer(ts.lotteryCount, 1, 50) || ts.lotteryCount > ts.lotteryMax) {
      const max = Math.min(50, ts.lotteryMax);
      return issue("You cannot draw more unique numbers than the range contains.",
        "#lottery-count", { label: "Draw " + max + " numbers", key: "lotteryCount", value: max });
    }
  }
  if (id === "chance" && (!Number.isFinite(ts.chance) || ts.chance < 0 || ts.chance > 100)) {
    return issue("Success probability must be between 0% and 100%.", "#chance");
  }
  if (id === "coordinate") {
    for (const axis of ["x", "y"]) {
      const min = Number(ts[axis + "Min"]), max = Number(ts[axis + "Max"]);
      if (!integer(min, -1000000, 1000000) || !integer(max, -1000000, 1000000) || min > max) {
        return issue(axis.toUpperCase() + " requires whole-number bounds with minimum at or below maximum.",
          "#" + axis + "-min");
      }
    }
  }
  if (id === "date") {
    const start = Date.parse(String(ts.dateStart) + "T00:00:00Z");
    const end = Date.parse(String(ts.dateEnd) + "T00:00:00Z");
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
      return issue("Choose dates in chronological order (From must not be after To).",
        'input[type="date"]');
    }
  }
  if (id === "time") {
    const parse = (value) => {
      const parts = String(value).split(":").map(Number);
      return parts.length === 2 && parts.every(Number.isFinite) ?
        parts[0] * 60 + parts[1] : NaN;
    };
    const start = parse(ts.timeStart), end = parse(ts.timeEnd);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start < 0 || end > 1439 || start > end) {
      return issue("Choose times within one day, with From no later than To.",
        'input[type="time"]');
    }
  }
  return null;
}

// Attach one live, accessible status next to Setup, without rerendering the
// entire tool or altering user inputs as they type.
export function attachSetupGuidance(controls, tool, ts, node, applyFix) {
  const panel = node("div", {
    class: "notice", role: "status", "aria-live": "polite", "aria-atomic": "true"
  });
  const summary = controls.querySelector("summary");
  controls.insertBefore(panel, summary?.nextSibling || null);
  const refresh = () => {
    const problem = checkToolSetup(tool, ts);
    panel.hidden = !problem;
    panel.style.display = problem ? "" : "none";
    if (!problem) { panel.replaceChildren(); return; }
    const children = [
      node("strong", { text: "Check this setup" }),
      node("span", { text: problem.message })
    ];
    children.push(node("button", {
      class: "small-action", type: "button",
      onClick: () => {
        const target = controls.querySelector(problem.field);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "nearest" });
      }
    }, "Edit field"));
    if (problem.fix) {
      children.push(node("button", {
        class: "small-action", type: "button",
        onClick: () => applyFix(problem.fix, problem.field)
      }, problem.fix.label));
    }
    panel.replaceChildren(...children);
  };
  controls.addEventListener("input", refresh);
  controls.addEventListener("change", refresh);
  refresh();
  return panel;
}

export function setupFamilyLabel(family) {
  return ({
    coin: "Tactile classic",
    dice: "Dice engine",
    wheel: "Weighted spinner",
    cards: "Deck",
    color: "Color generator",
    list: "List randomizer",
    people: "People randomizer",
    competition: "Game draw",
    private: "Private assignment",
    generator: "Generator"
  })[family] || "Randomizer";
}
