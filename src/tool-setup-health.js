import { entriesFromText } from "./list-input-assist.js";
import { normalizeSelection } from "./selection-model.js";

const HELP = Object.freeze({
  coin: "Flip a fair coin. Heads and tails have equal odds.",
  dice: "Use quick dice for ordinary rolls, or Expression for modifiers and keep/drop rules.",
  number: "Choose a range and quantity. Turn on unique draws when repeats are not allowed.",
  cards: "Draw from a shuffled deck without replacement. Reset the deck to draw again.",
  chance: "Set a success percentage from 0 to 100.",
  lottery: "Set how many distinct numbers to draw and the largest number.",
  color: "Generate a hexadecimal color.",
  date: "Set the first and last possible date, inclusive.",
  direction: "Draw one of eight compass directions.",
  letter: "Draw a letter from A to Z.",
  time: "Choose a start and end time within the same day.",
  coordinate: "Set X and Y bounds to draw an integer point.",
  rps: "Get a random rock, paper or scissors selection."
});

const minEntries = Object.freeze({
  wheel: 2, picker: 1, sampler: 1, shuffle: 2, teams: 2, groups: 2,
  pairs: 2, assignment: 1, elimination: 2, ladder: 2,
  "secret-santa": 2, tournament: 2
});

const issue = (code, message, action, patch = null, selector = null) =>
  ({ code, message, action, patch, selector });

function selectedCount(toolId, items, ts) {
  if (!["picker","wheel","sampler"].includes(toolId)) return items.length;
  const model = normalizeSelection(items, ts.selectionEntries || []);
  return model.eligibleCount;
}

export function setupIssue(toolId, ts = {}, { customNeedsInput = false } = {}) {
  if (customNeedsInput && entriesFromText(ts.customInputText).length === 0) {
    return issue("custom-empty", "Add at least one input entry for this custom tool.",
      "Edit input", null, '[aria-label="Custom Experience input"]');
  }
  if (!Object.hasOwn(minEntries, toolId)) {
    if (toolId === "number") {
      const min = Number(ts.numberMin), max = Number(ts.numberMax);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
        return issue("number-range", "Minimum cannot exceed maximum.",
          "Swap bounds", Number.isFinite(min) && Number.isFinite(max)
            ? {numberMin:max,numberMax:min} : null, "#number-min");
      }
      if (ts.numberUnique && Number(ts.numberCount) > 1) {
        const factor = ts.numberMode === "decimal" ? 10 ** Number(ts.numberPrecision) : 1;
        const capacity = Math.round(max * factor) - Math.round(min * factor) + 1;
        if (Number.isFinite(capacity) && capacity > 0 && Number(ts.numberCount) > capacity) {
          return issue("number-unique", "The range has fewer unique values than requested.",
            "Reduce quantity", {numberCount:capacity}, "#number-count");
        }
      }
    }
    if (toolId === "lottery" && Number(ts.lotteryCount) > Number(ts.lotteryMax)
      && Number(ts.lotteryMax) >= 1) {
      return issue("lottery-count", "Cannot draw more unique numbers than the maximum.",
        "Reduce numbers", {lotteryCount:Number(ts.lotteryMax)}, "#lottery-count");
    }
    if (toolId === "date" && (Date.parse(String(ts.dateStart)+"T00:00:00Z")
      > Date.parse(String(ts.dateEnd)+"T00:00:00Z"))) {
      return issue("date-range", "The end date is before the start date.",
        "Swap dates", {dateStart:ts.dateEnd,dateEnd:ts.dateStart}, 'input[type="date"]');
    }
    if (toolId === "time" && ts.timeStart && ts.timeEnd && ts.timeStart > ts.timeEnd) {
      return issue("time-range", "The end time is before the start time.",
        "Swap times", {timeStart:ts.timeEnd,timeEnd:ts.timeStart}, 'input[type="time"]');
    }
    if (toolId === "coordinate") {
      const x = Number(ts.xMin) > Number(ts.xMax);
      const y = Number(ts.yMin) > Number(ts.yMax);
      if (x || y) return issue("coordinate-range",
        (x && y ? "X and Y" : x ? "X" : "Y") + " minimum exceeds maximum.",
        "Swap bounds", {
          ...(x ? {xMin:ts.xMax,xMax:ts.xMin} : {}),
          ...(y ? {yMin:ts.yMax,yMax:ts.yMin} : {})
        }, "#x-min");
    }
    return null;
  }

  const items = entriesFromText(ts.listText);
  const required = minEntries[toolId];
  if (items.length < required) {
    return issue("missing-entries",
      "Add at least " + required + (required === 1 ? " entry" : " entries") + " before drawing.",
      "Edit entries", null, '[aria-label$=" entries"]');
  }
  if (["picker","wheel","sampler"].includes(toolId)) {
    let eligible;
    try { eligible = selectedCount(toolId,items,ts); }
    catch { return issue("invalid-weights",
      "Selection weights must be finite nonnegative values.",
      "Edit selection rules", {selectionOpen:true}, ".selection-rules-toggle"); }
    const needed = toolId === "wheel" ? 2 : 1;
    if (eligible < needed) return issue("excluded-entries",
      "At least " + needed + " eligible " + (needed === 1 ? "entry is" : "entries are")
        + " needed. Check exclusions and zero weights.",
      "Edit selection rules", {selectionOpen:true}, ".selection-rules-toggle");
    if (toolId === "sampler" && !ts.allowRepeats
      && Number(ts.sampleCount) > eligible) {
      return issue("sampler-count", "Winners exceed eligible entries without replacement.",
        "Set winners to "+eligible, {sampleCount:eligible}, "#sample-count");
    }
  }
  if (toolId === "teams" && Number(ts.teamCount) > items.length) {
    return issue("teams-count", "More teams than people cannot be created.",
      "Use "+items.length+" teams", {teamCount:Math.min(12,items.length)}, "#team-count");
  }
  if (toolId === "groups" && Number(ts.groupCount) > items.length) {
    return issue("groups-count", "More groups than participants cannot be created.",
      "Use "+items.length+" groups", {groupCount:Math.min(20,items.length)}, "#group-count");
  }
  if (toolId === "assignment" && !entriesFromText(ts.targetText).length) {
    return issue("missing-targets", "Add at least one target or task.",
      "Edit targets", null, '[aria-label="Targets / tasks"]');
  }
  if (toolId === "ladder" && entriesFromText(ts.ladderOutcomes).length !== items.length) {
    return issue("ladder-outcomes",
      "Ladder requires one outcome per player ("+items.length+" players).",
      "Edit outcomes", null, '[aria-label="Outcomes / prizes"]');
  }
  if (toolId === "secret-santa" && new Set(items).size !== items.length) {
    return issue("duplicate-names", "Private gift assignments need unique participant names.",
      "Edit names", null, '[aria-label$=" entries"]');
  }
  return null;
}

export function setupHelp(toolId, isList = false) {
  return isList ? "" : HELP[toolId] || "";
}

export function buildSetupCoach({
  toolId, toolState, node, root, onApply, customNeedsInput = false
}) {
  const help = setupHelp(toolId, Object.hasOwn(minEntries,toolId));
  const message = node("span", { text: "" });
  const fix = node("button", { class:"small-action", type:"button",
    onClick: () => {
      const current = setupIssue(toolId,toolState,{customNeedsInput});
      if (!current) return;
      if (current.patch) onApply(current.patch);
      else root.querySelector(current.selector)?.focus();
    }
  });
  const status = node("div", {
    class:"notice", role:"status", "aria-live":"polite", "aria-atomic":"true"
  }, [message,fix]);
  const panel = node("section", { class:"control" }, [
    ...(help ? [node("p",{class:"control-hint",text:help})] : []), status
  ]);
  const refresh = () => {
    const current = setupIssue(toolId,toolState,{customNeedsInput});
    status.hidden = !current;
    if (current) {
      message.textContent = current.message;
      fix.textContent = current.action;
    }
    return current;
  };
  refresh();
  return { panel, refresh };
}

export function stopInvalidRun(toolId, toolState, {announce, render, customNeedsInput=false}) {
  const current = setupIssue(toolId,toolState,{customNeedsInput});
  if (!current) return false;
  render();
  const details = document.querySelector(".tool-controls");
  if (details) {
    details.open = true;
    details.scrollIntoView({block:"nearest"});
    details.querySelector(".notice:not([hidden]) button")?.focus({preventScroll:true});
  }
  announce?.(current.message);
  return true;
}

export function toolFamilyLabel(family) {
  return ({
    coin:"Tactile classic", dice:"Dice engine", wheel:"Weighted spinner",
    cards:"Deck", color:"Color generator", list:"List randomizer",
    people:"People randomizer", competition:"Game draw",
    private:"Private assignment", generator:"Generator"
  })[family] || "Randomizer";
}
