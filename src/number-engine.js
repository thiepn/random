const UINT32_RANGE = 0x100000000;

export class NumberEngineError extends Error {
  constructor(message, code = "INVALID_NUMBER_CONFIG") {
    super(message);
    this.name = "NumberEngineError";
    this.code = code;
  }
}

function requireCount(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new NumberEngineError(
      "Number count must be a whole number from 1 to 100.",
      "INVALID_NUMBER_COUNT"
    );
  }
  return value;
}

function implicitSample(start, size, count, rng) {
  const swaps = new Map();
  const output = [];

  for (let index = 0; index < count; index += 1) {
    const chosen = rng.int(index, size - 1);
    const atChosen = swaps.has(chosen) ? swaps.get(chosen) : chosen;
    const atIndex = swaps.has(index) ? swaps.get(index) : index;
    swaps.set(chosen, atIndex);
    output.push(start + atChosen);
  }

  return output;
}

function formatScaled(value, precision) {
  if (precision === 0) return String(value);
  const negative = value < 0;
  const absolute = Math.abs(value);
  const scale = 10 ** precision;
  const whole = Math.floor(absolute / scale);
  const fraction = String(absolute % scale).padStart(precision, "0");
  return (negative ? "-" : "") + whole + "." + fraction;
}

function scaledBoundary(value, precision, label) {
  if (!Number.isFinite(value)) {
    throw new NumberEngineError(
      label + " must be a finite number.",
      "INVALID_NUMBER_BOUND"
    );
  }

  const scale = 10 ** precision;
  const scaled = value * scale;
  const rounded = Math.round(scaled);

  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 1e-7) {
    throw new NumberEngineError(
      label + " has more decimal places than the selected precision allows.",
      "BOUND_PRECISION_MISMATCH"
    );
  }

  return rounded;
}

export function generateRandomNumbers(config, rng) {
  const mode = config.mode === "decimal" ? "decimal" : "integer";
  const count = requireCount(Number(config.count ?? 1));
  const unique = Boolean(config.unique);

  let precision = 0;
  let min;
  let max;

  if (mode === "decimal") {
    precision = Number(config.precision ?? 2);
    if (!Number.isSafeInteger(precision) || precision < 1 || precision > 6) {
      throw new NumberEngineError(
        "Decimal precision must be from 1 to 6 places.",
        "INVALID_PRECISION"
      );
    }
    min = scaledBoundary(Number(config.min), precision, "Minimum");
    max = scaledBoundary(Number(config.max), precision, "Maximum");
  } else {
    min = Number(config.min);
    max = Number(config.max);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
      throw new NumberEngineError(
        "Integer mode requires whole-number bounds.",
        "INVALID_INTEGER_BOUND"
      );
    }
  }

  if (min > max) {
    throw new NumberEngineError(
      "Minimum cannot be greater than maximum.",
      "INVALID_NUMBER_RANGE"
    );
  }

  const size = max - min + 1;
  if (!Number.isSafeInteger(size) || size < 1 || size > UINT32_RANGE) {
    throw new NumberEngineError(
      "The configured range can contain at most 4,294,967,296 distinct values.",
      "NUMBER_RANGE_TOO_LARGE"
    );
  }

  if (unique && count > size) {
    throw new NumberEngineError(
      "Unique draws cannot exceed the number of available values.",
      "UNIQUE_COUNT_TOO_LARGE"
    );
  }

  let scaledValues;

  if (count === 1) {
    scaledValues = [rng.int(min, max)];
  } else if (unique) {
    scaledValues = implicitSample(min, size, count, rng);
  } else {
    scaledValues = Array.from({ length: count }, () => rng.int(min, max));
  }

  const displayValues = scaledValues.map((value) =>
    formatScaled(value, precision)
  );
  const values = mode === "decimal"
    ? scaledValues.map((value) => value / (10 ** precision))
    : [...scaledValues];

  return {
    version: "number-engine.v1",
    mode,
    precision,
    unique,
    count,
    min,
    max,
    scaledValues,
    values,
    displayValues
  };
}
