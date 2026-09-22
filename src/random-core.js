const UINT32_RANGE = 0x100000000;

function rotl(value, shift) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function hashSeed(seed) {
  let h1 = 0x9e3779b9;
  let h2 = 0x243f6a88;
  let h3 = 0xb7e15162;
  let h4 = 0xdeadbeef;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x85ebca6b);
    h2 = Math.imul(h2 ^ c, 0xc2b2ae35);
    h3 = Math.imul(h3 ^ c, 0x27d4eb2f);
    h4 = Math.imul(h4 ^ c, 0x165667b1);
    h1 ^= h1 >>> 13;
    h2 ^= h2 >>> 16;
    h3 ^= h3 >>> 15;
    h4 ^= h4 >>> 13;
  }
  const out = [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  if (out.every((value) => value === 0)) out[0] = 1;
  return out;
}

export class SecureRandom {
  nextUint32() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  }

  int(min, max) {
    return unbiasedInt(this, min, max);
  }

  float() {
    const a = this.nextUint32() >>> 5;
    const b = this.nextUint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }
}

export class SeededRandom {
  constructor(seed = "randomizer") {
    this.seed = String(seed);
    this.state = hashSeed(this.seed);
  }

  nextUint32() {
    let [s0, s1, s2, s3] = this.state;
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;

    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3 >>> 0, 11);

    this.state = [s0 >>> 0, s1 >>> 0, s2 >>> 0, s3 >>> 0];
    return result;
  }

  int(min, max) {
    return unbiasedInt(this, min, max);
  }

  float() {
    const a = this.nextUint32() >>> 5;
    const b = this.nextUint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }
}

export function unbiasedInt(source, min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
    throw new RangeError("Invalid integer range.");
  }
  const range = max - min + 1;
  if (range > UINT32_RANGE) {
    throw new RangeError("Range is too large for this random integer operation.");
  }
  const limit = Math.floor(UINT32_RANGE / range) * range;
  let value;
  do {
    value = source.nextUint32();
  } while (value >= limit);
  return min + (value % range);
}

export function pick(items, rng) {
  if (!items.length) throw new RangeError("Cannot pick from an empty list.");
  return items[rng.int(0, items.length - 1)];
}

export function shuffle(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sample(items, count, rng) {
  if (!Number.isSafeInteger(count) || count < 0 || count > items.length) {
    throw new RangeError("Invalid sample size.");
  }
  const copy = [...items];
  for (let i = 0; i < count; i += 1) {
    const j = rng.int(i, copy.length - 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function weightedPick(items, weights, rng) {
  if (items.length !== weights.length || items.length === 0) {
    throw new RangeError("Items and weights must be non-empty and have equal length.");
  }
  let total = 0;
  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError("Weights must be finite and non-negative.");
    total += weight;
  }
  if (total <= 0) throw new RangeError("At least one weight must be greater than zero.");
  const target = rng.float() * total;
  let cumulative = 0;
  for (let i = 0; i < items.length; i += 1) {
    cumulative += weights[i];
    if (target < cumulative) return items[i];
  }
  return items[items.length - 1];
}

export function partition(items, groupCount, rng) {
  if (!Number.isSafeInteger(groupCount) || groupCount < 1 || groupCount > items.length) {
    throw new RangeError("Invalid group count.");
  }
  const ordered = shuffle(items, rng);
  const groups = Array.from({ length: groupCount }, () => []);
  ordered.forEach((item, index) => {
    groups[index % groupCount].push(item);
  });
  return groups;
}

export function pairs(items, rng) {
  const ordered = shuffle(items, rng);
  const result = [];
  for (let i = 0; i < ordered.length; i += 2) {
    result.push(ordered.slice(i, i + 2));
  }
  return result;
}

export function derangement(items, rng, maxAttempts = 1000) {
  if (items.length < 2) throw new RangeError("A derangement needs at least two items.");
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = shuffle(items, rng);
    if (candidate.every((item, index) => item !== items[index])) return candidate;
  }
  throw new Error("Could not create a valid derangement within the search limit.");
}

export function createRng(settings = {}) {
  return settings.mode === "seeded"
    ? new SeededRandom(settings.seed || "randomizer")
    : new SecureRandom();
}

export function randomHexColor(rng) {
  const value = rng.int(0, 0xffffff);
  return "#" + value.toString(16).padStart(6, "0").toUpperCase();
}
