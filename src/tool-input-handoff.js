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


/**
 * Capture the exact temporary destination input and its Pool/Preset linkage.
 * Preview and confirmation must agree even when two inputs parse to the same items.
 */
export function handoffDestinationSnapshot(toolState, { custom = false, fallback = "" } = {}) {
  const workingSet = toolState?.workingSet || null;
  return {
    text: String(toolState?.[custom ? "customInputText" : "listText"] ?? fallback),
    poolAttached: Boolean(workingSet),
    poolId: workingSet?.source?.poolId ?? null,
    poolRevision: workingSet?.source?.revision ?? null,
    workingSetContent: workingSet ? JSON.stringify(workingSet) : null,
    workingSetDirty: Boolean(toolState?.workingSetDirty),
    selectionContent: JSON.stringify(toolState?.selectionEntries ?? []),
    presetId: toolState?.activePresetId ?? null
  };
}

export function handoffDestinationUnchanged(before, after) {
  return Boolean(before && after
    && before.text === after.text
    && before.poolAttached === after.poolAttached
    && before.poolId === after.poolId
    && before.poolRevision === after.poolRevision
    && before.workingSetContent === after.workingSetContent
    && before.workingSetDirty === after.workingSetDirty
    && before.selectionContent === after.selectionContent
    && before.presetId === after.presetId);
}

export function handoffEntryPreview(entries, limit = 5) {
  const items = entries.slice(0, limit).map((entry) => {
    const text = String(entry);
    return text.length > 60 ? text.slice(0, 57) + "…" : text;
  });
  return items.join(" · ") + (entries.length > limit ? " · …" : "");
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
  node, sourceName, targets, getInput, getDestinationSnapshot,
  activeReason, onConfirm, onCancel, rerender
}) {
  const sourceEntries = config.sourceEntries;
  const fromResult = config.sourceKind === "result";
  const target = targets.find((tool) => tool.id === config.targetId) || null;
  const destinationSnapshot = target && getDestinationSnapshot
    ? getDestinationSnapshot(target) : null;
  const prior = target ? destinationSnapshot?.text ?? getInput(target) : "";
  const blocked = target ? activeReason(target) : null;
  let plan = null;
  let issue = config.error || blocked || (!sourceEntries.length
    ? "There are no reusable entries to transfer." : null);
  if (target && !issue) {
    try {
      plan = planInputHandoff(sourceEntries, prior, config.mode);
      if (destinationSnapshot) plan.destinationSnapshot = destinationSnapshot;
    } catch (error) { issue = error.message; }
  }

  const choose = node("select", {
    class: "field",
    "aria-label": "Destination randomizer",
    onChange: (event) => {
      config.targetId = event.target.value;
      config.error = null;
      config.needsReview = false;
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
      config.needsReview = false;
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
        + handoffEntryPreview(sourceEntries)
    }),
    node("div", { class: "control" }, [
      node("label", { text: "Destination" }), choose
    ]),
    node("div", { class: "control" }, [
      node("label", { text: "Transfer method" }), mode
    ]),
    target ? node("p", {
      text: "Destination preview: "
        + (prior ? handoffEntryPreview(entriesFromText(prior)) || "(no entries)" : "(no entries)")
    }) : null,
    target && destinationSnapshot?.poolAttached ? node("p", {
      text: "The destination's temporary Pool working set will be detached."
        + (destinationSnapshot.workingSetDirty
          ? " Its unsaved working-set changes will be lost." : "")
    }) : null,
    target && destinationSnapshot?.presetId ? node("p", {
      text: "The destination's active Preset association will be cleared; saved Presets stay unchanged."
    }) : null,
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
      config.needsReview ? node("button", {
        class: "secondary", type: "button", onClick: () => {
          config.error = null;
          config.needsReview = false;
          rerender();
        }
      }, "Review updated destination") : null,
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
