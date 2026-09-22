export class SelectionConfigError extends Error {
  constructor(message, code = "INVALID_SELECTION_CONFIG") {
    super(message);
    this.name = "SelectionConfigError";
    this.code = code;
  }
}

export function occurrenceKeys(items) {
  const seen = new Map();
  return items.map((label) => {
    const next = (seen.get(label) || 0) + 1;
    seen.set(label, next);
    return label + "\u001f" + next;
  });
}

export function reconcileSelectionEntries(items, previousEntries = []) {
  const old = new Map(previousEntries.map((entry) => [entry.key, entry]));
  const keys = occurrenceKeys(items);

  return items.map((label, index) => {
    const key = keys[index];
    const previous = old.get(key);
    return {
      key,
      label,
      weight: previous?.weight ?? 1,
      excluded: previous?.excluded ?? false
    };
  });
}

export function normalizeSelection(items, selectionEntries = []) {
  const entries = reconcileSelectionEntries(items, selectionEntries).map((entry, index) => {
    const weight = Number(entry.weight);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new SelectionConfigError(
        `Weight for “${entry.label}” must be a finite number of zero or greater.`,
        "INVALID_WEIGHT"
      );
    }

    return {
      ...entry,
      index,
      weight,
      excluded: Boolean(entry.excluded),
      effectiveWeight: entry.excluded ? 0 : weight
    };
  });

  const totalWeight = entries.reduce((sum, entry) => sum + entry.effectiveWeight, 0);
  const eligibleEntries = entries.filter((entry) => entry.effectiveWeight > 0);

  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    eligible: entry.effectiveWeight > 0,
    probability: totalWeight > 0 ? entry.effectiveWeight / totalWeight : 0
  }));

  const customWeights = normalizedEntries.some(
    (entry) => !entry.excluded && entry.weight !== 1
  );
  const excludedCount = normalizedEntries.filter((entry) => entry.excluded).length;
  const zeroWeightCount = normalizedEntries.filter(
    (entry) => !entry.excluded && entry.weight === 0
  ).length;
  const eligibleWeights = eligibleEntries.map((entry) => entry.effectiveWeight);
  const uniformAmongEligible = eligibleWeights.length > 0
    && eligibleWeights.every((weight) => weight === eligibleWeights[0]);

  return {
    entries: normalizedEntries,
    eligibleEntries: normalizedEntries.filter((entry) => entry.eligible),
    totalWeight,
    eligibleCount: eligibleEntries.length,
    excludedCount,
    zeroWeightCount,
    customWeights,
    uniformAmongEligible
  };
}

export function selectionRuleSummary(model, { allowRepeats = false, multi = false } = {}) {
  const rules = [];
  if (model.customWeights) rules.push("Weighted");
  if (model.excludedCount) rules.push(`${model.excludedCount} excluded`);
  if (model.zeroWeightCount) rules.push(`${model.zeroWeightCount} at 0%`);
  if (multi) rules.push(allowRepeats ? "Repeats allowed" : "No repeats");
  return rules;
}

export function percentage(value) {
  if (!Number.isFinite(value)) return "—";
  const percent = value * 100;
  if (percent === 0) return "0%";
  if (percent < 0.1) return percent.toFixed(2) + "%";
  if (percent < 1) return percent.toFixed(1) + "%";
  if (Math.abs(percent - Math.round(percent)) < 1e-9) return Math.round(percent) + "%";
  return percent.toFixed(1) + "%";
}
