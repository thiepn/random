import { entriesFromText } from "./list-input-assist.js";

// Copy entry labels only. Never transfer weighted rules, Pool bindings, results or sessions.
export function planInputHandoff(sourceEntries, targetText, mode = "replace") {
  if (!["replace", "append"].includes(mode)) throw new TypeError("Unknown handoff mode.");
  if (!Array.isArray(sourceEntries)) throw new TypeError("Source must be a list of entries.");
  const entries = sourceEntries.map((item) => String(item));
  if (!entries.length || entries.some((item) => !item.trim() || /[\r\n;]/.test(item))) {
    throw new RangeError("The source must contain valid individual entries.");
  }
  const existing = entriesFromText(targetText);
  if (entries.length > 5000 || (mode === "append" && entries.length + existing.length > 5000)) {
    throw new RangeError("A destination can contain at most 5,000 entries.");
  }
  const next = (mode === "append" ? [...existing, ...entries] : entries).join("\n");
  if (next.length > 200000) throw new RangeError("Copied input is too large.");
  return {
    text: next,
    copied: entries.length,
    previous: existing.length,
    total: mode === "append" ? existing.length + entries.length : entries.length,
    mode
  };
}

export function eligibleHandoffTargets(tools, sourceToolId, isCompatible) {
  return tools.filter((tool) =>
    tool && tool.id !== sourceToolId && isCompatible(tool)
  );
}

export function activeTargetReason(toolState, activeSession = false, busy = false) {
  if (busy || toolState?.computing) return "A randomization is still running.";
  if (activeSession || toolState?.templateSessionId
    || toolState?.workflowSessionId) return "Finish the destination's active session first.";
  if (toolState?.replayRunId) return "Exit replay mode before changing this tool's input.";
  return null;
}

export function renderInputHandoffModal(modal, config, {
  node, sourceName, targets, getInput, activeReason, onConfirm, onCancel, rerender
}) {
  const sourceEntries = config.sourceEntries;
  const fromResult = config.sourceKind === "result";
  const target = targets.find((tool) => tool.id === config.targetId) || null;
  const prior = target ? getInput(target) : "";
  const blocked = target ? activeReason(target) : null;
  let plan = null;
  let issue = config.error || blocked || (!sourceEntries.length
    ? "There are no reusable entries to transfer." : null);
  if (target && !issue) {
    try { plan = planInputHandoff(sourceEntries, prior, config.mode); }
    catch (error) { issue = error.message; }
  }

  const choose = node("select", {
    class: "field",
    "aria-label": "Destination randomizer",
    onChange: (event) => {
      config.targetId = event.target.value;
      config.error = null;
      rerender();
    }
  }, [
    node("option", { value: "", text: "Choose a destination" }),
    ...targets.map((tool) => node("option", {
      value: tool.id,
      text: tool.name,
      disabled: activeReason(tool) ? true : null
    }))
  ]);
  choose.value = target?.id || "";
  const mode = node("select", {
    class: "field",
    "aria-label": "How to copy the entries",
    onChange: (event) => {
      config.mode = event.target.value;
      config.error = null;
      rerender();
    }
  }, [
    node("option", { value: "replace", text: "Replace destination's temporary entries" }),
    node("option", { value: "append", text: "Append after destination's entries" })
  ]);
  mode.value = config.mode;

  modal.append(
    node("h2", { text: fromResult
      ? "Use result in another tool" : "Copy current entries to another tool" }),
    node("p", {
      text: sourceEntries.length + (fromResult ? " result items" : " entries")
        + " from " + sourceName
        + ". Only labels transfer, not weights, exclusions, rules or Pool links."
    }),
    node("p", {
      text: (fromResult ? "Result preview: " : "Source preview: ")
        + sourceEntries.slice(0, 5).join(" · ")
        + (sourceEntries.length > 5 ? " · …" : "")
    }),
    node("div", { class: "control" }, [
      node("label", { text: "Destination" }), choose
    ]),
    node("div", { class: "control" }, [
      node("label", { text: "Transfer method" }), mode
    ]),
    target
      ? node("p", { role: "status", "aria-live": "polite",
        text: blocked || (
          plan
            ? target.name + " currently has " + plan.previous
              + " entries. After copying: " + plan.total
              + ". Saved Pools and Presets remain unchanged; target rules may need review."
            : "This setup cannot be copied to the selected tool."
        )
      })
      : node("p", { text: "Choose where to send the list. Nothing changes until you confirm." }),
    issue ? node("div", { class: "tool-error", role: "alert", text: issue }) : null,
    node("div", { class: "modal-actions" }, [
      node("button", { class: "secondary", type: "button", onClick: onCancel }, "Cancel"),
      node("button", {
        class: "primary", type: "button", disabled: !target || !plan || !!issue,
        onClick: () => onConfirm(target, plan)
      }, config.mode === "append" ? "Append entries" : "Replace entries")
    ])
  );
}

export function applyInputHandoff(target, plan, {
  custom = false, selection = false, mode = "replace"
} = {}) {
  if (!target || !plan || !["replace","append"].includes(mode)
    || typeof plan.text !== "string") {
    throw new TypeError("Valid confirmed input handoff required.");
  }
  target[custom ? "customInputText" : "listText"] = plan.text;
  target.workingSet = null;
  target.workingSetDirty = false;
  target.activePresetId = null;
  target.activeSessionId = null;
  if (selection && mode === "replace") target.selectionEntries = [];
  return target;
}
