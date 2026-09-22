const MODES = new Set(["instant", "normal", "showtime"]);
const EFFECT_LEVELS = new Set(["auto", "low", "high"]);
const HAPTIC_LEVELS = new Set(["off", "light", "standard", "strong"]);
const MOTION_LEVELS = new Set(["system", "reduced", "full"]);

const PROFILES = {
  coin: { normal: 780, showtime: 1450, cue: "coin", kind: "coin" },
  dice: { normal: 720, showtime: 1350, cue: "dice", kind: "dice" },
  wheel: { normal: 1750, showtime: 3200, cue: "wheel", kind: "wheel" },
  picker: { normal: 620, showtime: 1250, cue: "pick", kind: "pick" },
  sampler: { normal: 760, showtime: 1450, cue: "pick", kind: "pick" },
  shuffle: { normal: 820, showtime: 1550, cue: "shuffle", kind: "shuffle" },
  teams: { normal: 920, showtime: 1750, cue: "teams", kind: "teams" },
  groups: { normal: 920, showtime: 1750, cue: "teams", kind: "teams" },
  pairs: { normal: 760, showtime: 1450, cue: "pairs", kind: "pairs" },
  assignment: { normal: 840, showtime: 1550, cue: "assignment", kind: "assignment" },
  cards: { normal: 680, showtime: 1250, cue: "card", kind: "card" },
  ladder: { normal: 1150, showtime: 2400, cue: "ladder", kind: "ladder" },
  elimination: { normal: 840, showtime: 1800, cue: "elimination", kind: "elimination" },
  tournament: { normal: 980, showtime: 1900, cue: "tournament", kind: "tournament" },
  "secret-santa": { normal: 420, showtime: 750, cue: "private", kind: "private" },
  number: { normal: 420, showtime: 780, cue: "generator", kind: "generator" },
  chance: { normal: 480, showtime: 900, cue: "generator", kind: "generator" },
  lottery: { normal: 680, showtime: 1300, cue: "generator", kind: "generator" },
  color: { normal: 420, showtime: 780, cue: "generator", kind: "generator" },
  date: { normal: 420, showtime: 780, cue: "generator", kind: "generator" },
  time: { normal: 420, showtime: 780, cue: "generator", kind: "generator" },
  coordinate: { normal: 420, showtime: 780, cue: "generator", kind: "generator" },
  direction: { normal: 520, showtime: 1000, cue: "generator", kind: "generator" },
  letter: { normal: 420, showtime: 780, cue: "generator", kind: "generator" },
  rps: { normal: 560, showtime: 1050, cue: "generator", kind: "generator" }
};

const HAPTIC_PATTERNS = {
  coin: [10, 35, 18],
  dice: [14, 35, 24],
  wheel: [8, 30, 8, 30, 28],
  pick: [10, 25, 20],
  shuffle: [8, 20, 8],
  teams: [10, 20, 10, 20, 30],
  pairs: [10, 20, 18],
  assignment: [10, 24, 20],
  card: [8, 30, 22],
  ladder: [8, 20, 8, 20, 24],
  elimination: [18, 35, 30],
  winner: [18, 30, 18, 30, 45],
  tournament: [12, 22, 12, 22, 32],
  generator: [10, 20, 18],
  private: [8]
};

export function normalizeExperienceSettings(settings = {}) {
  const next = {
    ...settings,
    randomness: {
      mode: settings.randomness?.mode === "seeded" ? "seeded" : "secure",
      seed: settings.randomness?.seed || "ARCADE-2026",
      position: Number.isSafeInteger(settings.randomness?.position)
        ? settings.randomness.position
        : 0
    }
  };

  const presentation = settings.presentation || {};
  next.presentation = {
    mode: MODES.has(presentation.mode) ? presentation.mode : "normal",
    effects: EFFECT_LEVELS.has(presentation.effects)
      ? presentation.effects
      : "auto",
    sound: presentation.sound ?? settings.sound ?? true,
    haptics: HAPTIC_LEVELS.has(presentation.haptics)
      ? presentation.haptics
      : "standard",
    motion: MOTION_LEVELS.has(presentation.motion)
      ? presentation.motion
      : MOTION_LEVELS.has(settings.motion)
        ? settings.motion
        : "system"
  };

  // Keep old settings mirrored for compatibility with previous builds.
  next.sound = next.presentation.sound;
  next.motion = next.presentation.motion;
  return next;
}

export function shouldReduceMotion(settings, systemReduced = false) {
  const motion = normalizeExperienceSettings(settings).presentation.motion;
  if (motion === "reduced") return true;
  if (motion === "full") return false;
  return Boolean(systemReduced);
}

export function effectiveEffectsLevel(settings, capabilities = {}) {
  const normalized = normalizeExperienceSettings(settings).presentation;
  if (normalized.effects !== "auto") return normalized.effects;

  const cores = Number(capabilities.hardwareConcurrency || 0);
  const memory = Number(capabilities.deviceMemory || 0);
  const reduced = Boolean(capabilities.reducedMotion);

  if (reduced) return "low";
  if ((cores && cores <= 4) || (memory && memory <= 4)) return "low";
  return "high";
}

export function presentationPlan({
  toolId,
  settings,
  capabilities = {},
  result = null
}) {
  const normalized = normalizeExperienceSettings(settings).presentation;
  const profile = PROFILES[toolId] || {
    normal: 480,
    showtime: 900,
    cue: "generator",
    kind: "generator"
  };

  const reducedMotion = shouldReduceMotion(
    settings,
    capabilities.reducedMotion
  );
  const effects = effectiveEffectsLevel(settings, {
    ...capabilities,
    reducedMotion
  });

  let duration = normalized.mode === "instant"
    ? 0
    : normalized.mode === "showtime"
      ? profile.showtime
      : profile.normal;

  let kind = profile.kind;
  let particles = effects === "high" ? 12 : 0;
  let celebration = false;

  if (reducedMotion) {
    duration = normalized.mode === "instant" ? 0 : 180;
    kind = "fade";
    particles = 0;
  }

  if (toolId === "elimination" && result?.winner) {
    celebration = true;
    if (!reducedMotion && normalized.mode === "showtime") {
      duration = Math.max(duration, 2200);
      particles = effects === "high" ? 22 : 0;
    }
  }

  if (
    normalized.mode === "showtime"
    && ["teams", "groups", "tournament", "ladder"].includes(toolId)
  ) {
    celebration = true;
    particles = effects === "high" ? 18 : particles;
  }

  const staggerMs = normalized.mode === "instant"
    ? 0
    : reducedMotion
      ? 0
      : normalized.mode === "showtime"
        ? 95
        : 55;

  return {
    toolId,
    mode: normalized.mode,
    effects,
    reducedMotion,
    duration,
    kind,
    cue: celebration && toolId === "elimination" && result?.winner
      ? "winner"
      : profile.cue,
    haptic: celebration && toolId === "elimination" && result?.winner
      ? "winner"
      : profile.cue,
    particles,
    celebration,
    staggerMs,
    tickMs: toolId === "wheel" && duration > 0
      ? (normalized.mode === "showtime" ? 80 : 65)
      : 0
  };
}

export function hapticPattern(cue, level = "standard") {
  if (level === "off") return [];
  const base = HAPTIC_PATTERNS[cue] || HAPTIC_PATTERNS.generator;
  const factor = level === "light" ? 0.55 : level === "strong" ? 1.5 : 1;
  return base.map((value, index) =>
    index % 2 === 0 ? Math.max(1, Math.round(value * factor)) : value
  );
}

let audioContext = null;

function contextCtor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function primeAudio(enabled = true) {
  if (!enabled) return null;
  const Ctor = contextCtor();
  if (!Ctor) return null;

  try {
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

function tone(context, {
  frequency = 440,
  duration = 0.08,
  gain = 0.025,
  type = "sine",
  when = 0
} = {}) {
  if (!context) return;

  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const start = context.currentTime + when;
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.008);
  volume.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

export function playPresentationCue(cue, {
  enabled = true,
  mode = "normal"
} = {}) {
  if (!enabled || mode === "instant") return;
  const context = primeAudio(enabled);
  if (!context) return;

  const gain = mode === "showtime" ? 0.035 : 0.022;

  const sequences = {
    coin: [[440, 0], [660, 0.09]],
    dice: [[150, 0], [220, 0.08], [330, 0.16]],
    wheel: [[330, 0], [495, 0.09], [660, 0.18]],
    pick: [[420, 0], [630, 0.1]],
    shuffle: [[260, 0], [320, 0.06], [420, 0.12]],
    teams: [[260, 0], [390, 0.09], [520, 0.18]],
    pairs: [[350, 0], [520, 0.11]],
    assignment: [[300, 0], [450, 0.1]],
    card: [[240, 0], [480, 0.12]],
    ladder: [[250, 0], [360, 0.08], [520, 0.18]],
    elimination: [[180, 0], [130, 0.12]],
    winner: [[330, 0], [495, 0.09], [660, 0.18], [880, 0.28]],
    tournament: [[220, 0], [330, 0.08], [440, 0.16]],
    generator: [[420, 0], [630, 0.09]],
    private: [[360, 0]]
  };

  for (const [frequency, when] of sequences[cue] || sequences.generator) {
    tone(context, {
      frequency,
      when,
      gain,
      type: cue === "elimination" ? "triangle" : "sine"
    });
  }
}

export function playWheelTick({
  enabled = true,
  mode = "normal"
} = {}) {
  if (!enabled || mode === "instant") return;
  const context = primeAudio(enabled);
  tone(context, {
    frequency: mode === "showtime" ? 760 : 680,
    duration: 0.025,
    gain: 0.012,
    type: "square"
  });
}

export function playHaptic(cue, level = "standard") {
  if (
    typeof navigator === "undefined"
    || typeof navigator.vibrate !== "function"
  ) {
    return false;
  }

  const pattern = hapticPattern(cue, level);
  if (!pattern.length) return false;

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function cancelHaptics() {
  if (
    typeof navigator !== "undefined"
    && typeof navigator.vibrate === "function"
  ) {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore unsupported/cancel failures.
    }
  }
}
