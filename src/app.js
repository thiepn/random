import { createRng, pick, sample } from "./random-core.js";
import { CATEGORIES, TOOLS, getTool, searchTools } from "./registry.js";
import { executeTool } from "./tool-engine.js";
import { describeDiceExpression } from "./dice-engine.js";
import {
  normalizeSelection,
  reconcileSelectionEntries,
  selectionRuleSummary,
  percentage
} from "./selection-model.js";
import {
  getAll,
  put,
  putWithRevision,
  commitRunAndSession,
  commitSessionMutation,
  remove,
  clear,
  getSettings,
  saveSettings,
  requestPersistentStorage
} from "./storage.js";
import {
  normalizePool,
  createPool,
  mutatePool,
  createPoolItem,
  createPoolField,
  createWorkingSet,
  workingSetLabels,
  filterPoolItems,
  duplicateSummary,
  parseDelimitedText,
  importRowsToPoolItems,
  createPoolView,
  resolvePoolView,
  poolStats
} from "./pool-model.js";
import {
  createRule,
  ruleTypesForTool,
  validateRules,
  summarizeRule,
  ruleStrengthLabel
} from "./rule-model.js";
import { historyPairKey } from "./constraint-engine.js";
import {
  createSession,
  createRun,
  createSessionEvent,
  appendRunToSession,
  undoSession,
  redoSession,
  completeSession,
  abandonSession,
  sessionCanUndo,
  sessionCanRedo,
  resumeSessionState,
  fingerprintSetup,
  isStatefulTool,
  isSessionCompleteForTool,
  legacyHistoryToRun,
  groupHistoryRuns
} from "./session-model.js";
import {
  normalizeExperienceSettings,
  presentationPlan,
  primeAudio,
  playPresentationCue,
  playWheelTick,
  playHaptic,
  cancelHaptics
} from "./presentation-engine.js";
import {
  createPreset,
  updatePreset,
  resolvePresetInput,
  createRuleSet,
  ruleSetCompatible,
  applyRuleSet
} from "./preset-model.js";
import {
  createSessionTemplate,
  createTemplateSession,
  completeTemplateStep,
  setTemplateStepLocked,
  rerunTemplateFrom,
  previousStepItems,
  abandonTemplateSession,
  resultToItems,
  BUILTIN_SESSION_TEMPLATES
} from "./session-template-model.js";
import {
  createPartySession,
  updatePartyOptions,
  appendPartyRun,
  completePartySession,
  partyPresentationMode,
  countdownSeconds,
  makeAudienceState,
  isPrivatePartyTool
} from "./party-model.js";

const root = document.getElementById("app");
const announcer = document.getElementById("announcer");

const state = {
  view: "play",
  toolId: null,
  pools: [],
  poolViews: [],
  poolSearch: "",
  poolShowArchived: false,
  presets: [],
  ruleSets: [],
  sessionTemplates: [],
  templateSessions: [],
  activeTemplateSessionId: null,
  partySessions: [],
  activePartySessionId: null,
  partyCountdown: null,
  audiencePartyId: null,
  audienceState: null,
  history: [],
  runs: [],
  sessions: [],
  historyPins: new Set(),
  historyFilter: "all",
  favorites: [],
  settings: null,
  search: "",
  modal: null,
  tool: {},
  studioResult: null
};

const palette = [
  "#7c5cff", "#2ee5ff", "#ffca3a", "#ff5577",
  "#40e38b", "#4d8dff", "#ff63c3", "#ff923e"
];

const selectionTools = new Set(["wheel", "picker", "sampler"]);
const listInputTools = new Set([
  "wheel",
  "picker",
  "sampler",
  "shuffle",
  "teams",
  "groups",
  "pairs",
  "assignment",
  "elimination",
  "ladder",
  "secret-santa",
  "tournament"
]);
const constraintTools = new Set([
  "teams",
  "groups",
  "pairs",
  "assignment",
  "secret-santa",
  "tournament"
]);

const presentationTimers = new Map();
const wheelTickTimers = new Map();
let partyCountdownTimer = null;
let hostUnlockTimer = null;
let wakeLockSentinel = null;
let audienceChannel = null;

function node(tag, options, children) {
  const element = document.createElement(tag);
  const opts = options || {};

  for (const [key, value] of Object.entries(opts)) {
    if (value == null) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "dataset") Object.assign(element.dataset, value);
    else if (key === "style") Object.assign(element.style, value);
    else if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "checked") {
      element.checked = Boolean(value);
    } else if (key === "value") {
      element.value = value;
    } else {
      element.setAttribute(key, value);
    }
  }

  const list = Array.isArray(children)
    ? children
    : children == null
      ? []
      : [children];

  for (const child of list) {
    if (child == null) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

function iconButton(label, glyph, handler, extraClass = "") {
  return node("button", {
    class: "icon-button " + extraClass,
    type: "button",
    "aria-label": label,
    title: label,
    onClick: handler
  }, glyph);
}

function announce(message) {
  announcer.textContent = "";
  window.setTimeout(() => {
    announcer.textContent = message;
  }, 20);
}

function parseList(text) {
  return String(text || "")
    .split(/\r?\n|;/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function defaultList(toolId) {
  const lists = {
    wheel: ["Pizza", "Sushi", "Korean", "Burgers", "Indian", "Tacos"],
    picker: ["Anna", "Ben", "David", "Sarah"],
    sampler: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    shuffle: ["Anna", "Ben", "David", "Sarah", "Luke"],
    teams: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"],
    groups: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"],
    pairs: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    assignment: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    elimination: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    ladder: ["Anna", "Ben", "David", "Sarah"],
    "secret-santa": ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    tournament: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"]
  };
  return (lists[toolId] || ["Option A", "Option B", "Option C"]).join("\n");
}

function ensureToolState(toolId) {
  if (!state.tool[toolId]) {
    state.tool[toolId] = {
      listText: defaultList(toolId),
      result: null,
      error: null,
      animating: false,
      wheelRotation: 0,
      previousWheelRotation: 0,
      pendingWheelRotation: null,

      diceCount: 2,
      diceSides: 6,
      diceMode: "quick",
      diceExpression: "2d6",
      diceHistory: [],
      diceHelpOpen: false,

      numberMin: 1,
      numberMax: 100,
      numberMode: "integer",
      numberPrecision: 2,
      numberCount: 1,
      numberUnique: false,

      teamCount: 2,
      groupCount: 3,
      sampleCount: 3,
      selectionEntries: [],
      workingSet: null,
      workingSetDirty: false,
      allowRepeats: false,
      selectionOpen: false,
      fairnessOpen: false,
      rules: [],
      rulesOpen: false,
      solverEffort: "automatic",
      lastSolverDiagnostics: null,
      lastConstraintScore: null,

      targetText: "Setup\nCleanup\nSnacks",
      ladderOutcomes: "Prize A\nPrize B\nPrize C\nPrize D",
      ladder: null,

      chance: 50,

      lotteryCount: 6,
      lotteryMax: 49,

      timeStart: "09:00",
      timeEnd: "17:00",

      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 10,

      eliminationRemaining: null,
      eliminationOut: [],
      eliminationSignature: "",

      secretAssignments: null,
      secretReveal: null,

      dateStart: new Date().toISOString().slice(0, 10),
      dateEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),

      deck: null,
      presentation: null,
      activePresetId: null,
      templateSessionId: null,
      templateStepIndex: null,
      templateStepId: null,
      activeSessionId: null,
      replayRunId: null
    };
  }
  return state.tool[toolId];
}

function reconcileToolSelection(toolId, toolState) {
  if (!selectionTools.has(toolId)) return [];
  const items = parseList(toolState.listText);
  toolState.selectionEntries = reconcileSelectionEntries(
    items,
    toolState.selectionEntries || []
  );
  return items;
}

function syncSelectionState(toolId, toolState) {
  const items = reconcileToolSelection(toolId, toolState);
  if (!selectionTools.has(toolId)) return null;
  return normalizeSelection(items, toolState.selectionEntries);
}

function currentSelectionModel(toolId, toolState) {
  if (!selectionTools.has(toolId)) return null;
  try {
    return syncSelectionState(toolId, toolState);
  } catch {
    return null;
  }
}

function invalidateTool(toolId, toolState, resetSession = false) {
  clearPresentationTimers(toolId);
  cancelHaptics();
  toolState.presentation = null;
  toolState.result = null;
  toolState.error = null;
  toolState.animating = false;
  toolState.pendingWheelRotation = null;
  toolState.lastSolverDiagnostics = null;
  toolState.lastConstraintScore = null;

  if (toolId === "ladder") toolState.ladder = null;

  if (toolId === "elimination") {
    toolState.eliminationRemaining = null;
    toolState.eliminationOut = [];
    toolState.eliminationSignature = "";
  }

  if (toolId === "secret-santa") {
    toolState.secretAssignments = null;
    toolState.secretReveal = null;
  }

  if (resetSession && toolId === "cards") {
    toolState.deck = null;
  }
}

function presentationCapabilities() {
  return {
    reducedMotion:
      typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    hardwareConcurrency:
      typeof navigator !== "undefined"
        ? navigator.hardwareConcurrency
        : undefined,
    deviceMemory:
      typeof navigator !== "undefined"
        ? navigator.deviceMemory
        : undefined
  };
}

function clearPresentationTimers(toolId) {
  const timer = presentationTimers.get(toolId);
  if (timer) {
    clearTimeout(timer);
    presentationTimers.delete(toolId);
  }

  const tick = wheelTickTimers.get(toolId);
  if (tick) {
    clearInterval(tick);
    wheelTickTimers.delete(toolId);
  }
}

function finishPresentation(toolId, token = null, shouldRender = true) {
  const ts = ensureToolState(toolId);
  if (token && ts.presentation?.token !== token) return;

  clearPresentationTimers(toolId);
  cancelHaptics();

  ts.animating = false;
  if (toolId === "wheel") {
    ts.pendingWheelRotation = null;
    ts.previousWheelRotation = ts.wheelRotation;
  }
  ts.presentation = null;

  if (shouldRender && state.toolId === toolId) render();
}

function skipPresentation(toolId) {
  const ts = ensureToolState(toolId);
  if (!ts.animating && !ts.presentation) return false;
  finishPresentation(toolId, ts.presentation?.token || null, true);
  announce("Reveal skipped. The committed result is unchanged.");
  return true;
}

function beginPresentation(toolId, ts, result) {
  clearPresentationTimers(toolId);

  const settings = normalizeExperienceSettings(state.settings);
  state.settings = settings;

  const effectiveSettings = cloneData(settings);
  const party = activePartySession();
  if (
    state.view === "party"
    && party
    && party.toolId === toolId
  ) {
    effectiveSettings.presentation.mode =
      partyPresentationMode(party.options.pace);
  }

  const plan = presentationPlan({
    toolId,
    settings: effectiveSettings,
    capabilities: presentationCapabilities(),
    result
  });

  const token =
    String(Date.now())
    + ":"
    + toolId
    + ":"
    + String(state.runs[0]?.id || "");

  ts.presentation = {
    ...plan,
    token,
    active: plan.duration > 0,
    startedAt: Date.now()
  };
  ts.animating = plan.duration > 0;

  primeAudio(settings.presentation.sound);
  playPresentationCue(plan.cue, {
    enabled: settings.presentation.sound,
    mode: plan.mode
  });
  playHaptic(plan.haptic, settings.presentation.haptics);

  if (
    toolId === "wheel"
    && plan.tickMs > 0
    && settings.presentation.sound
  ) {
    const tick = setInterval(() => {
      playWheelTick({
        enabled: settings.presentation.sound,
        mode: plan.mode
      });
    }, plan.tickMs);
    wheelTickTimers.set(toolId, tick);
  }

  if (plan.duration > 0) {
    const timer = setTimeout(
      () => finishPresentation(toolId, token, true),
      plan.duration
    );
    presentationTimers.set(toolId, timer);
  } else {
    ts.presentation = null;
    ts.animating = false;
  }

  return plan;
}

function prepareRandomSource() {
  if (state.settings.randomness.mode !== "seeded") {
    return {
      source: createRng({ mode: "secure" }),
      context: { mode: "secure" },
      settingsRecord: null
    };
  }

  const position = Number.isSafeInteger(state.settings.randomness.position)
    ? state.settings.randomness.position
    : 0;
  const seed = state.settings.randomness.seed || "ARCADE-2026";
  const nextSettings = cloneData(state.settings);
  nextSettings.randomness.position = position + 1;

  const source = createRng({
    mode: "seeded",
    seed: seed + "::" + position
  });

  return {
    source,
    context: { mode: "seeded", seed, position },
    settingsRecord: { id: "app", value: nextSettings },
    nextSettings
  };
}

async function loadData() {
  const [
    pools,
    poolViews,
    presets,
    ruleSets,
    sessionTemplates,
    templateSessions,
    partySessions,
    historyEntries,
    runs,
    sessions,
    pins,
    favorites,
    settings
  ] = await Promise.all([
    getAll("pools"),
    getAll("poolViews"),
    getAll("presets"),
    getAll("ruleSets"),
    getAll("sessionTemplates"),
    getAll("templateSessions"),
    getAll("partySessions"),
    getAll("history"),
    getAll("runs"),
    getAll("sessions"),
    getAll("historyPins"),
    getAll("favorites"),
    getSettings()
  ]);

  state.pools = pools
    .map(normalizePool)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  state.poolViews = poolViews;
  state.presets = presets.sort((a, b) => b.updatedAt - a.updatedAt);
  state.ruleSets = ruleSets.sort((a, b) => b.updatedAt - a.updatedAt);
  state.sessionTemplates = sessionTemplates.sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  state.templateSessions = templateSessions.sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  state.partySessions = partySessions.sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  state.history = historyEntries
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 500);
  state.runs = runs.sort((a, b) => b.timestamp - a.timestamp);
  state.sessions = sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  state.historyPins = new Set(pins.map((entry) => entry.id));
  state.favorites = favorites.map((entry) => entry.id);
  state.settings = normalizeExperienceSettings(settings);
}

function cloneData(value) {
  return value == null ? value : structuredClone(value);
}

function snapshotToolState(toolId, toolState) {
  const snapshot = cloneData(toolState);
  delete snapshot.error;
  delete snapshot.animating;
  delete snapshot.pendingWheelRotation;
  delete snapshot.selectionOpen;
  delete snapshot.fairnessOpen;
  delete snapshot.rulesOpen;
  delete snapshot.diceHelpOpen;
  delete snapshot.presentation;
  delete snapshot.activePresetId;
  delete snapshot.templateSessionId;
  delete snapshot.templateStepIndex;
  delete snapshot.templateStepId;
  delete snapshot.activeSessionId;
  delete snapshot.replayRunId;
  return snapshot;
}

function setupSnapshot(toolId, toolState) {
  const snapshot = snapshotToolState(toolId, toolState);
  snapshot.result = null;
  snapshot.lastSolverDiagnostics = null;
  snapshot.lastConstraintScore = null;
  snapshot.wheelRotation = 0;
  snapshot.previousWheelRotation = 0;
  snapshot.diceHistory = [];
  snapshot.ladder = null;
  snapshot.secretAssignments = null;
  snapshot.secretReveal = null;

  if (toolId === "cards") {
    snapshot.deck = null;
  }

  if (toolId === "elimination") {
    snapshot.eliminationRemaining = null;
    snapshot.eliminationOut = [];
    snapshot.eliminationSignature = "";
  }

  return snapshot;
}

function restoreToolSnapshot(toolId, snapshot, {
  sessionId = null,
  replayRunId = null
} = {}) {
  const previous = ensureToolState(toolId);
  const restored = {
    ...previous,
    ...cloneData(snapshot),
    error: null,
    animating: false,
    presentation: null,
    pendingWheelRotation: null,
    activeSessionId: sessionId,
    replayRunId
  };
  state.tool[toolId] = restored;
  return restored;
}

function sessionById(id) {
  return state.sessions.find((session) => session.id === id) || null;
}

function runById(id) {
  return state.runs.find((run) => run.id === id) || null;
}

function historyRunById(id) {
  const canonical = runById(id);
  if (canonical) return canonical;

  if (String(id).startsWith("legacy:")) {
    const legacyId = String(id).slice("legacy:".length);
    const entry = state.history.find(
      (item) => String(item.id) === legacyId
    );
    return entry ? legacyHistoryToRun(entry) : null;
  }

  return null;
}

function replaceSession(next) {
  state.sessions = [
    next,
    ...state.sessions.filter((session) => session.id !== next.id)
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

function latestActiveSession(toolId) {
  return state.sessions
    .filter((session) => session.toolId === toolId && session.status === "active")
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

function resumeSessionInTool(session) {
  const restored = restoreToolSnapshot(
    session.toolId,
    resumeSessionState(session),
    { sessionId: session.id }
  );
  restored.replayRunId = null;
  return restored;
}

function maybeResumeLatestSession(toolId) {
  if (!isStatefulTool(toolId)) return null;
  const current = ensureToolState(toolId);
  if (current.activeSessionId) {
    const session = sessionById(current.activeSessionId);
    if (session?.status === "active") return session;
  }

  const session = latestActiveSession(toolId);
  if (!session) return null;
  resumeSessionInTool(session);
  return session;
}

function runInputSnapshot(toolId, toolState) {
  return {
    items: parseList(toolState.listText),
    workingSetSource: cloneData(toolState.workingSet?.source || null)
  };
}

function runConfigSnapshot(toolId, toolState) {
  return setupSnapshot(toolId, toolState);
}

function setupFingerprintFor(toolId, toolState) {
  return fingerprintSetup(
    toolId,
    runInputSnapshot(toolId, toolState),
    runConfigSnapshot(toolId, toolState)
  );
}

function runsByIdMap() {
  return new Map(state.runs.map((run) => [run.id, run]));
}

function presetById(id) {
  return state.presets.find((preset) => preset.id === id) || null;
}

function ruleSetById(id) {
  return state.ruleSets.find((ruleSet) => ruleSet.id === id) || null;
}

function allSessionTemplates() {
  return [
    ...BUILTIN_SESSION_TEMPLATES,
    ...state.sessionTemplates
  ];
}

function sessionTemplateById(id) {
  return allSessionTemplates().find((template) => template.id === id) || null;
}

function templateSessionById(id) {
  return state.templateSessions.find((session) => session.id === id) || null;
}

function replaceTemplateSession(next) {
  state.templateSessions = [
    next,
    ...state.templateSessions.filter((session) => session.id !== next.id)
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

function partySessionById(id) {
  return state.partySessions.find((session) => session.id === id) || null;
}

function replacePartySession(next) {
  state.partySessions = [
    next,
    ...state.partySessions.filter((session) => session.id !== next.id)
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

function activePartySession() {
  return partySessionById(state.activePartySessionId);
}

function latestActivePartyForTool(toolId) {
  return state.partySessions
    .filter(
      (party) =>
        party.toolId === toolId
        && party.status === "active"
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

function closeAudienceChannel() {
  if (audienceChannel) {
    try {
      audienceChannel.close();
    } catch {
      // Channel cleanup is best effort.
    }
    audienceChannel = null;
  }
}

function partyChannelFor(partyId) {
  if (typeof BroadcastChannel === "undefined") return null;
  if (
    audienceChannel
    && audienceChannel.name === "randomizer-party:" + partyId
  ) {
    return audienceChannel;
  }
  closeAudienceChannel();
  audienceChannel = new BroadcastChannel("randomizer-party:" + partyId);
  return audienceChannel;
}

function latestPartyRun(party) {
  if (!party?.runIds?.length) return null;
  return runById(party.runIds[party.runIds.length - 1]);
}

function broadcastPartyAudience({
  party = activePartySession(),
  run = null,
  stage = "ready",
  countdown = 0,
  privateReveal = false
} = {}) {
  if (!party?.options?.audienceEnabled) return;
  const tool = getTool(party.toolId);
  if (!tool) return;

  const channel = partyChannelFor(party.id);
  if (!channel) return;

  channel.onmessage = (event) => {
    const message = event.data;
    if (
      message?.type === "party-state-request"
      && message.partyId === party.id
      && state.view === "party"
      && state.activePartySessionId === party.id
    ) {
      broadcastPartyAudience({
        party: activePartySession(),
        run: latestPartyRun(activePartySession()),
        stage:
          state.partyCountdown != null
            ? "countdown"
            : activePartySession()?.options?.paused
              ? "paused"
              : latestPartyRun(activePartySession())
                ? "result"
                : "ready",
        countdown: state.partyCountdown || 0,
        privateReveal:
          isPrivatePartyTool(party.toolId)
          && ensureToolState(party.toolId).secretReveal != null
      });
    }
  };

  const payload = makeAudienceState({
    party,
    tool,
    run: run || latestPartyRun(party),
    stage,
    countdown,
    privateReveal
  });

  channel.postMessage(payload);
}

async function requestPartyWakeLock(party = activePartySession()) {
  if (!party?.options?.wakeLock || !navigator.wakeLock?.request) return false;
  if (wakeLockSentinel && !wakeLockSentinel.released) return true;

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    }, { once: true });
    return true;
  } catch {
    wakeLockSentinel = null;
    return false;
  }
}

async function releasePartyWakeLock() {
  if (!wakeLockSentinel) return;
  try {
    await wakeLockSentinel.release();
  } catch {
    // Ignore already-released wake locks.
  }
  wakeLockSentinel = null;
}

async function requestPartyFullscreen() {
  const target = document.documentElement;
  if (!document.fullscreenElement && target.requestFullscreen) {
    try {
      await target.requestFullscreen();
    } catch {
      // Installed PWAs or platform restrictions may already be immersive.
    }
  }
}

async function exitPartyFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore platform fullscreen exit failures.
    }
  }
}

async function persistPartyOptions(party, patch) {
  const next = updatePartyOptions(party, patch);
  await putWithRevision("partySessions", next, party.revision);
  replacePartySession(next);
  return next;
}

async function startPartyMode(toolId) {
  const tool = getTool(toolId);
  if (!tool) return;

  const party = createPartySession({
    toolId,
    toolName: tool.name,
    icon: tool.icon,
    options: {
      pace: "standard",
      countdown: "short",
      fullscreen: true,
      wakeLock: true
    }
  });

  const fullscreenAttempt = party.options.fullscreen
    ? requestPartyFullscreen()
    : Promise.resolve();

  await put("partySessions", party);
  replacePartySession(party);
  const ts = ensureToolState(toolId);
  ts.replayRunId = null;
  if (toolId === "secret-santa") ts.secretReveal = null;

  state.activePartySessionId = party.id;
  state.view = "party";
  state.toolId = toolId;
  state.modal = null;
  state.partyCountdown = null;

  history.replaceState(
    {},
    "",
    location.pathname + "?party=" + encodeURIComponent(party.id)
  );

  await fullscreenAttempt;
  await requestPartyWakeLock(party);
  broadcastPartyAudience({ party, stage: "ready" });
  render();
}

async function openPartySession(partyId) {
  const party = partySessionById(partyId);
  if (!party || party.status !== "active") return false;

  state.activePartySessionId = party.id;
  state.view = "party";
  state.toolId = party.toolId;
  state.modal = null;
  state.partyCountdown = null;

  const latest = latestPartyRun(party);
  if (latest?.afterState) {
    restoreToolSnapshot(party.toolId, latest.afterState);
  } else {
    ensureToolState(party.toolId);
  }
  maybeResumeLatestSession(party.toolId);

  history.replaceState(
    {},
    "",
    location.pathname + "?party=" + encodeURIComponent(party.id)
  );

  if (party.options.fullscreen) await requestPartyFullscreen();
  await requestPartyWakeLock(party);
  broadcastPartyAudience({ party, stage: "ready" });
  render();
  return true;
}

async function endPartyMode() {
  const party = activePartySession();

  if (partyCountdownTimer) {
    clearInterval(partyCountdownTimer);
    partyCountdownTimer = null;
  }
  state.partyCountdown = null;

  if (party && party.status === "active") {
    const next = completePartySession(party);
    await putWithRevision("partySessions", next, party.revision);
    replacePartySession(next);
    broadcastPartyAudience({
      party: next,
      run: latestPartyRun(next),
      stage: "ended"
    });
  }

  window.setTimeout(closeAudienceChannel, 80);
  await releasePartyWakeLock();
  await exitPartyFullscreen();

  state.activePartySessionId = null;
  state.view = "tool";
  history.replaceState(
    {},
    "",
    location.pathname + "?tool=" + encodeURIComponent(state.toolId)
  );
  render();
}

async function openAudienceWindow(party = activePartySession()) {
  if (!party) return;

  const url =
    location.origin
    + location.pathname
    + "?audience="
    + encodeURIComponent(party.id);

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();

  let current = party;
  if (!current.options.audienceEnabled) {
    current = await persistPartyOptions(current, {
      audienceEnabled: true
    });
  }

  broadcastPartyAudience({ party: current, stage: "ready" });
}

function presetConfigSnapshot(toolId, toolState) {
  const snapshot = setupSnapshot(toolId, toolState);
  delete snapshot.listText;
  delete snapshot.workingSet;
  delete snapshot.workingSetDirty;
  delete snapshot.rules;
  return snapshot;
}

function frozenPresetItems(toolId, toolState) {
  const labels = parseList(toolState.listText);
  const selection = selectionTools.has(toolId)
    ? reconcileSelectionEntries(labels, toolState.selectionEntries || [])
    : labels.map((label, index) => ({
        key: label + "\u001f" + (index + 1),
        label,
        weight: 1,
        excluded: false
      }));

  const workingItems = toolState.workingSet?.items || [];
  const aligned = workingItems.length === labels.length;

  return labels.map((label, index) => ({
    id: aligned
      ? String(workingItems[index].id)
      : "item:" + index,
    label,
    weight: Number(selection[index]?.weight ?? workingItems[index]?.weight ?? 1),
    tags: aligned && Array.isArray(workingItems[index].tags)
      ? [...workingItems[index].tags]
      : [],
    values: aligned && workingItems[index].values
      ? { ...workingItems[index].values }
      : {}
  }));
}

async function applyPresetToTool(preset, {
  open = true,
  preserveTemplateContext = false
} = {}) {
  if (!preset) return null;
  const tool = getTool(preset.toolId);
  if (!tool) throw new Error("Preset tool is no longer available.");

  const previous = ensureToolState(tool.id);
  if (previous.activeSessionId && isStatefulTool(tool.id)) {
    await endActiveSession(tool.id, "abandoned", true);
  }

  const next = {
    ...ensureToolState(tool.id),
    ...cloneData(preset.configSnapshot || {}),
    result: null,
    error: null,
    animating: false,
    presentation: null,
    pendingWheelRotation: null,
    activePresetId: preset.id,
    replayRunId: null,
    activeSessionId: null
  };

  if (!preserveTemplateContext) {
    next.templateSessionId = null;
    next.templateStepIndex = null;
    next.templateStepId = null;
  }

  const resolved = resolvePresetInput(preset, {
    pools: state.pools,
    views: state.poolViews,
    createWorkingSet,
    resolvePoolView
  });

  if (resolved.mode === "prompt") {
    next.listText = "";
    next.workingSet = null;
    next.workingSetDirty = false;
  } else if (resolved.workingSet) {
    next.workingSet = resolved.workingSet;
    next.listText = workingSetLabels(resolved.workingSet).join("\n");
    next.workingSetDirty = false;
  }

  const sourcePoolId = next.workingSet?.source?.poolId || null;
  const savedRuleSet = preset.ruleSetId
    ? ruleSetById(preset.ruleSetId)
    : null;

  if (
    savedRuleSet
    && ruleSetCompatible(savedRuleSet, {
      toolId: tool.id,
      sourcePoolId
    })
  ) {
    next.rules = applyRuleSet(savedRuleSet);
  } else {
    next.rules = cloneData(preset.rulesSnapshot || []);
  }

  state.tool[tool.id] = next;

  if (selectionTools.has(tool.id)) {
    reconcileToolSelection(tool.id, next);
    if (resolved.workingSet) {
      next.selectionEntries = next.selectionEntries.map((entry, index) => ({
        ...entry,
        weight: resolved.workingSet.items[index]?.weight ?? entry.weight,
        excluded: Boolean(entry.excluded)
      }));
    }
  }

  if (open) {
    state.view = "tool";
    state.toolId = tool.id;
    state.modal = null;
    history.replaceState(
      {},
      "",
      location.pathname + "?tool=" + encodeURIComponent(tool.id)
    );
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return next;
}


async function updateActivePartyOptions(patch) {
  const party = activePartySession();
  if (!party) return null;

  const next = await persistPartyOptions(party, patch);

  if ("wakeLock" in patch) {
    if (next.options.wakeLock) await requestPartyWakeLock(next);
    else await releasePartyWakeLock();
  }

  if ("fullscreen" in patch) {
    if (next.options.fullscreen) await requestPartyFullscreen();
    else await exitPartyFullscreen();
  }

  broadcastPartyAudience({ party: next, stage: "ready" });
  render();
  return next;
}

function cancelPartyCountdown({
  renderAfter = true,
  announceCancel = false
} = {}) {
  if (partyCountdownTimer) {
    clearInterval(partyCountdownTimer);
    partyCountdownTimer = null;
  }

  const wasActive = state.partyCountdown != null;
  state.partyCountdown = null;

  const party = activePartySession();
  if (party) {
    broadcastPartyAudience({ party, stage: "ready", countdown: 0 });
  }

  if (announceCancel && wasActive) {
    announce("Countdown cancelled.");
  }
  if (renderAfter && wasActive) render();
}

async function runPartyAction() {
  const party = activePartySession();
  if (!party || party.status !== "active") return;

  const ts = ensureToolState(party.toolId);

  if (party.options.paused) {
    announce("Party is paused.");
    return;
  }

  if (ts.animating || ts.presentation) {
    skipPresentation(party.toolId);
    return;
  }

  if (state.partyCountdown != null) {
    cancelPartyCountdown({
      renderAfter: true,
      announceCancel: true
    });
    return;
  }

  const seconds = countdownSeconds(party.options.countdown);
  if (!seconds) {
    await runTool(party.toolId);
    return;
  }

  state.partyCountdown = seconds;
  broadcastPartyAudience({
    party,
    stage: "countdown",
    countdown: seconds
  });
  render();

  partyCountdownTimer = setInterval(async () => {
    state.partyCountdown -= 1;

    if (state.partyCountdown > 0) {
      broadcastPartyAudience({
        party: activePartySession(),
        stage: "countdown",
        countdown: state.partyCountdown
      });
      render();
      return;
    }

    clearInterval(partyCountdownTimer);
    partyCountdownTimer = null;
    state.partyCountdown = null;
    render();
    await runTool(party.toolId);
  }, 1000);
}

function partyFairnessBadges(tool, ts) {
  const badges = [
    state.settings.randomness.mode === "seeded"
      ? "Seeded"
      : "Secure Random"
  ];

  if (selectionTools.has(tool.id)) {
    const model = currentSelectionModel(tool.id, ts);
    if (model?.customWeights) badges.push("Weighted");
    if (model?.excludedCount) {
      badges.push(model.excludedCount + " excluded");
    }
  }

  if (constraintTools.has(tool.id)) {
    const active = (ts.rules || []).filter(
      (rule) => rule.enabled !== false
    );
    if (active.length) badges.push(active.length + " rules");
  }

  return badges;
}

function partyPaceControl(party) {
  return node("div", {
    class: "segmented party-segment",
    "aria-label": "Party reveal pace"
  }, [
    ["fast", "Fast"],
    ["standard", "Standard"],
    ["dramatic", "Dramatic"]
  ].map(([value, label]) =>
    node("button", {
      class: party.options.pace === value ? "active" : "",
      type: "button",
      onClick: () => updateActivePartyOptions({ pace: value })
    }, label)
  ));
}

function partyCountdownControl(party) {
  return node("div", {
    class: "segmented party-segment",
    "aria-label": "Party countdown"
  }, [
    ["off", "No Count"],
    ["short", "3s"],
    ["full", "5s"]
  ].map(([value, label]) =>
    node("button", {
      class: party.options.countdown === value ? "active" : "",
      type: "button",
      onClick: () => updateActivePartyOptions({ countdown: value })
    }, label)
  ));
}

function partyHostLockButton(party) {
  if (!party.options.hostLocked) {
    return node("button", {
      class: "party-icon-button",
      type: "button",
      onClick: () => updateActivePartyOptions({ hostLocked: true })
    }, "Lock Host");
  }

  const clearUnlock = () => {
    if (hostUnlockTimer) {
      clearTimeout(hostUnlockTimer);
      hostUnlockTimer = null;
    }
  };

  const button = node("button", {
    class: "party-unlock-button",
    type: "button",
    "aria-label": "Hold to unlock host controls"
  }, "Hold to unlock");

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    clearUnlock();
    button.classList.add("is-holding");
    hostUnlockTimer = setTimeout(async () => {
      hostUnlockTimer = null;
      button.classList.remove("is-holding");
      await updateActivePartyOptions({ hostLocked: false });
      announce("Host controls unlocked.");
    }, 900);
  });

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(type, () => {
      button.classList.remove("is-holding");
      clearUnlock();
    });
  }

  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.repeat || hostUnlockTimer) return;
    event.preventDefault();
    button.classList.add("is-holding");
    hostUnlockTimer = setTimeout(async () => {
      hostUnlockTimer = null;
      button.classList.remove("is-holding");
      await updateActivePartyOptions({ hostLocked: false });
      announce("Host controls unlocked.");
    }, 900);
  });

  button.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    button.classList.remove("is-holding");
    clearUnlock();
  });

  return button;
}

function partyPrivateControls(tool, ts, party) {
  if (tool.id !== "secret-santa" || !ts.secretAssignments) return null;

  if (!Number.isSafeInteger(ts.partyPrivateIndex)) {
    ts.partyPrivateIndex = 0;
  }
  if (ts.partyPrivateIndex >= ts.secretAssignments.length) {
    ts.partyPrivateIndex = 0;
  }

  const assignment = ts.secretAssignments[ts.partyPrivateIndex];

  if (ts.secretReveal != null) {
    return node("div", { class: "party-private-controls" }, [
      node("div", { class: "party-private-instruction" }, [
        node("strong", { text: "Private result visible" }),
        node("span", {
          text: "Hide it before passing the device."
        })
      ]),
      node("button", {
        class: "primary party-primary",
        type: "button",
        disabled: party.options.paused ? "disabled" : null,
        onClick: () => {
          finishPresentation("secret-santa", null, false);
          ts.secretReveal = null;
          ts.partyPrivateIndex =
            (ts.partyPrivateIndex + 1) % ts.secretAssignments.length;
          broadcastPartyAudience({
            party,
            stage: "private",
            privateReveal: true
          });
          render();
        }
      }, "Hide & Pass")
    ]);
  }

  return node("div", { class: "party-private-controls" }, [
    node("div", { class: "party-private-instruction" }, [
      node("span", { text: "Pass the device to" }),
      node("strong", { text: assignment.source })
    ]),
    node("button", {
      class: "primary party-primary",
      type: "button",
      disabled: party.options.paused ? "disabled" : null,
      onClick: () => {
        ts.secretReveal = ts.partyPrivateIndex;
        beginPresentation(
          "secret-santa",
          ts,
          { privateReveal: true }
        );
        broadcastPartyAudience({
          party,
          stage: "private",
          privateReveal: true
        });
        render();
      }
    }, "Tap to Reveal")
  ]);
}

function renderParty() {
  const party = activePartySession();
  const tool = party ? getTool(party.toolId) : null;

  if (!party || !tool) {
    return node("main", { class: "party-shell party-error" }, [
      node("strong", { text: "Party Session unavailable" }),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => setView("play")
      }, "Back")
    ]);
  }

  const ts = ensureToolState(tool.id);
  const locked = party.options.hostLocked;
  const privateControls = partyPrivateControls(tool, ts, party);

  const shell = node("main", {
    class:
      "party-shell accent-"
      + tool.accent
      + (locked ? " host-locked" : "")
  });

  const top = node("header", { class: "party-host-bar" }, [
    node("div", { class: "party-host-title" }, [
      node("span", {
        class: "party-tool-icon",
        text: tool.icon,
        "aria-hidden": "true"
      }),
      node("div", {}, [
        node("strong", { text: tool.name }),
        node("span", {
          text:
            "Round "
            + (
              ts.result && state.partyCountdown == null
                ? Math.max(1, party.runIds.length)
                : party.round
            )
            + " · "
            + party.options.pace
        })
      ])
    ]),
    node("div", { class: "party-host-lock-slot" }, [
      partyHostLockButton(party)
    ])
  ]);

  shell.append(top);

  const fairness = node("div", {
    class: "party-fairness-strip",
    "aria-label": "Randomization information"
  }, partyFairnessBadges(tool, ts).map((label) =>
    node("span", { text: label })
  ));

  shell.append(fairness);

  const arena = node("section", { class: "party-arena" }, [
    buildStage(tool, ts)
  ]);

  if (state.partyCountdown != null) {
    arena.append(node("div", {
      class: "party-countdown-overlay",
      role: "status",
      "aria-live": "assertive"
    }, [
      node("span", { text: "GET READY" }),
      node("strong", { text: String(state.partyCountdown) })
    ]));
  }

  shell.append(arena);

  const actionZone = node("footer", { class: "party-action-zone" });

  if (privateControls) {
    actionZone.append(privateControls);
  } else {
    actionZone.append(node("button", {
      class: "primary party-primary",
      type: "button",
      disabled: party.options.paused ? "disabled" : null,
      onClick: runPartyAction
    }, party.options.paused
      ? "PARTY PAUSED"
      : state.partyCountdown != null
        ? "CANCEL COUNTDOWN"
        : actionLabel(tool.id, ts)
    ));
  }

  if (!locked) {
    const hostControls = node("div", { class: "party-host-controls" }, [
      partyPaceControl(party),
      partyCountdownControl(party),
      isStatefulTool(tool.id) && ts.activeSessionId
        ? node("button", {
            class: "party-icon-button",
            type: "button",
            disabled:
              sessionCanUndo(sessionById(ts.activeSessionId))
                ? null
                : "disabled",
            onClick: () => undoActiveSession(tool.id)
          }, "Undo")
        : null,
      node("button", {
        class: "party-icon-button",
        type: "button",
        onClick: async () => {
          const pausing = !party.options.paused;
          if (pausing) {
            cancelPartyCountdown({ renderAfter: false });
          }
          const next = await updateActivePartyOptions({
            paused: pausing
          });
          broadcastPartyAudience({
            party: next,
            stage: next.options.paused ? "paused" : "ready"
          });
        }
      }, party.options.paused ? "Resume" : "Pause"),
      node("button", {
        class: "party-icon-button",
        type: "button",
        onClick: async () => {
          await updatePresentationSetting(
            "sound",
            !state.settings.presentation.sound
          );
          render();
        }
      }, state.settings.presentation.sound ? "Mute" : "Unmute"),
      node("button", {
        class: "party-icon-button",
        type: "button",
        onClick: () => requestPartyFullscreen()
      }, "Fullscreen"),
      node("button", {
        class: "party-icon-button",
        type: "button",
        disabled:
          typeof BroadcastChannel === "undefined"
            ? "disabled"
            : null,
        onClick: () => openAudienceWindow(party)
      }, party.options.audienceEnabled ? "Audience ✓" : "Audience"),
      node("button", {
        class: "party-icon-button",
        type: "button",
        onClick: () => updateActivePartyOptions({
          wakeLock: !party.options.wakeLock
        })
      }, party.options.wakeLock ? "Wake ✓" : "Wake"),
      node("button", {
        class: "party-icon-button party-exit",
        type: "button",
        onClick: endPartyMode
      }, "Exit")
    ]);

    actionZone.append(hostControls);
  }

  shell.append(actionZone);
  return shell;
}

function audienceResultNode(toolId, result) {
  if (result == null) {
    return node("div", {
      class: "audience-result audience-result-empty",
      text: "READY"
    });
  }

  if (typeof result === "string" || typeof result === "number") {
    return node("div", {
      class: "audience-result",
      text: String(result)
    });
  }

  if (Array.isArray(result)) {
    if (toolId === "teams" || toolId === "groups") {
      return node("div", { class: "audience-team-grid" },
        result.map((group, index) =>
          node("div", { class: "audience-team-card" }, [
            node("strong", {
              text:
                (toolId === "teams" ? "Team " : "Group ")
                + (index + 1)
            }),
            node("span", {
              text: Array.isArray(group) ? group.join(", ") : String(group)
            })
          ])
        )
      );
    }

    if (toolId === "tournament") {
      return node("div", { class: "audience-team-grid" },
        result.map((match) =>
          node("div", { class: "audience-team-card" }, [
            node("strong", {
              text: match.b
                ? match.a + " vs " + match.b
                : match.a + " — BYE"
            })
          ])
        )
      );
    }

    return node("div", { class: "audience-list" },
      result.map((item) =>
        node("span", {
          text:
            Array.isArray(item)
              ? item.join(" ↔ ")
              : typeof item === "object"
                ? item.source && item.target
                  ? item.source + " → " + item.target
                  : JSON.stringify(item)
                : String(item)
        })
      )
    );
  }

  if (typeof result === "object") {
    const text =
      result.winner
      || result.eliminated
      || result.card
      || result.total
      || result.summary
      || (
        result.x != null && result.y != null
          ? "(" + result.x + ", " + result.y + ")"
          : ""
      );

    return node("div", {
      class: "audience-result",
      text: String(text || "RESULT")
    });
  }

  return node("div", {
    class: "audience-result",
    text: String(result)
  });
}

function renderAudience() {
  const data = state.audienceState;

  if (!data) {
    return node("main", { class: "audience-shell waiting" }, [
      node("div", { class: "audience-waiting-mark", text: "✦" }),
      node("strong", { text: "Waiting for host" }),
      node("span", {
        text: "This window only receives sanitized Party presentation data."
      })
    ]);
  }

  const shell = node("main", {
    class: "audience-shell accent-" + (data.tool?.accent || "cyan")
  });

  shell.append(node("header", { class: "audience-header" }, [
    node("div", {}, [
      node("span", {
        class: "party-tool-icon",
        text: data.tool?.icon || "✦"
      }),
      node("strong", {
        text: data.tool?.name || "Randomizer Arcade"
      })
    ]),
    node("span", {
      text: "Round " + data.round
    })
  ]));

  if (data.stage === "ended") {
    shell.append(node("section", {
      class: "audience-private audience-ended"
    }, [
      node("div", { text: "✓" }),
      node("strong", { text: "Party ended" }),
      node("span", { text: "Thanks for playing." })
    ]));
  } else if (data.stage === "paused") {
    shell.append(node("section", {
      class: "audience-private audience-paused"
    }, [
      node("div", { text: "Ⅱ" }),
      node("strong", { text: "Paused" }),
      node("span", { text: "Waiting for the host." })
    ]));
  } else if (data.countdown > 0) {
    shell.append(node("section", {
      class: "audience-countdown"
    }, [
      node("span", { text: "GET READY" }),
      node("strong", { text: String(data.countdown) })
    ]));
  } else if (data.private) {
    shell.append(node("section", {
      class: "audience-private"
    }, [
      node("div", { text: "◈" }),
      node("strong", { text: "Private reveal" }),
      node("span", {
        text: "The assignment stays on the host device."
      })
    ]));
  } else {
    shell.append(node("section", { class: "audience-stage" }, [
      node("span", {
        class: "audience-status",
        text: data.statusText || "Ready"
      }),
      audienceResultNode(data.tool?.id, data.result)
    ]));
  }

  if (data.fairness) {
    const labels = [
      data.fairness.mode,
      data.fairness.eligibleCount != null
        ? data.fairness.eligibleCount + " eligible"
        : null,
      data.fairness.hardRuleCount
        ? data.fairness.hardRuleCount + " required rules"
        : null
    ].filter(Boolean);

    if (labels.length) {
      shell.append(node("footer", {
        class: "audience-fairness"
      }, labels.map((label) =>
        node("span", { text: String(label) })
      )));
    }
  }

  return shell;
}

async function startTemplateSession(template) {
  const session = createTemplateSession(template);
  await put("templateSessions", session);
  replaceTemplateSession(session);
  openTemplateSession(session.id);
}

function openTemplateSession(sessionId) {
  const session = templateSessionById(sessionId);
  if (!session) return;

  if (state.toolId) finishPresentation(state.toolId, null, false);
  state.activeTemplateSessionId = session.id;
  state.view = "template-session";
  state.toolId = null;
  state.modal = null;
  history.replaceState(
    {},
    "",
    location.pathname + "?templateSession=" + encodeURIComponent(session.id)
  );
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function openTemplateStep(session, stepIndex) {
  const template = sessionTemplateById(session.templateId);
  const definition = template?.steps?.[stepIndex];
  const runtimeStep = session?.steps?.[stepIndex];

  if (!template || !definition || !runtimeStep) {
    announce("This Session step is unavailable.");
    return;
  }

  if (runtimeStep.locked && runtimeStep.status === "complete") {
    const run = runById(runtimeStep.runId);
    if (run) replayStoredRun(run);
    return;
  }

  const tool = getTool(definition.toolId);
  if (!tool) {
    announce("This Session step uses a tool that is no longer available.");
    return;
  }

  const preset = definition.presetId
    ? presetById(definition.presetId)
    : null;

  if (preset) {
    await applyPresetToTool(preset, {
      open: false,
      preserveTemplateContext: true
    });
  } else {
    if (ensureToolState(tool.id).activeSessionId && isStatefulTool(tool.id)) {
      await endActiveSession(tool.id, "abandoned", true);
    }
    state.tool[tool.id] = null;
    ensureToolState(tool.id);
  }

  const ts = ensureToolState(tool.id);

  if (definition.input.kind === "previous") {
    const items = previousStepItems(session, template, stepIndex);
    ts.listText = items.join("\n");
    ts.workingSet = null;
    ts.workingSetDirty = false;
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
  } else if (definition.input.kind === "frozen") {
    ts.listText = (definition.input.items || []).join("\n");
    ts.workingSet = null;
    ts.workingSetDirty = false;
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
  } else if (definition.input.kind === "prompt") {
    ts.listText = "";
    ts.workingSet = null;
    ts.workingSetDirty = false;
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
  }

  ts.templateSessionId = session.id;
  ts.templateStepIndex = stepIndex;
  ts.templateStepId = definition.id;
  ts.result = null;
  ts.replayRunId = null;

  state.activeTemplateSessionId = session.id;
  state.view = "tool";
  state.toolId = tool.id;
  state.modal = null;
  history.replaceState(
    {},
    "",
    location.pathname + "?tool=" + encodeURIComponent(tool.id)
  );
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function toggleTemplateStepLock(session, stepIndex) {
  try {
    const next = setTemplateStepLocked(
      session,
      stepIndex,
      !session.steps[stepIndex].locked
    );
    await putWithRevision(
      "templateSessions",
      next,
      session.revision
    );
    replaceTemplateSession(next);
    render();
  } catch (error) {
    announce(error?.message || "Could not change step lock.");
  }
}

async function rerunTemplateSessionFrom(session, stepIndex) {
  try {
    const next = rerunTemplateFrom(session, stepIndex);
    await putWithRevision(
      "templateSessions",
      next,
      session.revision
    );
    replaceTemplateSession(next);
    await openTemplateStep(next, stepIndex);
  } catch (error) {
    announce(error?.message || "Could not rerun from this step.");
  }
}

async function abandonCurrentTemplateSession(session) {
  try {
    const next = abandonTemplateSession(session);
    await putWithRevision(
      "templateSessions",
      next,
      session.revision
    );
    replaceTemplateSession(next);
    state.activeTemplateSessionId = null;
    setView("play");
  } catch (error) {
    announce(error?.message || "Could not end Session.");
  }
}

function renderTemplateSession() {
  const session = templateSessionById(state.activeTemplateSessionId);
  const template = session ? sessionTemplateById(session.templateId) : null;

  if (!session || !template) {
    return node("main", { class: "content" }, [
      node("h1", { class: "view-title", text: "Session unavailable" }),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => setView("play")
      }, "Back to Play")
    ]);
  }

  const content = node("main", { class: "content template-session-view" }, [
    node("div", { class: "template-session-heading" }, [
      node("button", {
        class: "icon-button",
        type: "button",
        "aria-label": "Back to Play",
        onClick: () => setView("play")
      }, "←"),
      node("div", {}, [
        node("div", { class: "kicker", text: "Session Template" }),
        node("h1", { class: "view-title", text: template.name }),
        node("p", {
          class: "view-subtitle",
          text:
            session.status === "completed"
              ? "Completed · rerun any unlocked step to branch from there."
              : (session.currentIndex + 1)
                + " of "
                + session.steps.length
                + " steps"
        })
      ])
    ])
  ]);

  const progress = session.steps.length
    ? Math.round(
        session.steps.filter((step) => step.status === "complete").length
        / session.steps.length
        * 100
      )
    : 0;

  content.append(node("div", { class: "template-progress" }, [
    node("span", {
      style: { width: progress + "%" }
    }),
    node("strong", { text: progress + "%" })
  ]));

  const list = node("div", { class: "template-step-list" });

  template.steps.forEach((definition, index) => {
    const step = session.steps[index];
    const tool = getTool(definition.toolId);
    const complete = step.status === "complete";
    const current = session.status === "active" && session.currentIndex === index;
    const sourceLabel = definition.input.kind === "previous"
      ? "Previous result"
      : definition.presetId
        ? "Preset"
        : definition.input.kind === "prompt"
          ? "Prompt input"
          : definition.input.kind;

    list.append(node("article", {
      class:
        "template-step-card"
        + (complete ? " is-complete" : "")
        + (current ? " is-current" : "")
        + (step.locked ? " is-locked" : "")
    }, [
      node("div", {
        class: "template-step-number",
        text: complete ? "✓" : String(index + 1)
      }),
      node("div", { class: "template-step-copy" }, [
        node("strong", { text: definition.name }),
        node("span", {
          text:
            (tool?.name || definition.toolId)
            + " · "
            + sourceLabel
        }),
        complete && step.resultItems.length
          ? node("small", {
              text:
                step.resultItems.slice(0, 4).join(", ")
                + (step.resultItems.length > 4 ? "…" : "")
            })
          : null
      ]),
      node("div", { class: "template-step-actions" }, [
        complete
          ? node("button", {
              class: "small-action",
              type: "button",
              onClick: () => toggleTemplateStepLock(session, index)
            }, step.locked ? "Unlock" : "Lock")
          : null,
        complete && !step.locked
          ? node("button", {
              class: "small-action",
              type: "button",
              onClick: () => rerunTemplateSessionFrom(session, index)
            }, "Rerun from here")
          : null,
        (!complete || current)
          ? node("button", {
              class: current ? "primary" : "secondary",
              type: "button",
              disabled:
                session.status === "abandoned"
                || index > session.currentIndex
                  ? "disabled"
                  : null,
              onClick: () => openTemplateStep(session, index)
            }, current ? "Run step" : "Open")
          : null
      ])
    ]));
  });

  content.append(list);

  if (session.status === "active") {
    content.append(node("div", { class: "template-session-footer" }, [
      node("button", {
        class: "danger",
        type: "button",
        onClick: () => abandonCurrentTemplateSession(session)
      }, "End Session")
    ]));
  } else if (session.status === "completed") {
    content.append(node("div", { class: "template-session-footer" }, [
      node("strong", { text: "Session complete" }),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => setView("play")
      }, "Back to Play")
    ]));
  }

  return content;
}

function setView(view) {
  if (state.toolId) finishPresentation(state.toolId, null, false);
  state.view = view;
  state.toolId = null;
  state.modal = null;
  history.replaceState({}, "", location.pathname);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTool(id) {
  if (state.toolId && state.toolId !== id) {
    finishPresentation(state.toolId, null, false);
  }
  const tool = getTool(id);
  if (!tool) return;
  state.view = "tool";
  state.toolId = id;
  state.modal = null;
  ensureToolState(id);
  maybeResumeLatestSession(id);
  history.replaceState({}, "", location.pathname + "?tool=" + encodeURIComponent(id));
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeTool() {
  setView("play");
}

async function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((value) => value !== id);
    await remove("favorites", id);
  } else {
    state.favorites.push(id);
    await put("favorites", { id, createdAt: Date.now() });
  }
  render();
}

function toolCard(tool) {
  return node("button", {
    class: "tool-card accent-" + tool.accent,
    type: "button",
    onClick: () => openTool(tool.id)
  }, [
    node("span", { class: "tool-icon", text: tool.icon, "aria-hidden": "true" }),
    node("strong", { text: tool.name }),
    node("small", { text: tool.blurb })
  ]);
}

async function togglePresetFavorite(preset) {
  const next = updatePreset(preset, { favorite: !preset.favorite });
  await putWithRevision("presets", next, preset.revision);
  state.presets = state.presets
    .map((item) => item.id === next.id ? next : item)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  render();
}

async function deletePreset(preset) {
  const references = state.sessionTemplates.filter((template) =>
    template.steps.some((step) => step.presetId === preset.id)
  );

  if (references.length) {
    announce(
      "This Preset is used by "
      + references.length
      + " Session Template"
      + (references.length === 1 ? "." : "s.")
    );
    return false;
  }

  await remove("presets", preset.id);
  state.presets = state.presets.filter((item) => item.id !== preset.id);
  render();
  return true;
}

function presetCard(preset) {
  const tool = getTool(preset.toolId);
  const binding = preset.inputBinding?.mode || "none";
  const bindingLabel = ({
    "live-pool": "Live Pool",
    "live-view": "Live View",
    frozen: "Frozen input",
    prompt: "Prompt input",
    none: "Tool config"
  })[binding] || binding;

  return node("article", {
    class: "saved-setup-card accent-" + (tool?.accent || "cyan")
  }, [
    node("div", {
      class: "saved-setup-icon",
      text: tool?.icon || "✦"
    }),
    node("div", { class: "saved-setup-copy" }, [
      node("div", { class: "saved-setup-title-row" }, [
        node("strong", { text: preset.name }),
        preset.favorite
          ? node("span", {
              class: "saved-favorite-badge",
              text: "★"
            })
          : null
      ]),
      node("span", {
        text: (tool?.name || preset.toolId) + " · " + bindingLabel
      })
    ]),
    node("div", { class: "saved-setup-actions" }, [
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => applyPresetToTool(preset)
      }, "Play"),
      node("button", {
        class: "small-action",
        type: "button",
        "aria-label": preset.favorite
          ? "Remove Preset favorite"
          : "Favorite Preset",
        onClick: () => togglePresetFavorite(preset)
      }, preset.favorite ? "★" : "☆"),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => {
          state.modal = {
            type: "preset-detail",
            presetId: preset.id
          };
          render();
        }
      }, "Manage")
    ])
  ]);
}

function templateCard(template) {
  const relatedSessions = state.templateSessions
    .filter((session) => session.templateId === template.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const active = relatedSessions.find(
    (session) => session.status === "active"
  ) || null;
  const latest = relatedSessions[0] || null;

  return node("article", {
    class: "session-template-card"
  }, [
    node("div", {
      class: "session-template-icon",
      text: "◆",
      "aria-hidden": "true"
    }),
    node("div", { class: "session-template-copy" }, [
      node("strong", { text: template.name }),
      node("span", {
        text:
          template.steps.length
          + " steps"
          + (template.builtinKey ? " · Built-in" : "")
      }),
      template.description
        ? node("small", { text: template.description })
        : null
    ]),
    node("div", { class: "saved-setup-actions" }, [
      node("button", {
        class: active ? "secondary" : "small-action",
        type: "button",
        onClick: () => {
          if (active) openTemplateSession(active.id);
          else startTemplateSession(template);
        }
      }, active ? "Resume" : "Start"),
      !active && latest
        ? node("button", {
            class: "small-action",
            type: "button",
            onClick: () => openTemplateSession(latest.id)
          }, "Open Last")
        : null,
      !template.builtinKey
        ? node("button", {
            class: "small-action",
            type: "button",
            onClick: async () => {
              const sessions = state.templateSessions.filter(
                (session) => session.templateId === template.id
              );
              if (sessions.length) {
                announce(
                  "This Template has saved Session history and cannot be deleted yet."
                );
                return;
              }
              await remove("sessionTemplates", template.id);
              state.sessionTemplates = state.sessionTemplates.filter(
                (item) => item.id !== template.id
              );
              render();
            }
          }, "Remove")
        : null
    ])
  ]);
}

function topBar() {
  const seeded = state.settings.randomness.mode === "seeded";
  return node("header", { class: "topbar" }, [
    node("div", { class: "brand" }, [
      node("div", {
        class: "brand-icon",
        text: "✦",
        "aria-hidden": "true"
      }),
      node("div", { class: "brand-copy" }, [
        node("strong", { text: "Randomizer" }),
        node("span", { text: "Arcade" })
      ])
    ]),
    node("div", { class: "top-actions" }, [
      node("button", {
        class: "pill-button",
        type: "button",
        onClick: () => {
          state.modal = "settings";
          render();
        }
      }, [
        node("span", { class: "rng-dot", "aria-hidden": "true" }),
        node("span", { text: seeded ? "Seeded" : "Secure" })
      ]),
      iconButton("Open Arcade", "◫", () => setView("arcade"))
    ])
  ]);
}

function bottomNav() {
  const items = [
    ["play", "▶", "Play"],
    ["arcade", "◫", "Arcade"],
    ["studio", "◆", "Studio"],
    ["pools", "◎", "Pools"],
    ["history", "↶", "History"]
  ];

  return node("nav", {
    class: "bottom-nav",
    "aria-label": "Primary navigation"
  }, items.map(([id, glyph, label]) => node("button", {
    class: "nav-button " + (state.view === id ? "active" : ""),
    type: "button",
    "aria-current": state.view === id ? "page" : null,
    onClick: () => setView(id)
  }, [
    node("span", { text: glyph, "aria-hidden": "true" }),
    label
  ])));
}

function sectionHeader(title, note = "") {
  return node("div", { class: "section-head section" }, [
    node("h2", { text: title }),
    node("p", { text: note })
  ]);
}

function emptyState(title, copy, actionLabel, action) {
  const box = node("div", { class: "empty" }, [
    node("strong", { text: title }),
    node("span", { text: copy })
  ]);

  if (actionLabel && action) {
    box.append(node("div", {
      style: { marginTop: "16px" }
    }, node("button", {
      class: "secondary",
      type: "button",
      onClick: action
    }, actionLabel)));
  }

  return box;
}

function quickButton(glyph, label, id) {
  return node("button", {
    class: "quick-button",
    type: "button",
    onClick: () => openTool(id)
  }, [
    node("span", { text: glyph, "aria-hidden": "true" }),
    label
  ]);
}

function renderPlay() {
  const content = node("main", { class: "content" });

  const hero = node("section", { class: "hero" }, [
    node("div", { class: "kicker", text: "Arcade of randomness" }),
    node("h1", { text: "Pick. Roll. Shuffle. Decide." }),
    node("p", {
      text: "One vibrant toolbox for quick chance, people, games, generators, and everyday decisions."
    })
  ]);

  const searchWrap = node("label", { class: "search-box" }, [
    node("span", { text: "⌕", "aria-hidden": "true" }),
    node("span", { class: "sr-only", text: "Search randomizers" })
  ]);

  const search = node("input", {
    type: "search",
    value: state.search,
    placeholder: "Try “teams”, “d20”, “dinner”, “lottery”…",
    onInput: (event) => {
      state.search = event.target.value;
      render();
      const next = document.querySelector(".search-box input");
      if (next) {
        next.focus();
        next.setSelectionRange(state.search.length, state.search.length);
      }
    }
  });

  searchWrap.append(search);
  hero.append(searchWrap);

  if (!state.search.trim()) {
    hero.append(node("div", { class: "quick-grid" }, [
      quickButton("◐", "Coin", "coin"),
      quickButton("⬡", "Dice", "dice"),
      quickButton("◉", "Wheel", "wheel"),
      quickButton("#", "Number", "number")
    ]));
  }

  content.append(hero);

  if (state.search.trim()) {
    const results = searchTools(state.search);
    content.append(sectionHeader("Search results", results.length + " found"));
    content.append(
      results.length
        ? node("div", { class: "tool-grid" }, results.map(toolCard))
        : emptyState("No randomizer found", "Try a broader word or browse the Arcade.")
    );
    return content;
  }

  const favorites = TOOLS.filter((tool) => state.favorites.includes(tool.id));
  if (favorites.length) {
    content.append(sectionHeader("Favorites", "Your shortcuts"));
    content.append(node("div", { class: "tool-grid" }, favorites.map(toolCard)));
  }

  const popular = [
    "coin", "dice", "wheel", "picker",
    "teams", "elimination", "cards", "tournament"
  ].map(getTool).filter(Boolean);

  const favoritePresets = state.presets.filter((preset) => preset.favorite);
  const regularPresets = state.presets.filter((preset) => !preset.favorite);

  if (state.presets.length) {
    content.append(sectionHeader(
      "Saved setups",
      favoritePresets.length
        ? favoritePresets.length + " favorite · " + state.presets.length + " total"
        : state.presets.length + " Presets"
    ));
    content.append(node("div", { class: "saved-setup-grid" }, [
      ...favoritePresets.map(presetCard),
      ...regularPresets.map(presetCard)
    ]));
  }

  const templates = allSessionTemplates();
  content.append(node("div", { class: "section-head section template-section-head" }, [
    node("div", {}, [
      node("h2", { text: "Session Templates" }),
      node("p", { text: "Linear reusable multi-step randomizer sessions." })
    ]),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        state.modal = {
          type: "new-session-template",
          name: "",
          description: "",
          steps: [
            { presetId: state.presets[0]?.id || "", inputKind: "preset" },
            { presetId: state.presets[1]?.id || state.presets[0]?.id || "", inputKind: "previous" }
          ],
          error: null
        };
        render();
      }
    }, "+ New Template")
  ]));
  content.append(node("div", { class: "session-template-grid" },
    templates.map(templateCard)
  ));

  content.append(sectionHeader("Ready to play", "Fast, useful, no setup"));
  content.append(node("div", { class: "tool-grid" }, popular.map(toolCard)));
  return content;
}

function renderArcade() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Arcade" }),
    node("p", {
      class: "view-subtitle",
      text: TOOLS.length + " randomizers, organized by what you are trying to do."
    })
  ]);

  for (const category of CATEGORIES) {
    const tools = TOOLS.filter((tool) => tool.category === category.id);
    if (!tools.length) continue;
    content.append(sectionHeader(category.icon + "  " + category.name, tools.length + " tools"));
    content.append(node("div", { class: "tool-grid" }, tools.map(toolCard)));
  }

  return content;
}

function poolById(id) {
  return state.pools.find((pool) => pool.id === id) || null;
}

function poolViewsFor(poolId) {
  return state.poolViews.filter((view) => String(view.poolId) === String(poolId));
}

function openPoolEditor(poolId) {
  const pool = poolById(poolId);
  if (!pool) return;
  state.modal = {
    type: "pool-editor",
    poolId,
    baseRevision: pool.revision,
    draft: normalizePool(pool),
    search: "",
    active: "all",
    tagFilter: "",
    selected: new Set(),
    viewName: ""
  };
  render();
}

function openPoolImport(poolId = null) {
  state.modal = {
    type: "pool-import",
    poolId,
    text: "",
    mode: poolId ? "append" : "new",
    poolName: poolId ? "" : "Imported Pool",
    hasHeader: "auto",
    preview: null,
    error: null
  };
  render();
}

async function persistPoolDraft(editor) {
  const current = poolById(editor.poolId);
  if (!current) throw new Error("Pool no longer exists.");

  const draft = normalizePool(editor.draft);
  const next = mutatePool(current, (target) => {
    target.name = draft.name;
    target.description = draft.description;
    target.kind = draft.kind;
    target.icon = draft.icon;
    target.accent = draft.accent;
    target.archived = draft.archived;
    target.fields = draft.fields;
    target.items = draft.items;
    target.weightProfiles = draft.weightProfiles;
  });

  await putWithRevision("pools", next, editor.baseRevision);
  state.pools = state.pools
    .map((pool) => pool.id === next.id ? next : pool)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  editor.baseRevision = next.revision;
  editor.draft = normalizePool(next);
  return next;
}

async function setPoolArchived(pool, archived) {
  const next = mutatePool(pool, (draft) => {
    draft.archived = archived;
  });
  await putWithRevision("pools", next, pool.revision);
  state.pools = state.pools.map((item) => item.id === next.id ? next : item);
  render();
}

function applyWorkingSetToTool(toolId, ts, workingSet) {
  ts.workingSet = workingSet;
  ts.listText = workingSetLabels(workingSet).join("\n");
  invalidateTool(toolId, ts);

  if (selectionTools.has(toolId)) {
    reconcileToolSelection(toolId, ts);
    ts.selectionEntries = ts.selectionEntries.map((entry, index) => ({
      ...entry,
      weight: workingSet.items[index]?.weight ?? 1,
      excluded: false
    }));
  }
}

function workingSetFromView(pool, view) {
  const items = resolvePoolView(pool, view);
  return createWorkingSet(pool, { itemIds: items.map((item) => item.id) });
}

function renderPools() {
  const activePools = state.pools.filter((pool) => {
    if (!state.poolShowArchived && pool.archived) return false;
    if (state.poolShowArchived && !pool.archived) return false;
    const query = state.poolSearch.trim().toLocaleLowerCase();
    if (!query) return true;
    const haystack = [
      pool.name,
      pool.description,
      pool.kind,
      ...pool.items.flatMap((item) => [item.label, ...item.tags])
    ].join(" ").toLocaleLowerCase();
    return haystack.includes(query);
  });

  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Pools" }),
    node("p", {
      class: "view-subtitle",
      text: "Reusable source data with active items, tags, fields, weights, Views, and revision-safe editing."
    }),
    node("div", { class: "button-row" }, [
      node("button", {
        class: "primary",
        type: "button",
        onClick: () => {
          state.modal = "pool";
          render();
        }
      }, "+ New Pool"),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => openPoolImport()
      }, "Import CSV")
    ])
  ]);

  const search = node("input", {
    class: "field pool-library-search",
    type: "search",
    placeholder: state.poolShowArchived ? "Search archived Pools…" : "Search Pools…",
    value: state.poolSearch,
    "aria-label": "Search Pools"
  });
  search.addEventListener("input", () => {
    state.poolSearch = search.value;
  });
  search.addEventListener("change", render);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") render();
  });

  const archivedToggle = node("button", {
    class: "secondary",
    type: "button",
    onClick: () => {
      state.poolShowArchived = !state.poolShowArchived;
      state.poolSearch = "";
      render();
    }
  }, state.poolShowArchived ? "← Active Pools" : "Archived");

  content.append(node("div", { class: "pool-library-toolbar" }, [
    search,
    archivedToggle
  ]));

  content.append(sectionHeader(
    state.poolShowArchived ? "Archived Pools" : "Saved Pools",
    activePools.length + " shown"
  ));

  if (!activePools.length) {
    content.append(emptyState(
      state.poolShowArchived ? "No archived Pools" : "No Pools found",
      state.poolShowArchived
        ? "Archived Pools will appear here."
        : "Create a Pool, import CSV/spreadsheet data, or clear the current search.",
      !state.poolShowArchived && !state.poolSearch ? "Create Pool" : null,
      !state.poolShowArchived && !state.poolSearch
        ? () => {
            state.modal = "pool";
            render();
          }
        : null
    ));
    return content;
  }

  const list = node("div", { class: "pool-list pool-list-v2" });

  for (const pool of activePools) {
    const stats = poolStats(pool);
    const views = poolViewsFor(pool.id);

    const badges = node("div", { class: "pool-badges" }, [
      node("span", { text: stats.active + "/" + stats.total + " active" }),
      stats.tags ? node("span", { text: stats.tags + " tags" }) : null,
      stats.fields ? node("span", { text: stats.fields + " fields" }) : null,
      views.length ? node("span", { text: views.length + " views" }) : null,
      stats.duplicates ? node("span", { class: "warning", text: stats.duplicates + " duplicate groups" }) : null
    ]);

    list.append(node("article", {
      class: "pool-item pool-card-v2" + (pool.archived ? " is-archived" : "")
    }, [
      node("div", { class: "pool-icon", text: pool.icon || "◎" }),
      node("div", { class: "pool-copy" }, [
        node("strong", { text: pool.name }),
        node("span", {
          text: (pool.description || pool.kind) + " · revision " + pool.revision
        }),
        badges
      ]),
      node("div", { class: "pool-card-actions" }, [
        !pool.archived ? node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            state.modal = { type: "use-pool", poolId: pool.id };
            render();
          }
        }, "Use") : null,
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => openPoolEditor(pool.id)
        }, "Edit"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => setPoolArchived(pool, !pool.archived)
        }, pool.archived ? "Restore" : "Archive")
      ])
    ]));
  }

  content.append(list);
  return content;
}
function historyGroupPinKey(group) {
  if (group.kind === "session") return "session:" + group.sessionId;
  if (group.setupFingerprint) {
    return "burst:" + group.toolId + ":" + group.setupFingerprint;
  }
  return "run:" + group.runs[0].id;
}

async function clearStandaloneHistory() {
  const standalone = state.runs.filter((run) => !run.sessionId);
  await Promise.all(standalone.map((run) => remove("runs", run.id)));
  await clear("history");

  for (const key of [...state.historyPins]) {
    if (key.startsWith("burst:") || key.startsWith("run:")) {
      await remove("historyPins", key);
      state.historyPins.delete(key);
    }
  }

  state.runs = state.runs.filter((run) => run.sessionId);
  state.history = [];
  render();
}

function renderHistory() {
  const sessionsById = new Map(
    state.sessions.map((session) => [session.id, session])
  );
  const legacyRuns = state.history.map(legacyHistoryToRun);
  let groups = groupHistoryRuns(
    [...state.runs, ...legacyRuns],
    sessionsById
  );

  groups = groups.filter((group) => {
    const pinKey = historyGroupPinKey(group);
    if (state.historyFilter === "pinned") {
      return state.historyPins.has(pinKey);
    }
    if (state.historyFilter === "sessions") {
      return group.kind === "session";
    }
    return true;
  });

  groups.sort((a, b) => {
    const aPin = state.historyPins.has(historyGroupPinKey(a)) ? 1 : 0;
    const bPin = state.historyPins.has(historyGroupPinKey(b)) ? 1 : 0;
    return bPin - aPin || b.timestamp - a.timestamp;
  });

  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "History" }),
    node("p", {
      class: "view-subtitle",
      text: "Immutable Runs, resumable Sessions, exact Replay, and new-result Rerun."
    })
  ]);

  const tabs = node("div", {
    class: "segmented history-tabs",
    "aria-label": "History filter"
  }, [
    ["all", "All"],
    ["sessions", "Sessions"],
    ["pinned", "Pinned"]
  ].map(([value, label]) =>
    node("button", {
      class: state.historyFilter === value ? "active" : "",
      type: "button",
      onClick: () => {
        state.historyFilter = value;
        render();
      }
    }, label)
  ));

  content.append(node("div", { class: "history-toolbar" }, [
    tabs,
    (state.history.length || state.runs.some((run) => !run.sessionId))
      ? node("button", {
          class: "secondary",
          type: "button",
          onClick: async () => {
            if (!confirm(
              "Clear standalone History? Stateful Session Runs are kept because they are required for exact Undo/Redo and resume."
            )) return;
            await clearStandaloneHistory();
          }
        }, "Clear standalone")
      : null
  ]));

  if (!groups.length) {
    content.append(emptyState(
      "Nothing here yet",
      state.historyFilter === "all"
        ? "Run a randomizer and its immutable Run will appear here."
        : "No History groups match this filter."
    ));
    return content;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const list = node("div", { class: "history-group-list" });

  for (const group of groups) {
    const pinKey = historyGroupPinKey(group);
    const pinned = state.historyPins.has(pinKey);
    const latest = group.runs[0];
    const session = group.kind === "session"
      ? sessionsById.get(group.sessionId)
      : null;

    const actions = node("div", { class: "history-group-actions" }, [
      node("button", {
        class: "small-action" + (pinned ? " is-pinned" : ""),
        type: "button",
        onClick: () => toggleHistoryPin(pinKey)
      }, pinned ? "★" : "☆")
    ]);

    if (group.kind === "session" && session) {
      actions.append(node("button", {
        class: "secondary",
        type: "button",
        onClick: () => resumeStoredSession(session)
      }, session.status === "active" ? "Resume" : "Open"));
    } else if (latest.origin !== "legacy" && latest.afterState) {
      actions.append(
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => replayStoredRun(latest)
        }, "Replay"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => rerunStoredRun(latest)
        }, "Rerun")
      );
    }

    actions.append(node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        state.modal = { type: "run-detail", runId: latest.id };
        render();
      }
    }, "Details"));

    const summaries = node("div", { class: "history-run-preview" },
      group.runs.slice(0, 4).map((run) =>
        node("div", { class: "history-run-preview-row" }, [
          node("span", { text: run.summary || "Result" }),
          node("time", { text: formatter.format(new Date(run.timestamp)) })
        ])
      )
    );

    list.append(node("article", {
      class:
        "history-group-card"
        + (pinned ? " is-pinned" : "")
        + (group.kind === "session" ? " is-session" : "")
    }, [
      node("div", { class: "history-icon", text: group.icon || "✦" }),
      node("div", { class: "history-group-copy" }, [
        node("div", { class: "history-group-title-row" }, [
          node("strong", {
            text: group.kind === "session"
              ? group.title
              : group.toolName
          }),
          group.kind === "session"
            ? node("span", {
                class: "history-status history-status-" + (session?.status || "unknown"),
                text: session?.status || "session"
              })
            : null
        ]),
        node("span", {
          text:
            group.runs.length
            + (group.runs.length === 1 ? " Run" : " Runs")
            + " · "
            + formatter.format(new Date(group.timestamp))
        }),
        summaries
      ]),
      actions
    ]));
  }

  content.append(list);
  return content;
}
function studioNode(index, title, copy) {
  return node("div", { class: "studio-node" }, [
    node("strong", { text: index + ". " + title }),
    node("span", { text: copy })
  ]);
}

function renderStudio() {
  const content = node("main", { class: "content" }, [
    node("h1", { class: "view-title", text: "Decision Studio" }),
    node("p", {
      class: "view-subtitle",
      text: "A small working pipeline today: sample finalists, then make a final pick. The full graph Studio comes in a later implementation phase."
    })
  ]);

  const panel = node("div", { class: "controls" });
  const input = node("textarea", {
    class: "field",
    id: "studio-input",
    "aria-label": "Decision options"
  });
  input.value = state.tool.studioText
    || "Pizza\nSushi\nKorean\nBurgers\nIndian\nTacos";
  input.addEventListener("input", () => {
    state.tool.studioText = input.value;
  });

  const finalist = node("input", {
    class: "field",
    id: "studio-count",
    type: "number",
    min: "2",
    value: String(state.tool.studioCount || 3),
    "aria-label": "Number of finalists"
  });
  finalist.addEventListener("input", () => {
    state.tool.studioCount = Number(finalist.value);
  });

  panel.append(
    node("div", { class: "control" }, [
      node("label", { for: "studio-input", text: "Options" }),
      input
    ]),
    node("div", {
      class: "control",
      style: { marginTop: "10px" }
    }, [
      node("label", { for: "studio-count", text: "Finalists" }),
      finalist
    ]),
    node("button", {
      class: "primary action-button",
      type: "button",
      style: { marginTop: "12px" },
      onClick: runStudio
    }, "RUN DECISION")
  );

  const flow = node("div", { class: "studio-flow" }, [
    studioNode("1", "Input Pool", "Your options"),
    studioNode("2", "Sample Finalists", "Unique random sample"),
    studioNode("3", "Final Pick", "One winner from the finalists")
  ]);

  content.append(panel, flow);

  if (state.studioResult) {
    content.append(sectionHeader("Result", "Committed pipeline result"));
    content.append(node("div", {
      class: "tool-stage accent-purple"
    }, node("div", { class: "stage-content" }, [
      node("div", { class: "stage-label", text: "Finalists" }),
      resultList(state.studioResult.finalists),
      node("div", {
        class: "stage-label",
        style: { marginTop: "24px" },
        text: "Final decision"
      }),
      node("div", {
        class: "stage-result",
        text: state.studioResult.winner
      })
    ])));
  }

  return content;
}

async function runStudio() {
  const items = parseList(document.getElementById("studio-input").value);
  const count = Number(document.getElementById("studio-count").value);

  if (
    items.length < 2
    || !Number.isSafeInteger(count)
    || count < 2
    || count > items.length
  ) {
    announce("Decision Studio needs at least two options and a valid finalist count.");
    return;
  }

  const prepared = prepareRandomSource();
  const finalists = sample(items, count, prepared.source);
  const winner = pick(finalists, prepared.source);
  const beforeState = {
    studioText: state.tool.studioText || items.join("\n"),
    studioCount: state.tool.studioCount || count,
    studioResult: cloneData(state.studioResult)
  };
  const afterState = {
    ...beforeState,
    studioResult: { finalists, winner }
  };
  const inputSnapshot = { items };
  const configSnapshot = { finalistCount: count };
  const fingerprint = fingerprintSetup(
    "studio",
    inputSnapshot,
    configSnapshot
  );

  const run = createRun({
    toolId: "studio",
    toolName: "Decision Studio",
    icon: "◆",
    setupFingerprint: fingerprint,
    inputSnapshot,
    configSnapshot,
    beforeState,
    afterState,
    result: { finalists, winner },
    summary: winner,
    detail: { finalists },
    randomContext: prepared.context
  });

  try {
    await commitRunAndSession({
      run,
      settingsRecord: prepared.settingsRecord
    });

    if (prepared.nextSettings) state.settings = prepared.nextSettings;
    state.runs = [
      run,
      ...state.runs.filter((candidate) => candidate.id !== run.id)
    ].sort((a, b) => b.timestamp - a.timestamp);

    state.studioResult = { finalists, winner };
    announce("Decision result: " + winner);
    render();
  } catch {
    announce("Could not save the Decision Studio result.");
  }
}
function currentTool() {
  return getTool(state.toolId);
}

function renderTool() {
  const tool = currentTool();
  const toolState = ensureToolState(tool.id);
  const content = node("main", { class: "content" });
  const favorite = state.favorites.includes(tool.id);

  const head = node("div", {
    class: "tool-head accent-" + tool.accent
  }, [
    iconButton("Back", "←", closeTool),
    node("span", {
      class: "tool-symbol",
      text: tool.icon,
      "aria-hidden": "true"
    }),
    node("h1", { text: tool.name }),
    iconButton(
      favorite ? "Remove favorite" : "Add favorite",
      favorite ? "★" : "☆",
      () => toggleFavorite(tool.id),
      favorite ? "favorite-star" : ""
    ),
    iconButton("Randomness settings", "⚙", () => {
      state.modal = "settings";
      render();
    })
  ]);

  const ruleStrip = renderRuleStrip(tool, toolState);
  const stage = buildStage(tool, toolState);
  const controls = buildControls(tool, toolState);

  content.append(node("section", {
    class: "tool-screen accent-" + tool.accent
  }, [head, ruleStrip, stage, controls].filter(Boolean)));

  return content;
}

function resultList(items) {
  return node("div", { class: "result-list" }, items.map((item, index) =>
    node("div", {
      class: "result-row",
      style: {
        "--reveal-index": String(index),
        "--shuffle-x": index % 2 === 0 ? "-14px" : "14px"
      }
    }, [
      node("span", { class: "rank", text: String(index + 1) }),
      node("strong", { text: String(item) })
    ])
  ));
}

function teamsResult(groups, prefix = "Team") {
  return node("div", { class: "teams-grid" }, groups.map((group, index) =>
    node("div", {
      class: "team-card",
      style: { "--accent": palette[index % palette.length] }
    }, [
      node("strong", { text: prefix + " " + (index + 1) }),
      ...group.map((person) =>
        node("div", { class: "team-member", text: person })
      )
    ])
  ));
}

function tournamentResult(matches) {
  return node("div", { class: "bracket-list" }, matches.map((match, index) =>
    node("div", {
      class: "match-card",
      style: { "--reveal-index": String(index) }
    }, [
      node("span", { class: "match-number", text: "Match " + (index + 1) }),
      node("strong", { text: match.a || "TBD" }),
      node("span", {
        class: "match-vs",
        text: match.b ? "VS" : "BYE"
      }),
      match.b ? node("strong", { text: match.b }) : null
    ])
  ));
}

function ladderBoard(items, outcomes, ladder) {
  const board = node("div", {
    class: "ladder-board",
    style: { "--ladder-cols": String(items.length) }
  });

  board.append(node("div", { class: "ladder-label-row" },
    items.map((item) => node("span", { text: item }))
  ));

  const tracks = node("div", { class: "ladder-tracks" });
  for (let index = 0; index < items.length; index += 1) {
    tracks.append(node("span", {
      class: "ladder-track",
      style: {
        left: (index / (items.length - 1) * 100) + "%"
      }
    }));
  }

  const rungs = ladder?.rungs || [];
  const rungCount = Math.max(rungs.length, 1);

  rungs.forEach((rung, index) => {
    tracks.append(node("span", {
      class: "ladder-rung",
      style: {
        "--reveal-index": String(index),
        top: ((index + 1) / (rungCount + 1) * 100) + "%",
        left: (rung.left / (items.length - 1) * 100) + "%",
        width: (100 / (items.length - 1)) + "%"
      }
    }));
  });

  const pathLayer = node("div", {
    class: "ladder-path-layer",
    "aria-hidden": "true"
  });

  for (let sourceIndex = 0; sourceIndex < items.length; sourceIndex += 1) {
    let column = sourceIndex;
    let previousY = 0;
    let pathStep = 0;
    const color = palette[sourceIndex % palette.length];

    rungs.forEach((rung, rungIndex) => {
      const y = (rungIndex + 1) / (rungCount + 1) * 100;
      const x = column / (items.length - 1) * 100;

      pathLayer.append(node("span", {
        class: "ladder-path-segment is-vertical",
        style: {
          "--path-step": String(pathStep++),
          "--path-color": color,
          left: x + "%",
          top: previousY + "%",
          height: (y - previousY) + "%"
        }
      }));

      if (rung.left === column || rung.left + 1 === column) {
        const nextColumn = rung.left === column
          ? column + 1
          : column - 1;
        const leftColumn = Math.min(column, nextColumn);

        pathLayer.append(node("span", {
          class: "ladder-path-segment is-horizontal",
          style: {
            "--path-step": String(pathStep++),
            "--path-color": color,
            left: (leftColumn / (items.length - 1) * 100) + "%",
            top: y + "%",
            width: (100 / (items.length - 1)) + "%"
          }
        }));

        column = nextColumn;
      }

      previousY = y;
    });

    const finalX = column / (items.length - 1) * 100;
    pathLayer.append(node("span", {
      class: "ladder-path-segment is-vertical",
      style: {
        "--path-step": String(pathStep),
        "--path-color": color,
        left: finalX + "%",
        top: previousY + "%",
        height: (100 - previousY) + "%"
      }
    }));
  }

  tracks.append(pathLayer);
  board.append(tracks);
  board.append(node("div", { class: "ladder-label-row ladder-outcomes" },
    outcomes.map((item) => node("span", { text: item }))
  ));

  return board;
}
function makeWheelGradient(model) {
  if (!model?.eligibleEntries?.length) return palette[0];
  const parts = [];
  let cursor = 0;

  model.eligibleEntries.forEach((entry, index) => {
    const start = cursor * 360;
    cursor += entry.probability;
    const end = cursor * 360;
    parts.push(
      palette[index % palette.length]
      + " "
      + start.toFixed(3)
      + "deg "
      + end.toFixed(3)
      + "deg"
    );
  });

  return "conic-gradient(" + parts.join(",") + ")";
}

function wheelSegmentForIndex(model, originalIndex) {
  if (!model?.eligibleEntries?.length) return null;
  let cursor = 0;
  for (const entry of model.eligibleEntries) {
    const start = cursor * 360;
    cursor += entry.probability;
    const end = cursor * 360;
    if (entry.index === originalIndex) {
      return { start, end, center: start + (end - start) / 2 };
    }
  }
  return null;
}

function wheelLabels(model) {
  if (!model?.eligibleEntries?.length || model.eligibleEntries.length > 12) return null;
  const layer = node("div", {
    class: "wheel-label-layer",
    "aria-hidden": "true"
  });
  const radius = 106;
  let cursor = 0;

  model.eligibleEntries.forEach((entry) => {
    const start = cursor * 360;
    cursor += entry.probability;
    const end = cursor * 360;
    const angle = start + (end - start) / 2;

    layer.append(node("span", {
      class: "wheel-label",
      style: {
        transform:
          "translate(-50%, -50%) rotate("
          + angle
          + "deg) translateY(-"
          + radius
          + "px) rotate(-"
          + angle
          + "deg)"
      },
      text: String(entry.label).length > 11
        ? String(entry.label).slice(0, 10) + "…"
        : String(entry.label)
    }));
  });

  return layer;
}

function readyLabel(id) {
  return ({
    picker: "PICK",
    number: "GENERATE",
    chance: "TRY",
    date: "PICK DATE",
    time: "PICK TIME",
    coordinate: "GENERATE",
    direction: "SPIN",
    letter: "DRAW",
    rps: "PLAY"
  })[id] || "READY";
}

function stageLabel(id) {
  return ({
    picker: "Selected",
    number: "Random number",
    chance: "Chance result",
    date: "Random date",
    time: "Random time",
    coordinate: "Coordinates",
    direction: "Direction",
    letter: "Random letter",
    rps: "Random play"
  })[id] || "Result";
}

function constraintItemsForTool(ts) {
  const labels = parseList(ts.listText);
  const workingItems = ts.workingSet?.items || [];
  const aligned = workingItems.length === labels.length;

  return labels.map((label, index) => ({
    id: aligned ? String(workingItems[index].id) : "item:" + index,
    label,
    tags: aligned && Array.isArray(workingItems[index].tags)
      ? [...workingItems[index].tags]
      : [],
    values: aligned && workingItems[index].values
      ? { ...workingItems[index].values }
      : {}
  }));
}

function balancedTargetModels(itemCount, count, prefix) {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  const base = Math.floor(itemCount / count);
  const remainder = itemCount % count;
  return Array.from({ length: count }, (_, index) => ({
    id: "target:" + index,
    label: prefix + " " + (index + 1),
    capacity: base + (index < remainder ? 1 : 0)
  }));
}

function constraintTargetsForTool(tool, ts, items) {
  if (tool.id === "teams") {
    return balancedTargetModels(items.length, Number(ts.teamCount), "Team");
  }

  if (tool.id === "groups") {
    return balancedTargetModels(items.length, Number(ts.groupCount), "Group");
  }

  if (tool.id === "pairs") {
    const count = Math.ceil(items.length / 2);
    return Array.from({ length: count }, (_, index) => ({
      id: "target:" + index,
      label: "Pair " + (index + 1),
      capacity: index === count - 1 && items.length % 2 === 1 ? 1 : 2
    }));
  }

  if (tool.id === "assignment") {
    const labels = parseList(ts.targetText);
    return balancedTargetModels(items.length, labels.length, "Target")
      .map((target, index) => ({
        ...target,
        label: labels[index] || target.label
      }));
  }

  if (tool.id === "secret-santa") {
    return items.map((item) => ({
      id: String(item.id),
      label: item.label,
      capacity: 1
    }));
  }

  if (tool.id === "tournament") {
    if (items.length < 2) return [];
    const bracketSize = 2 ** Math.ceil(Math.log2(items.length));
    const matchCount = bracketSize / 2;
    const byeCount = bracketSize - items.length;
    return Array.from({ length: matchCount }, (_, index) => ({
      id: "target:" + index,
      label: "Match " + (index + 1),
      capacity: index < byeCount ? 1 : 2
    }));
  }

  return [];
}

function constraintContext(tool, ts) {
  const items = constraintItemsForTool(ts);
  return {
    items,
    targets: constraintTargetsForTool(tool, ts, items),
    fields: Array.isArray(ts.workingSet?.fields)
      ? ts.workingSet.fields.map((field) => ({ ...field }))
      : []
  };
}

function historyPairsForTool(tool, ts) {
  const active = (ts.rules || []).filter(
    (rule) => rule.enabled !== false && rule.type === "historyAvoid"
  );
  if (!active.length) return new Set();

  const depth = Math.max(
    ...active.map((rule) => Number(rule.params?.depth) || 5)
  );

  const canonical = state.runs
    .filter((run) => run.toolId === tool.id)
    .map((run) => ({
      toolId: run.toolId,
      detail: run.detail,
      timestamp: run.timestamp
    }));

  const legacy = state.history
    .filter((entry) => entry.toolId === tool.id)
    .map((entry) => ({
      toolId: entry.toolId,
      detail: entry.detail,
      timestamp: entry.timestamp
    }));

  const relevant = [...canonical, ...legacy]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, depth);

  const output = new Set();
  const addGroupPairs = (group) => {
    const labels = (group || []).map((value) =>
      typeof value === "string"
        ? value
        : value?.label || value?.source || String(value || "")
    );
    for (let left = 0; left < labels.length; left += 1) {
      for (let right = left + 1; right < labels.length; right += 1) {
        output.add(historyPairKey(labels[left], labels[right]));
      }
    }
  };

  for (const entry of relevant) {
    if (Array.isArray(entry.detail?.groups)) {
      entry.detail.groups.forEach(addGroupPairs);
    }
    if (Array.isArray(entry.detail?.pairs)) {
      entry.detail.pairs.forEach(addGroupPairs);
    }
    if (Array.isArray(entry.detail?.matches)) {
      for (const match of entry.detail.matches) {
        if (match?.a && match?.b) {
          output.add(historyPairKey(match.a, match.b));
        }
      }
    }
  }

  return output;
}
function constraintValidation(tool, ts) {
  const context = constraintContext(tool, ts);
  return {
    context,
    validation: validateRules({
      toolId: tool.id,
      rules: ts.rules || [],
      items: context.items,
      targets: context.targets,
      fields: context.fields
    })
  };
}

function renderRuleStrip(tool, ts) {
  let rules = [];

  if (
    constraintTools.has(tool.id)
    && (ts.rules || []).some((rule) => rule.enabled !== false)
  ) {
    const activeRules = ts.rules.filter((rule) => rule.enabled !== false);
    const required = activeRules.filter(
      (rule) => rule.strength !== "soft"
    ).length;
    const preferred = activeRules.filter(
      (rule) => rule.strength === "soft"
    ).length;

    panel.querySelector(".fairness-body").append(
      node("div", { class: "fairness-method" }, [
        node("strong", { text: "Constrained randomization" }),
        node("p", {
          text:
            "The solver searches randomly among configurations satisfying required rules, then uses preferences to rank valid candidates. "
            + "It is not guaranteed to sample uniformly across every mathematically valid arrangement. "
            + required
            + " required and "
            + preferred
            + " preferred rules are active."
        }),
        ts.lastSolverDiagnostics
          ? node("div", { class: "solver-diagnostics" }, [
              node("span", {
                text: "Search nodes " + ts.lastSolverDiagnostics.nodes
              }),
              node("span", {
                text: "Valid candidates " + ts.lastSolverDiagnostics.solutions
              }),
              node("span", {
                text:
                  "Preference score "
                  + (
                    ts.lastConstraintScore == null
                      ? "—"
                      : Number(ts.lastConstraintScore).toFixed(2)
                  )
              })
            ])
          : null
      ])
    );
  } else if (selectionTools.has(tool.id)) {
    const model = currentSelectionModel(tool.id, ts);
    if (!model) return null;
    rules = selectionRuleSummary(model, {
      allowRepeats: ts.allowRepeats,
      multi: tool.id === "sampler"
    });
  } else if (tool.id === "dice" && ts.diceMode === "expression") {
    const expression = String(ts.diceExpression || "")
      .replace(/\s+/g, "")
      .toLowerCase();
    rules.push("Expression");
    if (/(kh|kl|dh|dl)\d+/.test(expression)) rules.push("Keep/drop");
    if (/r(?:<=|>=|!=|=|<|>)?\d+/.test(expression)) rules.push("Reroll");
    if (/!/.test(expression)) rules.push("Explode");
    if (expression === "2d20kh1") rules.unshift("Advantage");
    if (expression === "2d20kl1") rules.unshift("Disadvantage");
  } else if (tool.id === "number") {
    if (ts.numberMode === "decimal") {
      rules.push(ts.numberPrecision + " decimals");
    }
    if (ts.numberCount > 1) rules.push(ts.numberCount + " values");
    if (ts.numberUnique && ts.numberCount > 1) rules.push("Unique");
  } else if (constraintTools.has(tool.id)) {
    const active = (ts.rules || []).filter((rule) => rule.enabled !== false);
    const required = active.filter((rule) => rule.strength !== "soft").length;
    const preferred = active.filter((rule) => rule.strength === "soft").length;
    if (required) rules.push(required + " required");
    if (preferred) rules.push(preferred + " prefer");
    if (active.length) {
      const effort = ts.solverEffort || "automatic";
      rules.push(effort[0].toUpperCase() + effort.slice(1));
    }
  }

  if (!rules.length) return null;

  return node("div", {
    class: "tool-rule-strip",
    "aria-label": "Active rules"
  }, rules.map((rule) =>
    node("span", { class: "rule-chip", text: rule })
  ));
}
function dieTrace(die) {
  const parts = die.chain.map((part) => {
    if (part.attempts.length <= 1) return String(part.value);
    return part.attempts.join("→");
  });
  const text = parts.join(" + ");
  return die.chain.length > 1 ? text + " = " + die.total : text;
}

function diceExpressionBreakdown(result) {
  return node("div", {
    class: "dice-expression-groups",
    "aria-label": "Dice roll breakdown"
  }, result.diceGroups.map((group) =>
    node("section", { class: "dice-group-card" }, [
      node("div", { class: "dice-group-head" }, [
        node("strong", { text: group.notation }),
        node("span", { text: "Subtotal " + group.value })
      ]),
      node("div", { class: "dice-traces" },
        group.dice.map((die) =>
          node("span", {
            class: "dice-trace" + (die.kept ? "" : " is-dropped"),
            title: die.kept ? "Kept die" : "Dropped die",
            text: dieTrace(die)
          })
        )
      )
    ])
  ));
}

function diceModeControl(tool, ts) {
  return node("div", {
    class: "segmented dice-mode",
    "aria-label": "Dice mode"
  }, [
    node("button", {
      class: ts.diceMode === "quick" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.diceMode = "quick";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Quick"),
    node("button", {
      class: ts.diceMode === "expression" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.diceMode = "expression";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Expression")
  ]);
}

function dicePresetRow(tool, ts, presets) {
  return node("div", {
    class: "dice-presets",
    "aria-label": "Dice presets"
  }, presets.map((preset) =>
    node("button", {
      class: "dice-preset",
      type: "button",
      onClick: () => {
        if (preset.expression) {
          ts.diceMode = "expression";
          ts.diceExpression = preset.expression;
        } else {
          ts.diceMode = "quick";
          ts.diceCount = preset.count;
          ts.diceSides = preset.sides;
        }
        invalidateTool(tool.id, ts);
        render();
      }
    }, preset.label)
  ));
}

function diceExpressionEditor(tool, ts) {
  const wrap = node("div", { class: "dice-expression-editor" });
  const input = node("input", {
    class: "field dice-expression-input",
    type: "text",
    value: ts.diceExpression,
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": "Dice expression",
    placeholder: "e.g. 4d6kh3+2"
  });

  input.addEventListener("input", () => {
    ts.diceExpression = input.value;
    invalidateTool(tool.id, ts);
  });
  input.addEventListener("change", render);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      ts.diceExpression = input.value;
      runTool(tool.id);
    }
  });

  wrap.append(node("div", { class: "control" }, [
    node("label", { text: "Expression" }),
    input
  ]));

  const presets = [
    { label: "D20", expression: "1d20" },
    { label: "2D6", expression: "2d6" },
    { label: "D100", expression: "1d100" },
    { label: "Advantage", expression: "2d20kh1" },
    { label: "Disadvantage", expression: "2d20kl1" },
    { label: "4D6 keep 3", expression: "4d6kh3" },
    { label: "Exploding D6", expression: "1d6!" },
    { label: "Reroll 1s", expression: "4d6r=1" }
  ];
  wrap.append(dicePresetRow(tool, ts, presets));

  try {
    const description = describeDiceExpression(ts.diceExpression);
    wrap.append(node("div", { class: "dice-expression-preview" }, [
      node("strong", { text: description.canonical }),
      ...description.groups.map((group) =>
        node("span", { text: group })
      )
    ]));
  } catch (error) {
    wrap.append(node("div", {
      class: "dice-expression-preview is-invalid",
      text: error?.message || "Expression is incomplete."
    }));
  }

  wrap.append(node("button", {
    class: "dice-help-toggle",
    type: "button",
    "aria-expanded": String(Boolean(ts.diceHelpOpen)),
    onClick: () => {
      ts.diceHelpOpen = !ts.diceHelpOpen;
      render();
    }
  }, ts.diceHelpOpen ? "Hide notation help" : "Notation help"));

  if (ts.diceHelpOpen) {
    wrap.append(node("div", { class: "dice-help" }, [
      node("div", { text: "NdS — roll N dice with S sides" }),
      node("div", { text: "kh / kl — keep highest / lowest" }),
      node("div", { text: "dh / dl — drop highest / lowest" }),
      node("div", { text: "r<2, r=1 — reroll while condition matches" }),
      node("div", { text: "! — explode on the maximum face" }),
      node("div", { text: "!>=5 — explode on a custom condition" }),
      node("div", { text: "+ - * / and parentheses — arithmetic composition" })
    ]));
  }

  return wrap;
}

function diceHistoryPanel(ts) {
  if (!ts.diceHistory?.length) return null;

  return node("section", { class: "dice-history" }, [
    node("div", { class: "dice-history-head" }, [
      node("strong", { text: "Recent rolls" }),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => {
          ts.diceHistory = [];
          render();
        }
      }, "Clear")
    ]),
    ...ts.diceHistory.map((entry) =>
      node("div", { class: "dice-history-row" }, [
        node("span", { text: entry.label }),
        node("strong", { text: String(entry.total) })
      ])
    )
  ]);
}

function presentationStageClasses(tool, ts) {
  const p = ts.presentation;
  if (!p) return "";

  return [
    " is-presenting",
    " reveal-" + p.kind,
    " presentation-" + p.mode,
    " effects-" + p.effects,
    p.celebration ? " is-celebration" : "",
    p.reducedMotion ? " is-reduced-reveal" : ""
  ].join("");
}

function presentationStageStyle(ts) {
  const p = ts.presentation;
  if (!p) return {};
  return {
    "--present-duration": p.duration + "ms",
    "--reveal-stagger": p.staggerMs + "ms"
  };
}

function particleField(presentation) {
  if (!presentation || presentation.particles <= 0) return null;

  return node("div", {
    class: "fx-particles",
    "aria-hidden": "true"
  }, Array.from(
    { length: presentation.particles },
    (_, index) => {
      const angle = (index * 137.508) % 360;
      const distance = 52 + (index % 6) * 14;
      const delay = (index % 7) * 24;
      return node("span", {
        class: "fx-particle",
        style: {
          "--particle-angle": angle + "deg",
          "--particle-angle-neg": (-angle) + "deg",
          "--particle-distance": distance + "px",
          "--particle-delay": delay + "ms",
          "--particle-index": String(index)
        }
      });
    }
  ));
}

function buildStage(tool, ts) {
  const stage = node("div", {
    class:
      "tool-stage accent-"
      + tool.accent
      + presentationStageClasses(tool, ts),
    style: presentationStageStyle(ts)
  });
  const wrap = node("div", { class: "stage-content" });
  const result = ts.result;

  if (tool.id === "coin") {
    wrap.append(
      node("div", {
        class: "stage-orb " + (ts.animating ? "flipping" : ""),
        text: result ? (result === "Heads" ? "H" : "T") : "?"
      }),
      node("div", { class: "stage-label", text: "Coin Flip" }),
      node("div", { class: "stage-result", text: result || "READY" })
    );
  } else if (tool.id === "dice") {
    if (ts.diceMode === "expression") {
      wrap.append(
        node("div", {
          class: "stage-label",
          text: result ? result.expression : "Dice expression"
        }),
        node("div", {
          class: "stage-result",
          text: result ? String(result.total) : "ROLL"
        }),
        node("div", {
          class: "stage-sub dice-expression-source",
          text: result ? result.canonical : ts.diceExpression
        }),
        result?.diceGroups?.length
          ? diceExpressionBreakdown(result)
          : null
      );
    } else {
      const values = result?.values
        || Array.from({ length: ts.diceCount }, () => "•");
      wrap.append(
        node("div", {
          class: "dice-row " + (ts.animating ? "rolling" : "")
        }, values.map((value) =>
          node("div", { class: "die", text: String(value) })
        )),
        node("div", {
          class: "stage-label",
          text: result ? "Total" : "Dice ready"
        }),
        node("div", {
          class: "stage-result",
          text: result ? String(result.total) : "ROLL"
        }),
        result
          ? node("div", {
              class: "stage-sub",
              text: result.values.join(" + ") + " on D" + result.sides
            })
          : null
      );
    }
  } else if (tool.id === "number") {
    if (result?.displayValues?.length > 1) {
      wrap.append(
        node("div", { class: "stage-label", text: "Random numbers" }),
        node("div", {
          class: "stage-result",
          text: result.count + " VALUES",
          style: { fontSize: "clamp(36px,9vw,58px)" }
        }),
        resultList(result.displayValues)
      );
    } else {
      wrap.append(
        node("div", { class: "stage-label", text: "Random number" }),
        node("div", {
          class: "stage-result",
          text: result?.displayValues?.[0] || "GENERATE"
        }),
        node("div", {
          class: "stage-sub",
          text: ts.numberMode === "decimal"
            ? "Uniform " + ts.numberPrecision + "-decimal grid"
            : "Uniform integer"
        })
      );
    }
  } else if (tool.id === "wheel") {
    const model = currentSelectionModel("wheel", ts);
    const wheel = node("div", {
      class: "wheel",
      style: {
        background: makeWheelGradient(model),
        transform: "rotate(" + (ts.previousWheelRotation || 0) + "deg)",
        transitionDuration:
          (ts.presentation?.duration || 0) + "ms"
      }
    });
    const labels = wheelLabels(model);
    if (labels) wheel.append(labels);

    const wheelWrap = node("div", { class: "wheel-wrap" }, [
      wheel,
      node("div", { class: "wheel-pointer", "aria-hidden": "true" }),
      node("div", {
        class: "wheel-center-label",
        text: (model?.eligibleCount || 0) + " eligible"
      })
    ]);

    wrap.append(
      wheelWrap,
      node("div", { class: "stage-label", text: "Result" }),
      node("div", {
        class: "stage-result",
        text: result || "SPIN",
        style: {
          fontSize: result && String(result).length > 18 ? "42px" : ""
        }
      })
    );

    if (ts.pendingWheelRotation != null) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wheel.style.transform = "rotate(" + ts.pendingWheelRotation + "deg)";
      }));
    }
  } else if (tool.id === "cards") {
    const red = result?.card && /[♥♦]/.test(result.card);
    wrap.append(
      node("div", {
        class: "card-deck",
        text: "✦",
        "aria-hidden": "true"
      }),
      node("div", {
        class: "stage-label",
        text: result ? "Drawn card" : "52-card deck"
      }),
      node("div", {
        class: "stage-result play-card " + (red ? "red-card" : ""),
        text: result?.card || "DRAW"
      }),
      node("div", {
        class: "stage-sub",
        text: result
          ? result.remaining + " cards remain"
          : "The deck shuffles once, then draws without replacement."
      })
    );
  } else if (tool.id === "color") {
    const color = result || "#7C5CFF";
    wrap.append(
      node("div", {
        class: "color-swatch",
        style: { background: color }
      }),
      node("div", { class: "stage-label", text: "HEX Color" }),
      node("div", { class: "stage-result", text: color })
    );
  } else if (tool.id === "sampler" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Selected" }),
      resultList(result)
    );
  } else if (tool.id === "shuffle" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random order" }),
      resultList(result),
      node("div", {
        class: "stage-sub",
        text: result.length + " items"
      })
    );
  } else if (tool.id === "teams" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random teams" }),
      teamsResult(result, "Team")
    );
  } else if (tool.id === "groups" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random groups" }),
      teamsResult(result, "Group")
    );
  } else if (tool.id === "pairs" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Random pairs" }),
      resultList(result.map((pair) =>
        pair.length === 2 ? pair.join("  ↔  ") : pair[0] + "  —  unmatched"
      ))
    );
  } else if (tool.id === "assignment" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Assignments" }),
      resultList(result.map((item) => item.source + "  →  " + item.target))
    );
  } else if (tool.id === "ladder" && Array.isArray(result)) {
    const inputs = parseList(ts.listText);
    const outcomes = parseList(ts.ladderOutcomes);
    wrap.append(
      node("div", { class: "stage-label", text: "Ghost Ladder" }),
      ts.ladder ? ladderBoard(inputs, outcomes, ts.ladder) : null,
      resultList(result.map((item) => item.source + "  →  " + item.target))
    );
  } else if (tool.id === "tournament" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "First-round draw" }),
      tournamentResult(result)
    );
  } else if (tool.id === "elimination") {
    const remaining = ts.eliminationRemaining || parseList(ts.listText);
    wrap.append(
      node("div", {
        class: "stage-label",
        text: result?.winner ? "Winner" : "Elimination"
      }),
      node("div", {
        class: "stage-result",
        text: result?.winner || result?.eliminated || "READY",
        style: {
          fontSize:
            String(result?.winner || result?.eliminated || "READY").length > 18
              ? "42px"
              : ""
        }
      }),
      node("div", {
        class: "stage-sub",
        text: result?.winner
          ? "Last entrant standing"
          : result?.sub || remaining.length + " entrants ready"
      }),
      remaining.length <= 20 ? resultList(remaining) : null
    );
  } else if (tool.id === "secret-santa") {
    if (ts.secretAssignments && ts.secretReveal != null) {
      const assignment = ts.secretAssignments[ts.secretReveal];
      wrap.append(
        node("div", {
          class: "private-badge",
          text: "PRIVATE REVEAL"
        }),
        node("div", {
          class: "stage-label",
          text: assignment.source + " gives to"
        }),
        node("div", {
          class: "stage-result",
          text: assignment.target
        }),
        node("div", {
          class: "stage-sub",
          text: "Hide this before passing the device."
        })
      );
    } else {
      wrap.append(
        node("div", {
          class: "stage-label",
          text: "Private assignment"
        }),
        node("div", {
          class: "stage-result",
          text: ts.secretAssignments ? "READY" : "GENERATE",
          style: { fontSize: "clamp(42px,12vw,72px)" }
        }),
        node("div", {
          class: "stage-sub",
          text: ts.secretAssignments
            ? ts.secretAssignments.length + " private matches generated"
            : "Nobody can draw themselves."
        })
      );
    }
  } else if (tool.id === "lottery" && Array.isArray(result)) {
    wrap.append(
      node("div", { class: "stage-label", text: "Draw" }),
      node("div", {
        class: "stage-result",
        text: result.join(" · "),
        style: { fontSize: "clamp(34px,10vw,62px)" }
      })
    );
  } else {
    const text = result?.summary || result || readyLabel(tool.id);
    wrap.append(
      node("div", {
        class: "stage-label",
        text: stageLabel(tool.id)
      }),
      node("div", {
        class: "stage-result",
        text: String(text),
        style: {
          fontSize: String(text).length > 20 ? "42px" : ""
        }
      }),
      result?.sub
        ? node("div", { class: "stage-sub", text: result.sub })
        : null
    );
  }

  const particles = particleField(ts.presentation);
  if (particles) stage.append(particles);
  stage.append(wrap);
  return stage;
}

function toolError(message) {
  return node("div", {
    class: "tool-error",
    role: "alert"
  }, [
    node("strong", { text: "Could not randomize" }),
    node("span", { text: message })
  ]);
}

function textareaControl(label, value, onChange) {
  const textarea = node("textarea", {
    class: "field",
    "aria-label": label,
    placeholder: "One item per line"
  });
  textarea.value = value;
  textarea.addEventListener("input", () => onChange(textarea.value));
  return node("div", {
    class: "control",
    style: { marginBottom: "12px" }
  }, [
    node("label", { text: label }),
    textarea
  ]);
}

function numberControl(label, id, value, min, max, onChange) {
  const input = node("input", {
    class: "field",
    id,
    type: "number",
    min: String(min),
    max: String(max),
    value: String(value)
  });
  input.addEventListener("input", () => onChange(Number(input.value)));
  return node("div", { class: "control" }, [
    node("label", { for: id, text: label }),
    input
  ]);
}

function dateControl(label, value, onChange) {
  const input = node("input", {
    class: "field",
    type: "date",
    value
  });
  input.addEventListener("input", () => onChange(input.value));
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    input
  ]);
}

function timeControl(label, value, onChange) {
  const input = node("input", {
    class: "field",
    type: "time",
    value
  });
  input.addEventListener("input", () => onChange(input.value));
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    input
  ]);
}

function stepperControl(label, value, min, max, onChange) {
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    node("div", { class: "stepper" }, [
      node("button", {
        type: "button",
        "aria-label": "Decrease " + label,
        onClick: () => onChange(Math.max(min, value - 1))
      }, "−"),
      node("output", { text: String(value) }),
      node("button", {
        type: "button",
        "aria-label": "Increase " + label,
        onClick: () => onChange(Math.min(max, value + 1))
      }, "+")
    ])
  ]);
}

function selectControl(label, options, value, onChange) {
  const select = node("select", {
    class: "field",
    "aria-label": label
  }, options.map((option) =>
    node("option", {
      value: option,
      text: "D" + option
    })
  ));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    select
  ]);
}

function listControls(tool, ts) {
  const wrap = node("div");

  const sourceOptions = [
    node("option", { value: "", text: "Temporary list / current run" })
  ];

  for (const pool of state.pools.filter((item) => !item.archived)) {
    sourceOptions.push(node("option", {
      value: "pool:" + pool.id,
      text: pool.name + " · " + poolStats(pool).active + " active"
    }));

    for (const view of poolViewsFor(pool.id)) {
      sourceOptions.push(node("option", {
        value: "view:" + view.id,
        text: "↳ " + view.name + " · View"
      }));
    }
  }

  const poolSelect = node("select", {
    class: "field",
    "aria-label": "Input source"
  }, sourceOptions);

  if (ts.workingSet?.source?.viewId) {
    poolSelect.value = "view:" + ts.workingSet.source.viewId;
  } else if (ts.workingSet?.source?.poolId) {
    poolSelect.value = "pool:" + ts.workingSet.source.poolId;
  }

  poolSelect.addEventListener("change", () => {
    const value = poolSelect.value;

    if (!value) {
      ts.workingSet = null;
      ts.workingSetDirty = true;
      render();
      return;
    }

    if (value.startsWith("pool:")) {
      const pool = poolById(value.slice(5));
      if (!pool) return;
      applyWorkingSetToTool(tool.id, ts, createWorkingSet(pool));
      ts.workingSetDirty = false;
      render();
      return;
    }

    if (value.startsWith("view:")) {
      const view = state.poolViews.find((candidate) => candidate.id === value.slice(5));
      const pool = view ? poolById(view.poolId) : null;
      if (!pool || !view) return;
      const workingSet = workingSetFromView(pool, view);
      workingSet.source.viewId = view.id;
      workingSet.source.viewName = view.name;
      applyWorkingSetToTool(tool.id, ts, workingSet);
      ts.workingSetDirty = false;
      render();
    }
  });

  const textarea = node("textarea", {
    class: "field",
    "aria-label": tool.name + " entries",
    placeholder: "One option per line"
  });
  textarea.value = ts.listText;
  textarea.addEventListener("input", () => {
    ts.listText = textarea.value;
    ts.workingSetDirty = Boolean(ts.workingSet);
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
    invalidateTool(tool.id, ts);
  });
  textarea.addEventListener("change", render);

  const sourceControl = node("div", {
    class: "control",
    style: { marginBottom: "10px" }
  }, [
    node("label", { text: "Source" }),
    poolSelect
  ]);

  if (ts.workingSet?.source) {
    const source = ts.workingSet.source;
    const latestPool = poolById(source.poolId);
    const stale = latestPool && latestPool.revision !== source.revision;

    sourceControl.append(node("div", {
      class: "working-set-source" + (ts.workingSetDirty ? " is-dirty" : "")
    }, [
      node("div", { class: "working-set-copy" }, [
        node("strong", {
          text: source.viewName
            ? source.name + " / " + source.viewName
            : source.name
        }),
        node("span", {
          text:
            "Copied from revision " + source.revision
            + (ts.workingSetDirty ? " · edited for this run" : "")
            + (stale ? " · source updated" : "")
        })
      ]),
      node("div", { class: "working-set-actions" }, [
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => openPoolEditor(source.poolId)
        }, "Edit source"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            const pool = poolById(source.poolId);
            if (!pool) return;
            if (source.viewId) {
              const view = state.poolViews.find((item) => item.id === source.viewId);
              if (!view) return;
              const workingSet = workingSetFromView(pool, view);
              workingSet.source.viewId = view.id;
              workingSet.source.viewName = view.name;
              applyWorkingSetToTool(tool.id, ts, workingSet);
            } else {
              applyWorkingSetToTool(tool.id, ts, createWorkingSet(pool));
            }
            ts.workingSetDirty = false;
            render();
          }
        }, "Refresh"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            ts.workingSet = null;
            ts.workingSetDirty = true;
            render();
          }
        }, "Detach")
      ])
    ]));
  }

  const runControl = node("div", {
    class: "control",
    style: { marginBottom: "12px" }
  }, [
    node("div", { class: "control-label-row" }, [
      node("label", { text: "Entries — this run" }),
      node("button", {
        class: "text-action",
        type: "button",
        onClick: () => {
          state.modal = {
            type: "save-tool-pool",
            toolId: tool.id,
            name: "",
            kind: tool.id === "teams" || tool.id === "groups" || tool.id === "pairs"
              ? "people"
              : "choices"
          };
          render();
        }
      }, "Save as Pool")
    ]),
    textarea
  ]);

  wrap.append(sourceControl, runControl);
  return wrap;
}
function updateSelectionEntry(ts, key, patch) {
  const entry = (ts.selectionEntries || []).find((candidate) => candidate.key === key);
  if (!entry) return;
  Object.assign(entry, patch);
}

function selectionRulesControl(tool, ts) {
  reconcileToolSelection(tool.id, ts);

  let model;
  let modelError = null;
  try {
    model = normalizeSelection(parseList(ts.listText), ts.selectionEntries);
  } catch (error) {
    modelError = error?.message || "Selection rules are invalid.";
    model = {
      entries: ts.selectionEntries.map((entry, index) => ({
        ...entry,
        index,
        probability: 0,
        eligible: false
      })),
      customWeights: true,
      excludedCount: ts.selectionEntries.filter((entry) => entry.excluded).length,
      zeroWeightCount: 0
    };
  }

  const rules = modelError
    ? ["Invalid weights"]
    : selectionRuleSummary(model, {
        allowRepeats: ts.allowRepeats,
        multi: tool.id === "sampler"
      });

  const section = node("section", { class: "selection-rules" });
  section.append(node("button", {
    class: "selection-rules-toggle",
    type: "button",
    "aria-expanded": String(Boolean(ts.selectionOpen)),
    onClick: () => {
      ts.selectionOpen = !ts.selectionOpen;
      render();
    }
  }, [
    node("span", { text: "Selection rules" }),
    node("span", {
      class: "selection-rule-summary",
      text: rules.length ? rules.join(" • ") : "Equal chances"
    }),
    node("span", {
      class: "selection-chevron",
      text: ts.selectionOpen ? "−" : "+"
    })
  ]));

  if (!ts.selectionOpen) return section;

  if (modelError) {
    section.append(toolError(modelError));
  }

  const toolbar = node("div", { class: "selection-toolbar" }, [
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        ts.selectionEntries = ts.selectionEntries.map((entry) => ({
          ...entry,
          weight: 1
        }));
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Equalize"),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        ts.selectionEntries = ts.selectionEntries.map((entry) => ({
          ...entry,
          weight: 1,
          excluded: false
        }));
        ts.allowRepeats = false;
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Reset")
  ]);

  if (tool.id === "sampler") {
    const repeat = node("input", {
      type: "checkbox",
      checked: ts.allowRepeats,
      "aria-label": "Allow repeated winners"
    });
    repeat.addEventListener("change", () => {
      ts.allowRepeats = repeat.checked;
      invalidateTool(tool.id, ts);
      render();
    });
    toolbar.prepend(node("label", { class: "repeat-toggle" }, [
      repeat,
      node("span", { text: "Allow repeats" })
    ]));
  }

  section.append(toolbar);

  const table = node("div", {
    class: "weight-table",
    role: "table",
    "aria-label": "Entry weights and probabilities"
  });

  for (const entry of model.entries) {
    const exclude = node("input", {
      type: "checkbox",
      checked: entry.excluded,
      "aria-label": "Exclude " + entry.label
    });
    exclude.addEventListener("change", () => {
      updateSelectionEntry(ts, entry.key, { excluded: exclude.checked });
      invalidateTool(tool.id, ts);
      render();
    });

    const weight = node("input", {
      class: "weight-input",
      type: "number",
      min: "0",
      step: "0.1",
      value: String(entry.weight),
      "aria-label": "Weight for " + entry.label,
      disabled: entry.excluded ? "disabled" : null
    });
    weight.addEventListener("change", () => {
      const value = Number(weight.value);
      updateSelectionEntry(ts, entry.key, { weight: value });
      invalidateTool(tool.id, ts);
      render();
    });

    const status = entry.excluded
      ? "Excluded"
      : percentage(entry.probability);

    table.append(node("div", {
      class: "weight-row" + (entry.excluded ? " is-excluded" : ""),
      role: "row"
    }, [
      node("label", { class: "exclude-cell" }, [
        exclude,
        node("span", { class: "sr-only", text: "Exclude" })
      ]),
      node("div", { class: "weight-label", role: "cell" }, [
        node("strong", { text: entry.label }),
        node("small", {
          text: entry.weight === 0 && !entry.excluded
            ? "Weight 0 — cannot be selected"
            : "Entry " + (entry.index + 1)
        })
      ]),
      node("div", { class: "weight-control", role: "cell" }, [
        node("span", { class: "weight-caption", text: "Weight" }),
        weight
      ]),
      node("output", {
        class: "probability-cell",
        role: "cell",
        text: status
      })
    ]));
  }

  section.append(table);
  return section;
}

function ruleTypeLabel(type) {
  return ({
    together: "Keep together",
    apart: "Keep apart",
    fixed: "Fixed placement",
    capacity: "Capacity",
    requiredTag: "Required tag",
    maxTag: "Maximum tag",
    balanceField: "Balance numeric field",
    historyAvoid: "Avoid recent pairings"
  })[type] || type;
}

function openAddRuleModal(tool, ts) {
  const { context } = constraintValidation(tool, ts);
  const types = ruleTypesForTool(tool.id);
  const firstType = types[0] || "apart";

  state.modal = {
    type: "add-rule",
    toolId: tool.id,
    ruleType: firstType,
    strength: ["balanceField", "historyAvoid"].includes(firstType)
      ? "soft"
      : "hard",
    priority: 10,
    itemA: context.items[0]?.id || "",
    itemB: context.items[1]?.id || context.items[0]?.id || "",
    targetId: context.targets[0]?.id || "",
    tag: "",
    count: 1,
    max: Math.max(1, context.targets[0]?.capacity || 2),
    fieldId: context.fields.find((field) => field.type === "number")?.id || "",
    depth: 5,
    error: null
  };
  render();
}

function constraintRulesControl(tool, ts) {
  const { context, validation } = constraintValidation(tool, ts);
  const active = (ts.rules || []).filter((rule) => rule.enabled !== false);
  const required = active.filter((rule) => rule.strength !== "soft").length;
  const preferred = active.filter((rule) => rule.strength === "soft").length;

  const section = node("section", { class: "constraint-rules" });
  section.append(node("button", {
    class: "selection-rules-toggle",
    type: "button",
    "aria-expanded": String(Boolean(ts.rulesOpen)),
    onClick: () => {
      ts.rulesOpen = !ts.rulesOpen;
      render();
    }
  }, [
    node("span", { text: "Rules & balance" }),
    node("span", {
      class: "selection-rule-summary",
      text: active.length
        ? [
            required ? required + " required" : null,
            preferred ? preferred + " prefer" : null,
            (ts.solverEffort || "automatic")
          ].filter(Boolean).join(" • ")
        : "No constraints"
    }),
    node("span", {
      class: "selection-chevron",
      text: ts.rulesOpen ? "−" : "+"
    })
  ]));

  if (!ts.rulesOpen) return section;

  const effort = node("select", {
    class: "field solver-effort-select",
    "aria-label": "Solver effort"
  }, [
    node("option", { value: "fast", text: "Fast" }),
    node("option", { value: "automatic", text: "Automatic" }),
    node("option", { value: "thorough", text: "Thorough" })
  ]);
  effort.value = ts.solverEffort || "automatic";
  effort.addEventListener("change", () => {
    ts.solverEffort = effort.value;
    invalidateTool(tool.id, ts);
  });

  const sourcePoolId = ts.workingSet?.source?.poolId || null;
  const compatibleRuleSets = state.ruleSets.filter((ruleSet) =>
    ruleSetCompatible(ruleSet, {
      toolId: tool.id,
      sourcePoolId
    })
  );

  const ruleSetSelect = node("select", {
    class: "field rule-set-select",
    "aria-label": "Saved Rule Set"
  }, [
    node("option", { value: "", text: "Saved Rule Sets" }),
    ...compatibleRuleSets.map((ruleSet) =>
      node("option", {
        value: ruleSet.id,
        text:
          ruleSet.name
          + (ruleSet.scope === "pool" ? " · Pool" : " · Portable")
      })
    )
  ]);

  section.append(node("div", { class: "constraint-toolbar" }, [
    node("div", { class: "constraint-effort" }, [
      node("span", { text: "Search effort" }),
      effort
    ]),
    compatibleRuleSets.length ? ruleSetSelect : null,
    compatibleRuleSets.length
      ? node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            const saved = ruleSetById(ruleSetSelect.value);
            if (!saved) return;
            ts.rules = applyRuleSet(saved);
            invalidateTool(tool.id, ts);
            render();
          }
        }, "Apply Set")
      : null,
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => openAddRuleModal(tool, ts)
    }, "+ Add rule"),
    ts.rules.length
      ? node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            state.modal = {
              type: "save-rule-set",
              toolId: tool.id,
              name: "",
              favorite: false,
              error: null
            };
            render();
          }
        }, "Save Set")
      : null,
    ts.rules.length
      ? node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            ts.rules = [];
            invalidateTool(tool.id, ts);
            render();
          }
        }, "Clear")
      : null
  ]));

  if (validation.errors.length) {
    section.append(node("div", { class: "constraint-validation is-error" }, [
      node("strong", { text: "Rules cannot run yet" }),
      ...validation.errors.slice(0, 6).map((error) =>
        node("span", { text: error.message })
      )
    ]));
  }

  if (validation.warnings.length) {
    section.append(node("div", { class: "constraint-validation is-warning" }, [
      node("strong", { text: "Warnings" }),
      ...validation.warnings.slice(0, 4).map((warning) =>
        node("span", { text: warning.message })
      )
    ]));
  }

  if (!ts.rules.length) {
    section.append(node("div", { class: "constraint-empty" }, [
      node("strong", { text: "No rules yet" }),
      node("span", {
        text: context.fields.some((field) => field.type === "number")
          ? "Add hard constraints or soft preferences. Numeric Pool fields can also be balanced."
          : "Add together/apart/fixed/capacity rules. Pool tags and numeric fields unlock metadata rules."
      })
    ]));
    return section;
  }

  const list = node("div", { class: "constraint-rule-list" });

  for (const rule of ts.rules) {
    const enabled = node("input", {
      type: "checkbox",
      checked: rule.enabled !== false,
      "aria-label": "Enable " + ruleTypeLabel(rule.type)
    });
    enabled.addEventListener("change", () => {
      rule.enabled = enabled.checked;
      invalidateTool(tool.id, ts);
      render();
    });

    const softOnly = rule.type === "balanceField";
    const strength = node("select", {
      class: "constraint-strength",
      "aria-label": "Rule strength",
      disabled: softOnly ? "disabled" : null
    }, softOnly
      ? [node("option", { value: "soft", text: "Prefer" })]
      : [
          node("option", { value: "hard", text: "Required" }),
          node("option", { value: "soft", text: "Prefer" })
        ]
    );
    strength.value = softOnly ? "soft" : (rule.strength === "soft" ? "soft" : "hard");
    strength.addEventListener("change", () => {
      rule.strength = strength.value;
      invalidateTool(tool.id, ts);
      render();
    });

    const ruleErrors = validation.errors.filter((error) => error.ruleId === rule.id);

    list.append(node("article", {
      class:
        "constraint-rule-card"
        + (rule.enabled === false ? " is-disabled" : "")
        + (ruleErrors.length ? " is-invalid" : "")
    }, [
      node("label", { class: "constraint-rule-enabled" }, [enabled]),
      node("div", { class: "constraint-rule-copy" }, [
        node("strong", { text: summarizeRule(rule, context) }),
        node("span", {
          text:
            ruleTypeLabel(rule.type)
            + " · "
            + ruleStrengthLabel(rule)
            + (rule.strength === "soft" ? " · priority " + rule.priority : "")
        }),
        ...ruleErrors.map((error) =>
          node("small", { class: "rule-error-copy", text: error.message })
        )
      ]),
      strength,
      node("button", {
        class: "small-action",
        type: "button",
        "aria-label": "Remove rule",
        onClick: () => {
          ts.rules = ts.rules.filter((candidate) => candidate.id !== rule.id);
          invalidateTool(tool.id, ts);
          render();
        }
      }, "×")
    ]));
  }

  section.append(list);
  return section;
}

function genericFairnessDescription(tool, ts) {
  switch (tool.id) {
    case "coin":
      return ["Uniform binary choice", "Heads and Tails each have a 50% chance."];
    case "dice":
      if (ts.diceMode === "expression") {
        return [
          "Dice expression",
          "Every physical die roll is uniform over its faces. Rerolls and explosions create additional uniform rolls; keep/drop and arithmetic are deterministic post-processing. The final total is therefore not generally uniform."
        ];
      }
      return ["Uniform dice", "Every face on each D" + ts.diceSides + " has equal probability."];
    case "number":
      if (ts.numberMode === "decimal") {
        return [
          "Uniform decimal grid",
          "Values are selected uniformly from the inclusive fixed-precision grid at " + ts.numberPrecision + " decimal places."
            + (ts.numberUnique && ts.numberCount > 1
              ? " Multiple draws are sampled without replacement."
              : "")
        ];
      }
      return [
        ts.numberUnique && ts.numberCount > 1 ? "Uniform unique integers" : "Uniform integer",
        "Every whole number in the configured inclusive range has equal probability."
          + (ts.numberUnique && ts.numberCount > 1
            ? " Multiple draws are sampled without replacement."
            : "")
      ];
    case "shuffle":
      return ["Uniform shuffle", "Uses Fisher–Yates over the current entries."];
    case "teams":
    case "groups":
      return ["Random partition", "Entries are shuffled, then distributed round-robin so group sizes differ by at most one."];
    case "pairs":
      return ["Random pairing", "Entries are shuffled, then paired in order. An odd final entry is unmatched."];
    case "assignment":
      return ["Random assignment", "Sources and targets are shuffled independently, then targets are distributed as evenly as possible."];
    case "ladder":
      return ["Random permutation", "The ladder topology encodes a uniformly shuffled outcome permutation."];
    case "tournament":
      return ["Random draw", "Entrants are shuffled before first-round slots and required byes are assigned."];
    case "secret-santa":
      return ["Random valid assignment", "A derangement is generated so every person gives to exactly one different person."];
    case "elimination":
      return ["Uniform elimination", "Each remaining entrant has equal probability of being eliminated on the next draw."];
    case "cards":
      return ["Shuffled deck", "A 52-card deck is Fisher–Yates shuffled once, then drawn without replacement."];
    case "chance":
      return ["Configured Bernoulli chance", "YES uses the exact configured " + ts.chance + "% probability."];
    case "lottery":
      return ["Uniform sample", "Numbers are sampled without replacement, so every valid set is drawn from the same uniform process."];
    case "color":
      return ["Uniform 24-bit color", "Each HEX value from #000000 through #FFFFFF is equally likely."];
    case "date":
      return ["Uniform calendar day", "Each included calendar date has equal probability."];
    case "time":
      return ["Uniform minute", "Each minute in the configured window has equal probability."];
    case "coordinate":
      return ["Uniform grid point", "X and Y are independently uniform over their inclusive integer ranges."];
    case "direction":
      return ["Uniform compass direction", "Each of the eight directions has a 12.5% chance."];
    case "letter":
      return ["Uniform letter", "Each letter A–Z has a 1/26 chance."];
    case "rps":
      return ["Uniform RPS", "Rock, Paper, and Scissors each have a 1/3 chance."];
    default:
      return ["Randomized operation", "This tool uses the registered Random Core operation for its result."];
  }
}

function fairnessPanel(tool, ts) {
  const open = Boolean(ts.fairnessOpen);
  const panel = node("section", { class: "fairness-panel" });
  const modeTitle = state.settings.randomness.mode === "seeded"
    ? "Seeded deterministic"
    : "Secure random";
  const modeCopy = state.settings.randomness.mode === "seeded"
    ? "Reproducible from the seed and sequence position. Predictable to anyone who knows them; this is not secure randomness."
    : "Uses Web Crypto as the entropy source. This describes the random source, not a proof that a host or modified app cannot manipulate a setup.";

  panel.append(node("button", {
    class: "fairness-toggle",
    type: "button",
    "aria-expanded": String(open),
    onClick: () => {
      ts.fairnessOpen = !ts.fairnessOpen;
      render();
    }
  }, [
    node("span", { class: "fairness-icon", text: "◎", "aria-hidden": "true" }),
    node("span", { class: "fairness-toggle-copy" }, [
      node("strong", { text: "Fairness" }),
      node("small", { text: modeTitle })
    ]),
    node("span", { text: open ? "−" : "+" })
  ]));

  if (!open) return panel;

  panel.append(node("div", { class: "fairness-body" }, [
    node("div", { class: "fairness-method" }, [
      node("strong", { text: modeTitle }),
      node("p", { text: modeCopy })
    ])
  ]));

  if (selectionTools.has(tool.id)) {
    const model = currentSelectionModel(tool.id, ts);
    if (model) {
      const selectionTitle = model.customWeights
        ? "Weighted selection"
        : "Equal effective chances";
      let selectionCopy =
        model.eligibleCount + " of " + model.entries.length + " entries are eligible. ";
      if (tool.id === "sampler" && ts.allowRepeats) {
        selectionCopy += "Every draw uses the displayed probabilities and selected entries remain eligible.";
      } else if (tool.id === "sampler") {
        selectionCopy += "Displayed percentages are first-draw chances; after each winner, that entry is removed and the remaining weights renormalize.";
      } else {
        selectionCopy += "Probability equals effective weight divided by total eligible weight.";
      }

      panel.querySelector(".fairness-body").append(
        node("div", { class: "fairness-method" }, [
          node("strong", { text: selectionTitle }),
          node("p", { text: selectionCopy })
        ]),
        node("div", { class: "fairness-probabilities" },
          model.entries.map((entry) =>
            node("div", {
              class: "fairness-probability-row" + (!entry.eligible ? " is-ineligible" : "")
            }, [
              node("span", { text: entry.label }),
              node("strong", {
                text: entry.excluded ? "Excluded" : percentage(entry.probability)
              })
            ])
          )
        )
      );
    }
  } else {
    const [title, copy] = genericFairnessDescription(tool, ts);
    panel.querySelector(".fairness-body").append(
      node("div", { class: "fairness-method" }, [
        node("strong", { text: title }),
        node("p", { text: copy })
      ])
    );
  }

  return panel;
}

function numberModeControl(tool, ts) {
  return node("div", {
    class: "segmented number-mode",
    "aria-label": "Number mode"
  }, [
    node("button", {
      class: ts.numberMode === "integer" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.numberMode = "integer";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Integer"),
    node("button", {
      class: ts.numberMode === "decimal" ? "active" : "",
      type: "button",
      onClick: () => {
        ts.numberMode = "decimal";
        invalidateTool(tool.id, ts);
        render();
      }
    }, "Decimal")
  ]);
}

function numberPresetRow(tool, ts) {
  const presets = [
    { label: "1–10", mode: "integer", min: 1, max: 10, count: 1 },
    { label: "1–100", mode: "integer", min: 1, max: 100, count: 1 },
    { label: "3 unique", mode: "integer", min: 1, max: 100, count: 3, unique: true },
    { label: "0.00–1.00", mode: "decimal", min: 0, max: 1, count: 1, precision: 2 }
  ];

  return node("div", { class: "dice-presets number-presets" },
    presets.map((preset) =>
      node("button", {
        class: "dice-preset",
        type: "button",
        onClick: () => {
          ts.numberMode = preset.mode;
          ts.numberMin = preset.min;
          ts.numberMax = preset.max;
          ts.numberCount = preset.count;
          ts.numberUnique = Boolean(preset.unique);
          if (preset.precision) ts.numberPrecision = preset.precision;
          invalidateTool(tool.id, ts);
          render();
        }
      }, preset.label)
    )
  );
}

async function undoActiveSession(toolId) {
  finishPresentation(toolId, null, false);
  const ts = ensureToolState(toolId);
  const current = sessionById(ts.activeSessionId);
  if (!current) return;

  try {
    const next = undoSession(current, runsByIdMap());
    const event = createSessionEvent(current.id, "undo", {
      fromCursor: current.cursor,
      toCursor: next.cursor
    });

    await commitSessionMutation({
      session: next,
      event,
      expectedRevision: current.revision
    });

    replaceSession(next);
    restoreToolSnapshot(toolId, next.currentState, {
      sessionId: next.id
    });
    announce("Undid the last " + getTool(toolId).name + " action.");
    if (state.view === "party") {
      const party = activePartySession();
      const restored = ensureToolState(toolId);
      broadcastPartyAudience({
        party,
        run: {
          result: restored.result,
          fairness: null
        },
        stage: "result"
      });
    }
    render();
  } catch (error) {
    ts.error = error?.message || "Could not undo.";
    render();
  }
}

async function redoActiveSession(toolId) {
  finishPresentation(toolId, null, false);
  const ts = ensureToolState(toolId);
  const current = sessionById(ts.activeSessionId);
  if (!current) return;

  try {
    let next = redoSession(current, runsByIdMap());

    if (isSessionCompleteForTool(toolId, next.currentState)) {
      next = completeSession(next);
    }

    const event = createSessionEvent(current.id, "redo", {
      fromCursor: current.cursor,
      toCursor: next.cursor,
      status: next.status
    });

    await commitSessionMutation({
      session: next,
      event,
      expectedRevision: current.revision
    });

    replaceSession(next);
    restoreToolSnapshot(toolId, next.currentState, {
      sessionId: next.id
    });
    announce("Redid the stored " + getTool(toolId).name + " result.");
    if (state.view === "party") {
      const party = activePartySession();
      const restored = ensureToolState(toolId);
      broadcastPartyAudience({
        party,
        run: {
          result: restored.result,
          fairness: null
        },
        stage: "result"
      });
    }
    render();
  } catch (error) {
    ts.error = error?.message || "Could not redo.";
    render();
  }
}

async function endActiveSession(toolId, status = "abandoned", resetTool = false) {
  finishPresentation(toolId, null, false);
  const ts = ensureToolState(toolId);
  const current = sessionById(ts.activeSessionId);

  if (current && !(status === "completed" && current.status === "completed")) {
    try {
      const next = status === "completed"
        ? completeSession(current)
        : abandonSession(current);
      const event = createSessionEvent(current.id, status === "completed" ? "closed" : "abandoned");

      await commitSessionMutation({
        session: next,
        event,
        expectedRevision: current.revision
      });

      replaceSession(next);
    } catch (error) {
      ts.error = error?.message || "Could not close session.";
      render();
      return;
    }
  }

  if (resetTool) {
    invalidateTool(toolId, ts, true);
  }
  ts.activeSessionId = null;
  ts.replayRunId = null;
  render();
}

function replayStoredRun(run) {
  if (!run?.afterState) return;

  if (run.toolId === "studio") {
    state.view = "studio";
    state.toolId = null;
    state.modal = null;
    state.tool.studioText = run.beforeState?.studioText || "";
    state.tool.studioCount = run.beforeState?.studioCount || 3;
    state.studioResult = cloneData(run.result);
    history.replaceState({}, "", location.pathname);
    render();
    announce("Replaying stored Studio result. No randomness was used.");
    return;
  }

  state.view = "tool";
  state.toolId = run.toolId;
  state.modal = null;
  restoreToolSnapshot(run.toolId, run.afterState, {
    replayRunId: run.id
  });
  history.replaceState(
    {},
    "",
    location.pathname + "?tool=" + encodeURIComponent(run.toolId)
  );
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  announce("Replaying stored result. No randomness was used.");
}

async function rerunStoredRun(run) {
  if (!run?.beforeState) return;

  if (run.toolId === "studio") {
    state.view = "studio";
    state.toolId = null;
    state.modal = null;
    state.tool.studioText = run.beforeState?.studioText || "";
    state.tool.studioCount = run.beforeState?.studioCount || 3;
    state.studioResult = cloneData(run.beforeState?.studioResult || null);
    history.replaceState({}, "", location.pathname);
    render();
    await runStudio();
    return;
  }

  state.view = "tool";
  state.toolId = run.toolId;
  state.modal = null;
  restoreToolSnapshot(run.toolId, run.beforeState);
  history.replaceState(
    {},
    "",
    location.pathname + "?tool=" + encodeURIComponent(run.toolId)
  );
  render();
  await runTool(run.toolId);
}

function resumeStoredSession(session) {
  if (!session) return;
  state.view = "tool";
  state.toolId = session.toolId;
  state.modal = null;
  resumeSessionInTool(session);
  history.replaceState(
    {},
    "",
    location.pathname + "?tool=" + encodeURIComponent(session.toolId)
  );
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  announce("Session resumed.");
}

async function toggleHistoryPin(key) {
  if (state.historyPins.has(key)) {
    await remove("historyPins", key);
    state.historyPins.delete(key);
  } else {
    await put("historyPins", {
      id: key,
      createdAt: Date.now()
    });
    state.historyPins.add(key);
  }
  render();
}

function templateContextBar(tool, ts) {
  if (!ts.templateSessionId) return null;

  const session = templateSessionById(ts.templateSessionId);
  const template = session ? sessionTemplateById(session.templateId) : null;
  const index = Number(ts.templateStepIndex);
  const definition = template?.steps?.[index];

  if (!session || !template || !definition) return null;

  const nextIndex = session.currentIndex < session.steps.length
    ? session.currentIndex
    : null;

  return node("section", { class: "session-bar template-context-bar" }, [
    node("div", { class: "session-bar-copy" }, [
      node("strong", {
        text:
          template.name
          + " · Step "
          + (index + 1)
          + " of "
          + template.steps.length
      }),
      node("span", {
        text:
          definition.name
          + (
            session.status === "completed"
              ? " · Session complete"
              : session.steps[index]?.status === "complete"
                ? " · Step complete"
                : ""
          )
      })
    ]),
    node("div", { class: "session-bar-actions" }, [
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => openTemplateSession(session.id)
      }, "Back to Session"),
      nextIndex != null && nextIndex !== index
        ? node("button", {
            class: "secondary",
            type: "button",
            onClick: () => openTemplateStep(session, nextIndex)
          }, "Next Step")
        : null
    ])
  ]);
}

function sessionControlBar(tool, ts) {
  if (ts.replayRunId) {
    const run = runById(ts.replayRunId);
    if (!run) return null;

    return node("section", { class: "session-bar replay-bar" }, [
      node("div", { class: "session-bar-copy" }, [
        node("strong", { text: "Replay — stored result" }),
        node("span", {
          text: "No randomness was consumed. Rerun creates a new Run from the saved setup."
        })
      ]),
      node("div", { class: "session-bar-actions" }, [
        node("button", {
          class: "secondary",
          type: "button",
          onClick: () => rerunStoredRun(run)
        }, "Rerun"),
        node("button", {
          class: "small-action",
          type: "button",
          onClick: () => {
            ts.replayRunId = null;
            ts.result = null;
            render();
          }
        }, "Exit replay")
      ])
    ]);
  }

  if (!isStatefulTool(tool.id) || !ts.activeSessionId) return null;

  const session = sessionById(ts.activeSessionId);
  if (!session) return null;

  return node("section", {
    class: "session-bar session-status-" + session.status
  }, [
    node("div", { class: "session-bar-copy" }, [
      node("strong", {
        text: session.status === "completed"
          ? "Session complete"
          : "Active session"
      }),
      node("span", {
        text:
          session.cursor
          + " applied · "
          + (session.runIds.length - session.cursor)
          + " redo"
      })
    ]),
    node("div", { class: "session-bar-actions" }, [
      node("button", {
        class: "small-action",
        type: "button",
        disabled: sessionCanUndo(session) ? null : "disabled",
        onClick: () => undoActiveSession(tool.id)
      }, "Undo"),
      node("button", {
        class: "small-action",
        type: "button",
        disabled: sessionCanRedo(session) ? null : "disabled",
        onClick: () => redoActiveSession(tool.id)
      }, "Redo"),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => endActiveSession(
          tool.id,
          session.status === "completed" ? "completed" : "abandoned",
          true
        )
      }, session.status === "completed" ? "Close" : "End")
    ])
  ]);
}

async function updatePresentationSetting(key, value) {
  state.settings = normalizeExperienceSettings(state.settings);
  state.settings.presentation[key] = value;
  state.settings.sound = state.settings.presentation.sound;
  state.settings.motion = state.settings.presentation.motion;
  await saveSettings(state.settings);
}

function presentationModeControl() {
  const settings = normalizeExperienceSettings(state.settings);
  const current = settings.presentation.mode;

  return node("div", {
    class: "presentation-mode-row",
    "aria-label": "Reveal style"
  }, [
    node("span", { class: "presentation-mode-label", text: "Reveal" }),
    node("div", { class: "segmented presentation-mode-segment" },
      [
        ["instant", "Instant"],
        ["normal", "Normal"],
        ["showtime", "Showtime"]
      ].map(([value, label]) =>
        node("button", {
          class: current === value ? "active" : "",
          type: "button",
          onClick: async () => {
            await updatePresentationSetting("mode", value);
            render();
          }
        }, label)
      )
    )
  ]);
}

function configSetter(toolId, ts, key, value, rerender = false) {
  ts[key] = value;
  invalidateTool(toolId, ts);
  if (rerender) render();
}

function buildControls(tool, ts) {
  const controls = node("div", { class: "controls" });
  const grid = node("div", { class: "control-grid" });

  const templateBar = templateContextBar(tool, ts);
  if (templateBar) controls.append(templateBar);

  const sessionBar = sessionControlBar(tool, ts);
  if (sessionBar) controls.append(sessionBar);

  if (ts.error) controls.append(toolError(ts.error));

  if (listInputTools.has(tool.id)) {
    controls.append(listControls(tool, ts));

    if (tool.id === "teams") {
      grid.append(numberControl(
        "Teams", "team-count", ts.teamCount, 2, 12,
        (value) => configSetter(tool.id, ts, "teamCount", value)
      ));
      controls.append(grid);
    } else if (tool.id === "groups") {
      grid.append(numberControl(
        "Groups", "group-count", ts.groupCount, 2, 20,
        (value) => configSetter(tool.id, ts, "groupCount", value)
      ));
      controls.append(grid);
    } else if (tool.id === "sampler") {
      grid.append(numberControl(
        "Winners", "sample-count", ts.sampleCount, 1, 100,
        (value) => configSetter(tool.id, ts, "sampleCount", value)
      ));
      controls.append(grid);
    } else if (tool.id === "assignment") {
      controls.append(textareaControl(
        "Targets / tasks",
        ts.targetText,
        (value) => {
          ts.targetText = value;
          invalidateTool(tool.id, ts);
        }
      ));
    } else if (tool.id === "ladder") {
      controls.append(textareaControl(
        "Outcomes / prizes",
        ts.ladderOutcomes,
        (value) => {
          ts.ladderOutcomes = value;
          invalidateTool(tool.id, ts);
        }
      ));
    }

    if (selectionTools.has(tool.id)) {
      controls.append(selectionRulesControl(tool, ts));
    }

    if (constraintTools.has(tool.id)) {
      controls.append(constraintRulesControl(tool, ts));
    }

    if (tool.id === "secret-santa" && ts.secretAssignments) {
      const reveal = node("select", {
        class: "field",
        "aria-label": "Choose participant to reveal"
      }, ts.secretAssignments.map((item, index) =>
        node("option", {
          value: String(index),
          text: item.source
        })
      ));

      controls.append(node("div", {
        class: "button-row secret-actions",
        style: { marginBottom: "12px" }
      }, [
        reveal,
        node("button", {
          class: "secondary",
          type: "button",
          onClick: () => {
            ts.secretReveal = Number(reveal.value);
            beginPresentation(
              "secret-santa",
              ts,
              { privateReveal: true }
            );
            render();
          }
        }, "Reveal privately"),
        node("button", {
          class: "secondary",
          type: "button",
          onClick: () => {
            finishPresentation("secret-santa", null, false);
            ts.secretReveal = null;
            render();
          }
        }, "Hide")
      ]));
    }
  } else if (tool.id === "dice") {
    controls.append(diceModeControl(tool, ts));

    if (ts.diceMode === "expression") {
      controls.append(diceExpressionEditor(tool, ts));
    } else {
      grid.append(
        stepperControl("Dice", ts.diceCount, 1, 8, (value) => {
          configSetter(tool.id, ts, "diceCount", value, true);
        }),
        selectControl(
          "Sides",
          ["2", "4", "6", "8", "10", "12", "20", "37", "100"],
          String(ts.diceSides),
          (value) => {
            configSetter(tool.id, ts, "diceSides", Number(value), true);
          }
        )
      );
      controls.append(grid);
      controls.append(dicePresetRow(tool, ts, [
        { label: "D6", count: 1, sides: 6 },
        { label: "D20", count: 1, sides: 20 },
        { label: "2D6", count: 2, sides: 6 },
        { label: "D100", count: 1, sides: 100 }
      ]));
    }

    const recent = diceHistoryPanel(ts);
    if (recent) controls.append(recent);
  } else if (tool.id === "number") {
    controls.append(numberModeControl(tool, ts));

    grid.append(
      numberControl(
        "Minimum", "number-min", ts.numberMin, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "numberMin", value)
      ),
      numberControl(
        "Maximum", "number-max", ts.numberMax, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "numberMax", value)
      ),
      numberControl(
        "How many", "number-count", ts.numberCount, 1, 100,
        (value) => configSetter(tool.id, ts, "numberCount", value)
      )
    );

    if (ts.numberMode === "decimal") {
      grid.append(numberControl(
        "Decimal places", "number-precision", ts.numberPrecision, 1, 6,
        (value) => configSetter(tool.id, ts, "numberPrecision", value)
      ));
    }

    controls.append(grid);

    if (ts.numberCount > 1) {
      const unique = node("input", {
        type: "checkbox",
        checked: ts.numberUnique,
        "aria-label": "Require unique generated numbers"
      });
      unique.addEventListener("change", () => {
        ts.numberUnique = unique.checked;
        invalidateTool(tool.id, ts);
        render();
      });
      controls.append(node("label", { class: "number-unique-toggle" }, [
        unique,
        node("span", { text: "No duplicate values" })
      ]));
    }

    controls.append(numberPresetRow(tool, ts));
  } else if (tool.id === "chance") {
    grid.append(numberControl(
      "Success chance %", "chance", ts.chance, 0, 100,
      (value) => configSetter(tool.id, ts, "chance", value)
    ));
    controls.append(grid);
  } else if (tool.id === "lottery") {
    grid.append(
      numberControl(
        "Numbers", "lottery-count", ts.lotteryCount, 1, 50,
        (value) => configSetter(tool.id, ts, "lotteryCount", value)
      ),
      numberControl(
        "From 1 to", "lottery-max", ts.lotteryMax, 1, 10000,
        (value) => configSetter(tool.id, ts, "lotteryMax", value)
      )
    );
    controls.append(grid);
  } else if (tool.id === "date") {
    grid.append(
      dateControl("From", ts.dateStart, (value) => {
        configSetter(tool.id, ts, "dateStart", value);
      }),
      dateControl("To", ts.dateEnd, (value) => {
        configSetter(tool.id, ts, "dateEnd", value);
      })
    );
    controls.append(grid);
  } else if (tool.id === "time") {
    grid.append(
      timeControl("From", ts.timeStart, (value) => {
        configSetter(tool.id, ts, "timeStart", value);
      }),
      timeControl("To", ts.timeEnd, (value) => {
        configSetter(tool.id, ts, "timeEnd", value);
      })
    );
    controls.append(grid);
  } else if (tool.id === "coordinate") {
    grid.append(
      numberControl("X min", "x-min", ts.xMin, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "xMin", value)),
      numberControl("X max", "x-max", ts.xMax, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "xMax", value)),
      numberControl("Y min", "y-min", ts.yMin, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "yMin", value)),
      numberControl("Y max", "y-max", ts.yMax, -1000000, 1000000,
        (value) => configSetter(tool.id, ts, "yMax", value))
    );
    controls.append(grid);
  }

  controls.append(presentationModeControl());

  controls.append(node("div", { class: "saved-setup-toolbar" }, [
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        state.modal = {
          type: "save-preset",
          toolId: tool.id,
          name: "",
          description: "",
          bindingMode:
            ts.workingSet?.source?.poolId
              ? "live-source"
              : listInputTools.has(tool.id)
                ? "frozen"
                : "none",
          favorite: false,
          error: null
        };
        render();
      }
    }, ts.activePresetId ? "Save as New Preset" : "Save Preset"),
    ts.activePresetId
      ? node("span", {
          class: "active-preset-chip",
          text: "Preset · " + (presetById(ts.activePresetId)?.name || "Loaded")
        })
      : null,
    (() => {
      const activeParty = latestActivePartyForTool(tool.id);
      return node("button", {
        class: "small-action party-launch-button",
        type: "button",
        onClick: () => {
          if (activeParty) openPartySession(activeParty.id);
          else startPartyMode(tool.id);
        }
      }, activeParty ? "Resume Party" : "Party Mode");
    })()
  ]));

  const actions = node("div", { class: "button-row" });
  const primary = node("button", {
    class: "primary action-button",
    type: "button",
    onClick: () => runTool(tool.id)
  }, actionLabel(tool.id, ts));

  if (
    ts.replayRunId
    || (tool.id === "cards" && Array.isArray(ts.deck) && ts.deck.length === 0)
  ) {
    primary.disabled = true;
  }

  actions.append(primary);

  if (tool.id === "cards" && ts.deck && !ts.replayRunId) {
    actions.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        if (ts.activeSessionId) {
          const session = sessionById(ts.activeSessionId);
          endActiveSession(
            tool.id,
            session?.status === "completed" ? "completed" : "abandoned",
            true
          );
        } else {
          invalidateTool(tool.id, ts, true);
          render();
        }
      }
    }, "Reset deck"));
  }

  if (
    tool.id === "elimination"
    && ts.eliminationRemaining
    && !ts.replayRunId
  ) {
    actions.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        if (ts.activeSessionId) {
          const session = sessionById(ts.activeSessionId);
          endActiveSession(
            tool.id,
            session?.status === "completed" ? "completed" : "abandoned",
            true
          );
        } else {
          invalidateTool(tool.id, ts, true);
          render();
        }
      }
    }, "Reset elimination"));
  }

  if (ts.result) {
    actions.append(
      node("button", {
        class: "secondary",
        type: "button",
        onClick: shareCurrentResult
      }, "Share"),
      tool.id !== "secret-santa"
        ? node("button", {
            class: "secondary",
            type: "button",
            onClick: () => {
              state.modal = {
                type: "use-result",
                sourceToolId: tool.id,
                result: cloneData(ts.result),
                error: null
              };
              render();
            }
          }, "Use Result In…")
        : null
    );
  }

  controls.append(actions);

  const mode = state.settings.randomness.mode === "seeded"
    ? "Seeded sequence · " + state.settings.randomness.seed
    : "Secure Web Crypto randomness";

  controls.append(node("div", {
    class: "notice",
    style: { marginTop: "12px" },
    text: mode + ". The result is committed before its reveal animation."
  }));

  controls.append(fairnessPanel(tool, ts));

  return controls;
}

function actionLabel(id, ts) {
  if (ts.animating) return "SHOW RESULT";
  const labels = {
    coin: ts.result ? "FLIP AGAIN" : "FLIP",
    dice: ts.result ? "ROLL AGAIN" : "ROLL",
    wheel: ts.result ? "SPIN AGAIN" : "SPIN",
    picker: ts.result ? "PICK AGAIN" : "PICK",
    sampler: "DRAW WINNERS",
    number: "GENERATE",
    shuffle: "SHUFFLE",
    teams: ts.result ? "REMIX" : "MIX TEAMS",
    groups: ts.result ? "REGROUP" : "MAKE GROUPS",
    pairs: ts.result ? "REMATCH" : "MAKE PAIRS",
    assignment: ts.result ? "REASSIGN" : "ASSIGN",
    elimination: ts.result?.winner ? "START AGAIN" : "ELIMINATE",
    ladder: "GENERATE LADDER",
    "secret-santa": ts.secretAssignments ? "REGENERATE" : "GENERATE",
    tournament: "DRAW MATCHUPS",
    cards: Array.isArray(ts.deck) && ts.deck.length === 0 ? "DECK EMPTY" : "DRAW",
    chance: "TRY CHANCE",
    lottery: "DRAW NUMBERS",
    color: "NEW COLOR",
    date: "PICK DATE",
    time: "PICK TIME",
    coordinate: "GENERATE POINT",
    direction: "SPIN DIRECTION",
    letter: "DRAW LETTER",
    rps: "PLAY"
  };
  return labels[id] || "RANDOMIZE";
}

function deriveAfterState(id, beforeState, output, result) {
  const after = cloneData(beforeState);

  if (output.statePatch) Object.assign(after, cloneData(output.statePatch));
  after.result = cloneData(result);
  after.error = null;

  if (output.fairness?.kind === "constrained") {
    after.lastSolverDiagnostics = cloneData(output.detail?.solver || null);
    after.lastConstraintScore = output.detail?.score ?? null;
  }

  if (id === "dice") {
    const label = result.mode === "expression"
      ? result.expression
      : after.diceCount + "d" + after.diceSides;
    after.diceHistory = [
      {
        label,
        total: result.total,
        mode: result.mode,
        timestamp: Date.now()
      },
      ...(after.diceHistory || [])
    ].slice(0, 10);
  }

  if (id === "ladder") {
    after.ladder = cloneData(output.detail?.ladder || null);
  }

  return snapshotToolState(id, after);
}

async function abandonSessionForSetupChange(toolId, toolState, fingerprint) {
  if (!toolState.activeSessionId) return null;

  const current = sessionById(toolState.activeSessionId);
  if (!current || current.status !== "active") {
    toolState.activeSessionId = null;
    return null;
  }

  if (current.setupFingerprint === fingerprint) return current;

  const next = abandonSession(current);
  const event = createSessionEvent(current.id, "setup_changed", {
    fromFingerprint: current.setupFingerprint,
    toFingerprint: fingerprint
  });

  await commitSessionMutation({
    session: next,
    event,
    expectedRevision: current.revision
  });

  replaceSession(next);
  toolState.activeSessionId = null;
  return null;
}

async function runTool(id) {
  const tool = getTool(id);
  let ts = ensureToolState(id);

  if (ts.animating || ts.presentation) {
    if (skipPresentation(id)) return;
  }

  primeAudio(
    normalizeExperienceSettings(state.settings).presentation.sound
  );

  if (ts.replayRunId) {
    ts.error = "Replay is view-only. Use Rerun to create a new result.";
    render();
    return;
  }

  if (id === "elimination" && ts.result?.winner) {
    await endActiveSession(id, "completed", true);
    return;
  }

  ts.error = null;

  if (selectionTools.has(id)) {
    reconcileToolSelection(id, ts);
  }

  const prepared = prepareRandomSource();
  const beforeState = snapshotToolState(id, ts);
  const inputSnapshot = runInputSnapshot(id, ts);
  const configSnapshot = runConfigSnapshot(id, ts);
  const fingerprint = fingerprintSetup(id, inputSnapshot, configSnapshot);

  const config = {
    ...ts,
    items: parseList(ts.listText),
    targets: parseList(ts.targetText),
    outcomes: parseList(ts.ladderOutcomes)
  };

  if (constraintTools.has(id)) {
    const context = constraintContext(tool, ts);
    config.constraintItems = context.items;
    config.constraintFields = context.fields;
    config.historyPairs = [...historyPairsForTool(tool, ts)];
  }

  try {
    let session = null;
    let expectedSessionRevision = null;
    let templateSession = ts.templateSessionId
      ? templateSessionById(ts.templateSessionId)
      : null;
    let expectedTemplateSessionRevision = templateSession?.revision ?? null;
    let partySession =
      state.view === "party"
      && state.activePartySessionId
        ? partySessionById(state.activePartySessionId)
        : null;
    let expectedPartySessionRevision = partySession?.revision ?? null;

    if (partySession && partySession.toolId !== id) {
      throw new Error("Party Session tool no longer matches this Stage.");
    }

    if (
      templateSession
      && (
        templateSession.status !== "active"
        || templateSession.steps[ts.templateStepIndex]?.stepId !== ts.templateStepId
      )
    ) {
      throw new Error("This Session Template step is no longer active.");
    }

    if (isStatefulTool(id)) {
      session = await abandonSessionForSetupChange(id, ts, fingerprint);

      if (!session) {
        session = createSession({
          toolId: id,
          toolName: tool.name,
          icon: tool.icon,
          initialState: beforeState,
          setupFingerprint: fingerprint,
          inputSnapshot,
          configSnapshot
        });
      } else {
        expectedSessionRevision = session.revision;
      }
    }

    const output = executeTool(id, config, prepared.source);
    let result = output.result;
    let summary = output.summary;

    if (id === "date") {
      const date = new Date(result.timestamp);
      const localized = new Intl.DateTimeFormat(undefined, {
        dateStyle: "long",
        timeZone: "UTC"
      }).format(date);
      result = { ...result, summary: localized };
      summary = localized;
    }

    const afterState = deriveAfterState(id, beforeState, output, result);

    const run = createRun({
      toolId: id,
      toolName: tool.name,
      icon: tool.icon,
      sessionId: session?.id || null,
      templateSessionId: templateSession?.id || null,
      templateStepId: ts.templateStepId || null,
      partySessionId: partySession?.id || null,
      setupFingerprint: fingerprint,
      inputSnapshot,
      configSnapshot,
      beforeState,
      afterState,
      result,
      summary,
      detail: output.detail || null,
      fairness: output.fairness || null,
      randomContext: prepared.context
    });

    let nextSession = null;
    let nextTemplateSession = null;
    let nextPartySession = null;
    let event = null;

    if (session) {
      nextSession = appendRunToSession(session, run);

      if (isSessionCompleteForTool(id, afterState)) {
        nextSession = completeSession(nextSession);
      }

      event = createSessionEvent(session.id, "run_committed", {
        runId: run.id,
        cursor: nextSession.cursor,
        status: nextSession.status
      });
    }

    if (templateSession) {
      nextTemplateSession = completeTemplateStep(
        templateSession,
        Number(ts.templateStepIndex),
        run.id,
        resultToItems(id, result)
      );
    }

    if (partySession) {
      nextPartySession = appendPartyRun(partySession, run.id);
    }

    await commitRunAndSession({
      run,
      session: nextSession,
      event,
      templateSession: nextTemplateSession,
      partySession: nextPartySession,
      settingsRecord: prepared.settingsRecord,
      expectedSessionRevision,
      expectedTemplateSessionRevision,
      expectedPartySessionRevision
    });

    if (prepared.nextSettings) state.settings = prepared.nextSettings;

    state.runs = [
      run,
      ...state.runs.filter((candidate) => candidate.id !== run.id)
    ].sort((a, b) => b.timestamp - a.timestamp);

    if (nextSession) replaceSession(nextSession);
    if (nextTemplateSession) replaceTemplateSession(nextTemplateSession);
    if (nextPartySession) replacePartySession(nextPartySession);

    const committedTemplateStepIndex = Number(ts.templateStepIndex);

    ts = restoreToolSnapshot(id, afterState, {
      sessionId: nextSession?.id || null
    });

    if (nextTemplateSession) {
      ts.templateSessionId = nextTemplateSession.id;
      ts.templateStepIndex = committedTemplateStepIndex;
      ts.templateStepId = run.templateStepId;
      state.activeTemplateSessionId = nextTemplateSession.id;
    }

    const plan = beginPresentation(id, ts, result);

    if (nextPartySession) {
      broadcastPartyAudience({
        party: nextPartySession,
        run,
        stage: "result"
      });
    }

    if (id === "wheel") {
      const index = output.detail.selectedIndex;
      const model = normalizeSelection(config.items, config.selectionEntries || []);
      const segment = wheelSegmentForIndex(model, index);
      const desired = (360 - segment.center) % 360;
      const previous = beforeState.wheelRotation || 0;
      const current = ((previous % 360) + 360) % 360;
      const delta = (desired - current + 360) % 360;
      const extraRotation = plan.reducedMotion
        ? 0
        : plan.mode === "showtime"
          ? 1800
          : 1080;
      const target = previous + extraRotation + delta;

      ts.previousWheelRotation = previous;
      ts.pendingWheelRotation = target;
      ts.wheelRotation = target;
      ts.animating = plan.duration > 0;
    }

    render();
    announce(tool.name + " result: " + summary);
  } catch (error) {
    ts = ensureToolState(id);
    ts.error = error?.message || "This randomizer could not run.";
    render();
    announce("Error: " + ts.error);
  }
}
function finishAnimation(id) {
  finishPresentation(id, null, true);
}

async function shareCurrentResult() {
  const tool = currentTool();
  const ts = ensureToolState(tool.id);
  if (!ts.result) return;

  let text = tool.name + ": " + summarizeResult(tool.id, ts.result);

  if (selectionTools.has(tool.id)) {
    const model = currentSelectionModel(tool.id, ts);
    if (model) {
      const rules = selectionRuleSummary(model, {
        allowRepeats: ts.allowRepeats,
        multi: tool.id === "sampler"
      });
      if (rules.length) text += " · " + rules.join(" · ");
    }
  }

  text += state.settings.randomness.mode === "seeded"
    ? " · Seeded"
    : " · Secure Random";

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Randomizer Arcade",
        text
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      announce("Result copied.");
    }
  } catch {
    // Cancelling the platform share sheet is not an application error.
  }
}

function summarizeResult(id, result) {
  if (id === "dice") {
    if (result.mode === "expression") {
      return result.expression + " = " + result.total;
    }
    return result.values.join(" + ") + " = " + result.total;
  }

  if (id === "teams") {
    return result.map((group, index) =>
      "Team " + (index + 1) + ": " + group.join(", ")
    ).join(" | ");
  }

  if (id === "groups") {
    return result.map((group, index) =>
      "Group " + (index + 1) + ": " + group.join(", ")
    ).join(" | ");
  }

  if (id === "shuffle" || id === "sampler") {
    return result.join(", ");
  }

  if (id === "pairs") {
    return result.map((group) =>
      group.length === 2 ? group.join(" & ") : group[0] + " — unmatched"
    ).join(" | ");
  }

  if (id === "assignment" || id === "ladder") {
    return result.map((item) =>
      item.source + " → " + item.target
    ).join(" | ");
  }

  if (id === "tournament") {
    return result.map((match) =>
      match.b ? match.a + " vs " + match.b : match.a + " — BYE"
    ).join(" | ");
  }

  if (id === "lottery") return result.join(", ");

  if (typeof result === "object") {
    return result.summary || result.card || JSON.stringify(result);
  }

  return String(result);
}

function poolEditorFieldInput(field, item, editor) {
  const current = item.values?.[field.id];

  if (field.type === "boolean") {
    const select = node("select", {
      class: "pool-cell-input",
      "aria-label": field.name + " for " + item.label
    }, [
      node("option", { value: "", text: "—" }),
      node("option", { value: "true", text: "Yes" }),
      node("option", { value: "false", text: "No" })
    ]);
    select.value = current === true ? "true" : current === false ? "false" : "";
    select.addEventListener("change", () => {
      item.values[field.id] = select.value === ""
        ? ""
        : select.value === "true";
    });
    return select;
  }

  const input = node("input", {
    class: "pool-cell-input",
    type: field.type === "number" ? "number" : "text",
    value: current ?? "",
    placeholder: field.name,
    "aria-label": field.name + " for " + item.label
  });
  input.addEventListener("input", () => {
    item.values[field.id] = field.type === "number"
      ? (input.value === "" ? "" : Number(input.value))
      : input.value;
  });
  return input;
}

function renderPoolEditorModal(modal, editor) {
  const draft = editor.draft;
  const stats = poolStats(draft);
  const duplicates = duplicateSummary(draft);
  modal.classList.add("pool-editor-modal");

  const titleInput = node("input", {
    class: "pool-title-input",
    value: draft.name,
    "aria-label": "Pool name"
  });
  titleInput.addEventListener("input", () => {
    draft.name = titleInput.value;
  });

  const description = node("textarea", {
    class: "field pool-description-input",
    placeholder: "Optional description",
    "aria-label": "Pool description"
  });
  description.value = draft.description;
  description.addEventListener("input", () => {
    draft.description = description.value;
  });

  const kind = node("select", {
    class: "field",
    "aria-label": "Pool kind"
  }, ["generic", "people", "choices", "tasks", "cards"].map((value) =>
    node("option", { value, text: value[0].toUpperCase() + value.slice(1) })
  ));
  kind.value = draft.kind;
  kind.addEventListener("change", () => {
    draft.kind = kind.value;
  });

  modal.append(
    node("div", { class: "pool-editor-heading" }, [
      titleInput,
      node("span", {
        class: "pool-revision",
        text: "Revision " + editor.baseRevision
      })
    ]),
    description,
    node("div", { class: "pool-editor-meta" }, [
      kind,
      node("span", { text: stats.active + "/" + stats.total + " active" }),
      node("span", { text: stats.tags + " tags" }),
      node("span", { text: stats.fields + " fields" }),
      duplicates.groupCount
        ? node("span", {
            class: "warning",
            text: duplicates.groupCount + " duplicate groups"
          })
        : node("span", { text: "No duplicate labels" })
    ])
  );

  if (duplicates.groupCount) {
    modal.append(node("section", { class: "duplicate-review" }, [
      node("strong", { text: "Duplicate review" }),
      node("span", {
        text: "Duplicates are allowed and remain separate items with separate IDs."
      }),
      ...duplicates.groups.slice(0, 8).map((group) =>
        node("div", { class: "duplicate-review-row" }, [
          node("span", { text: group[0].label }),
          node("strong", { text: group.length + " copies" })
        ])
      )
    ]));
  }

  if (editor.error) modal.append(toolError(editor.error));

  const search = node("input", {
    class: "field",
    type: "search",
    placeholder: "Search labels, tags, and fields…",
    value: editor.search,
    "aria-label": "Search Pool items"
  });
  search.addEventListener("input", () => {
    editor.search = search.value;
  });
  search.addEventListener("change", render);

  const activeFilter = node("select", {
    class: "field",
    "aria-label": "Active item filter"
  }, [
    node("option", { value: "all", text: "All items" }),
    node("option", { value: "active", text: "Active only" }),
    node("option", { value: "inactive", text: "Inactive only" })
  ]);
  activeFilter.value = editor.active;
  activeFilter.addEventListener("change", () => {
    editor.active = activeFilter.value;
    render();
  });

  const tagFilter = node("input", {
    class: "field",
    type: "text",
    placeholder: "Filter tag",
    value: editor.tagFilter,
    "aria-label": "Filter Pool by tag"
  });
  tagFilter.addEventListener("change", () => {
    editor.tagFilter = tagFilter.value.trim();
    render();
  });

  modal.append(node("div", { class: "pool-filter-bar" }, [
    search,
    activeFilter,
    tagFilter,
    node("button", {
      class: "secondary",
      type: "button",
      onClick: async () => {
        try {
          await persistPoolDraft(editor);
          openPoolImport(draft.id);
        } catch (error) {
          editor.error = error?.message || "Could not save before import.";
          render();
        }
      }
    }, "Import")
  ]));

  const fieldsBox = node("section", { class: "pool-fields-box" }, [
    node("div", { class: "pool-section-head" }, [
      node("strong", { text: "Structured fields" }),
      node("span", {
        text: draft.fields.length
          ? "Custom data travels with each item."
          : "Optional metadata for future rules and balancing."
      })
    ])
  ]);

  if (draft.fields.length) {
    fieldsBox.append(node("div", { class: "field-chip-row" },
      draft.fields.map((field) =>
        node("span", { class: "field-chip" }, [
          node("span", { text: field.name + " · " + field.type }),
          node("button", {
            type: "button",
            "aria-label": "Remove field " + field.name,
            onClick: () => {
              draft.fields = draft.fields.filter((item) => item.id !== field.id);
              for (const poolItem of draft.items) {
                delete poolItem.values[field.id];
              }
              render();
            }
          }, "×")
        ])
      )
    ));
  }

  const newFieldName = node("input", {
    class: "field",
    placeholder: "Field name",
    "aria-label": "New field name"
  });
  const newFieldType = node("select", {
    class: "field",
    "aria-label": "New field type"
  }, ["text", "number", "boolean", "category"].map((value) =>
    node("option", { value, text: value })
  ));

  fieldsBox.append(node("div", { class: "field-add-row" }, [
    newFieldName,
    newFieldType,
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        try {
          draft.fields.push(createPoolField(newFieldName.value, newFieldType.value));
          render();
        } catch (error) {
          editor.error = error.message;
          render();
        }
      }
    }, "Add field")
  ]));
  modal.append(fieldsBox);

  const profileName = node("input", {
    class: "field",
    placeholder: "Weight profile name",
    "aria-label": "Weight profile name"
  });

  const profilesBox = node("section", { class: "pool-profiles-box" }, [
    node("div", { class: "pool-section-head" }, [
      node("strong", { text: "Weight profiles" }),
      node("span", {
        text: "Save reusable default-weight sets without changing other item data."
      })
    ]),
    node("div", { class: "pool-profile-create" }, [
      profileName,
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => {
          const name = profileName.value.trim();
          if (!name) {
            editor.error = "Weight profile name is required.";
            render();
            return;
          }
          draft.weightProfiles.push({
            id: crypto.randomUUID(),
            name,
            weights: Object.fromEntries(
              draft.items.map((item) => [item.id, item.weight])
            )
          });
          render();
        }
      }, "Save weights")
    ])
  ]);

  if (draft.weightProfiles.length) {
    profilesBox.append(node("div", { class: "pool-profile-list" },
      draft.weightProfiles.map((profile) =>
        node("div", { class: "pool-profile-item" }, [
          node("span", { text: profile.name }),
          node("button", {
            class: "small-action",
            type: "button",
            onClick: () => {
              draft.items.forEach((item) => {
                const value = Number(profile.weights?.[item.id]);
                if (Number.isFinite(value) && value >= 0) item.weight = value;
              });
              render();
            }
          }, "Apply"),
          node("button", {
            class: "small-action",
            type: "button",
            onClick: () => {
              draft.weightProfiles = draft.weightProfiles.filter(
                (item) => item.id !== profile.id
              );
              render();
            }
          }, "Remove")
        ])
      )
    ));
  }

  modal.append(profilesBox);

  const visibleIds = new Set(
    filterPoolItems(draft, {
      search: editor.search,
      active: editor.active,
      tags: editor.tagFilter ? [editor.tagFilter] : []
    }).map((item) => item.id)
  );
  const visible = draft.items.filter((item) => visibleIds.has(item.id));

  const selected = editor.selected;
  const bulkTag = node("input", {
    class: "field bulk-tag-input",
    placeholder: "Tag selected",
    "aria-label": "Tag selected items"
  });

  modal.append(node("div", { class: "pool-bulk-bar" }, [
    node("span", {
      text: selected.size + " selected · " + visible.length + " visible"
    }),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        visible.forEach((item) => selected.add(item.id));
        render();
      }
    }, "Select visible"),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        selected.clear();
        render();
      }
    }, "Clear"),
    node("button", {
      class: "small-action",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        draft.items.forEach((item) => {
          if (selected.has(item.id)) item.active = true;
        });
        render();
      }
    }, "Activate"),
    node("button", {
      class: "small-action",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        draft.items.forEach((item) => {
          if (selected.has(item.id)) item.active = false;
        });
        render();
      }
    }, "Deactivate"),
    bulkTag,
    node("button", {
      class: "small-action",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        const value = bulkTag.value.trim();
        if (!value) return;
        draft.items.forEach((item) => {
          if (selected.has(item.id) && !item.tags.includes(value)) {
            item.tags.push(value);
          }
        });
        render();
      }
    }, "Add tag"),
    node("button", {
      class: "small-action danger-lite",
      type: "button",
      disabled: selected.size ? null : "disabled",
      onClick: () => {
        draft.items = draft.items.filter((item) => !selected.has(item.id));
        selected.clear();
        render();
      }
    }, "Remove")
  ]));

  const table = node("div", { class: "pool-editor-table" });
  for (const item of visible) {
    const selectItem = node("input", {
      type: "checkbox",
      checked: selected.has(item.id),
      "aria-label": "Select " + item.label
    });
    selectItem.addEventListener("change", () => {
      if (selectItem.checked) selected.add(item.id);
      else selected.delete(item.id);
    });

    const active = node("input", {
      type: "checkbox",
      checked: item.active,
      "aria-label": "Active " + item.label
    });
    active.addEventListener("change", () => {
      item.active = active.checked;
    });

    const label = node("input", {
      class: "pool-cell-input pool-label-input",
      value: item.label,
      "aria-label": "Item label"
    });
    label.addEventListener("input", () => {
      item.label = label.value;
    });

    const weight = node("input", {
      class: "pool-cell-input pool-weight-input",
      type: "number",
      min: "0",
      step: "0.1",
      value: String(item.weight),
      "aria-label": "Default weight for " + item.label
    });
    weight.addEventListener("change", () => {
      const value = Number(weight.value);
      item.weight = Number.isFinite(value) && value >= 0 ? value : 1;
      weight.value = String(item.weight);
    });

    const tags = node("input", {
      class: "pool-cell-input pool-tags-input",
      value: item.tags.join(", "),
      placeholder: "tags",
      "aria-label": "Tags for " + item.label
    });
    tags.addEventListener("change", () => {
      item.tags = Array.from(new Set(
        tags.value.split(",").map((tag) => tag.trim()).filter(Boolean)
      ));
    });

    table.append(node("div", {
      class: "pool-editor-row" + (!item.active ? " is-inactive" : ""),
      style: {
        gridTemplateColumns:
          "28px 28px minmax(130px,1.4fr) 80px minmax(120px,1fr) "
          + "minmax(100px,1fr) ".repeat(draft.fields.length)
          + "40px"
      }
    }, [
      node("label", { class: "pool-select-cell" }, [selectItem]),
      node("label", { class: "pool-active-cell" }, [
        active,
        node("span", { class: "sr-only", text: "Active" })
      ]),
      label,
      weight,
      tags,
      ...draft.fields.map((field) => poolEditorFieldInput(field, item, editor)),
      node("button", {
        class: "small-action",
        type: "button",
        "aria-label": "Remove " + item.label,
        onClick: () => {
          draft.items = draft.items.filter((candidate) => candidate.id !== item.id);
          selected.delete(item.id);
          render();
        }
      }, "×")
    ]));
  }

  if (!visible.length) {
    table.append(emptyState(
      "No items match",
      "Change the filters or add another item."
    ));
  }

  modal.append(table);

  const newItem = node("input", {
    class: "field",
    placeholder: "Add item…",
    "aria-label": "New Pool item"
  });
  const addItem = () => {
    try {
      draft.items.push(createPoolItem(newItem.value));
      render();
    } catch (error) {
      editor.error = error.message;
      render();
    }
  };
  newItem.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  });

  modal.append(node("div", { class: "pool-add-item-row" }, [
    newItem,
    node("button", {
      class: "secondary",
      type: "button",
      onClick: addItem
    }, "Add item")
  ]));

  const existingViews = poolViewsFor(draft.id);
  const viewName = node("input", {
    class: "field",
    placeholder: "View name",
    value: editor.viewName,
    "aria-label": "New View name"
  });
  viewName.addEventListener("input", () => {
    editor.viewName = viewName.value;
  });

  const viewsBox = node("section", { class: "pool-views-box" }, [
    node("div", { class: "pool-section-head" }, [
      node("strong", { text: "Views" }),
      node("span", {
        text: "Save this filter dynamically or freeze the selected item IDs."
      })
    ]),
    node("div", { class: "pool-view-create" }, [
      viewName,
      node("button", {
        class: "small-action",
        type: "button",
        onClick: async () => {
          try {
            await persistPoolDraft(editor);
            const view = createPoolView({
              name: editor.viewName,
              poolId: editor.draft.id,
              mode: "dynamic",
              filters: {
                search: editor.search,
                active: editor.active === "all" ? "active" : editor.active,
                tags: editor.tagFilter ? [editor.tagFilter] : []
              }
            });
            await put("poolViews", view);
            state.poolViews.push(view);
            editor.viewName = "";
            render();
          } catch (error) {
            editor.error = error.message;
            render();
          }
        }
      }, "Save filter"),
      node("button", {
        class: "small-action",
        type: "button",
        disabled: selected.size ? null : "disabled",
        onClick: async () => {
          try {
            await persistPoolDraft(editor);
            const view = createPoolView({
              name: editor.viewName,
              poolId: editor.draft.id,
              mode: "static",
              itemIds: [...selected]
            });
            await put("poolViews", view);
            state.poolViews.push(view);
            editor.viewName = "";
            render();
          } catch (error) {
            editor.error = error.message;
            render();
          }
        }
      }, "Save selected")
    ])
  ]);

  if (existingViews.length) {
    viewsBox.append(node("div", { class: "pool-view-list" },
      existingViews.map((view) =>
        node("div", { class: "pool-view-item" }, [
          node("span", {
            text: view.name + " · " + (view.mode === "static" ? "static" : "dynamic")
          }),
          node("span", {
            text: resolvePoolView(draft, view).length + " active items"
          }),
          node("button", {
            class: "small-action",
            type: "button",
            onClick: async () => {
              await remove("poolViews", view.id);
              state.poolViews = state.poolViews.filter((item) => item.id !== view.id);
              render();
            }
          }, "Remove")
        ])
      )
    ));
  }
  modal.append(viewsBox);

  modal.append(node("div", { class: "pool-editor-footer" }, [
    node("button", {
      class: "danger",
      type: "button",
      onClick: async () => {
        if (!confirm("Permanently delete “" + draft.name + "”? Existing tool WorkingSets keep their copied data, but the source Pool and its Views will be removed.")) {
          return;
        }
        await remove("pools", draft.id);
        const views = poolViewsFor(draft.id);
        await Promise.all(views.map((view) => remove("poolViews", view.id)));
        state.poolViews = state.poolViews.filter((view) => view.poolId !== draft.id);
        state.pools = state.pools.filter((pool) => pool.id !== draft.id);
        state.modal = null;
        render();
      }
    }, "Delete permanently"),
    node("span", { class: "pool-editor-footer-spacer" }),
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Cancel"),
    node("button", {
      class: "primary",
      type: "button",
      onClick: async () => {
        try {
          const saved = await persistPoolDraft(editor);
          announce(saved.name + " saved at revision " + saved.revision + ".");
          state.modal = null;
          render();
        } catch (error) {
          editor.error = error?.name === "RevisionConflictError"
            ? "This Pool changed elsewhere. Close the editor and reopen the latest revision."
            : error?.message || "Could not save Pool.";
          render();
        }
      }
    }, "Save Pool")
  ]));
}

function renderPoolImportModal(modal, importer) {
  modal.classList.add("pool-import-modal");
  const sourcePool = importer.poolId ? poolById(importer.poolId) : null;

  modal.append(
    node("h2", {
      text: sourcePool ? "Import into " + sourcePool.name : "Import Pool"
    }),
    node("p", {
      text: "Paste CSV, TSV, or semicolon-delimited data. Special columns: label/name, weight, active, tags. Other columns become structured text fields."
    })
  );

  if (importer.error) modal.append(toolError(importer.error));

  if (!sourcePool) {
    const name = node("input", {
      class: "field",
      value: importer.poolName,
      placeholder: "Pool name",
      "aria-label": "Imported Pool name"
    });
    name.addEventListener("input", () => {
      importer.poolName = name.value;
    });
    modal.append(name);
  }

  if (sourcePool) {
    const mode = node("select", {
      class: "field",
      "aria-label": "Import mode"
    }, [
      node("option", { value: "append", text: "Append to current items" }),
      node("option", { value: "replace", text: "Replace all current items" })
    ]);
    mode.value = importer.mode;
    mode.addEventListener("change", () => {
      importer.mode = mode.value;
    });
    modal.append(mode);
  }

  const header = node("select", {
    class: "field",
    "aria-label": "Header row"
  }, [
    node("option", { value: "auto", text: "Detect header automatically" }),
    node("option", { value: "yes", text: "First row is header" }),
    node("option", { value: "no", text: "No header row" })
  ]);
  header.value = importer.hasHeader;
  header.addEventListener("change", () => {
    importer.hasHeader = header.value;
    importer.preview = null;
  });

  const input = node("textarea", {
    class: "field pool-import-text",
    placeholder: "name,weight,active,tags\nAnna,2,true,leader\nBen,1,true,guest",
    "aria-label": "CSV or spreadsheet data"
  });
  input.value = importer.text;
  input.addEventListener("input", () => {
    importer.text = input.value;
    importer.preview = null;
  });

  const buildPreview = () => {
    try {
      const hasHeader = importer.hasHeader === "auto"
        ? null
        : importer.hasHeader === "yes";
      importer.preview = parseDelimitedText(importer.text, { hasHeader });
      importer.error = null;
      render();
    } catch (error) {
      importer.error = error.message;
      importer.preview = null;
      render();
    }
  };

  modal.append(
    node("div", { class: "pool-import-options" }, [header]),
    input,
    node("div", { class: "button-row" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: buildPreview
      }, "Preview import")
    ])
  );

  if (importer.preview) {
    const preview = importer.preview;
    modal.append(node("section", { class: "pool-import-preview" }, [
      node("strong", {
        text: preview.rows.length + " data rows · " + preview.headers.length + " columns"
      }),
      node("div", { class: "field-chip-row" },
        preview.headers.map((name) => node("span", { class: "field-chip", text: name }))
      ),
      node("div", { class: "import-preview-table" },
        preview.rows.slice(0, 5).map((row) =>
          node("div", { class: "import-preview-row" },
            row.map((value) => node("span", { text: value }))
          )
        )
      )
    ]));
  }

  modal.append(node("div", { class: "modal-actions" }, [
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Cancel"),
    node("button", {
      class: "primary",
      type: "button",
      onClick: async () => {
        try {
          const hasHeader = importer.hasHeader === "auto"
            ? null
            : importer.hasHeader === "yes";
          const parsed = parseDelimitedText(importer.text, { hasHeader });
          if (!parsed.rows.length) throw new Error("No import rows found.");

          let pool = sourcePool
            ? normalizePool(sourcePool)
            : createPool({ name: importer.poolName, items: [] });

          const special = new Set(["label", "name", "weight", "active", "tag", "tags"]);
          const fieldColumns = {};
          const fields = [...pool.fields];

          for (const headerName of parsed.headers) {
            if (special.has(headerName.toLocaleLowerCase())) continue;
            let field = fields.find((candidate) =>
              candidate.name.toLocaleLowerCase() === headerName.toLocaleLowerCase()
            );
            if (!field) {
              field = createPoolField(headerName, "text");
              fields.push(field);
            }
            fieldColumns[field.id] = headerName;
          }

          const items = importRowsToPoolItems(parsed, { fieldColumns });
          if (!items.length) throw new Error("No labeled items were found.");

          if (sourcePool) {
            const next = mutatePool(pool, (draft) => {
              draft.fields = fields;
              draft.items = importer.mode === "replace"
                ? items
                : [...draft.items, ...items];
            });
            await putWithRevision("pools", next, sourcePool.revision);
            state.pools = state.pools.map((item) => item.id === next.id ? next : item);
            state.modal = null;
            openPoolEditor(next.id);
          } else {
            pool = normalizePool({
              ...pool,
              fields,
              items,
              revision: 1
            });
            await put("pools", pool);
            state.pools.unshift(pool);
            requestPersistentStorage();
            state.modal = null;
            openPoolEditor(pool.id);
          }
        } catch (error) {
          importer.error = error?.message || "Could not import data.";
          render();
        }
      }
    }, sourcePool ? "Import items" : "Create Pool")
  ]));
}

function renderSaveToolPoolModal(modal, config) {
  const ts = ensureToolState(config.toolId);
  const tool = getTool(config.toolId);
  const name = node("input", {
    class: "field",
    placeholder: "Pool name",
    value: config.name,
    "aria-label": "Pool name"
  });
  name.addEventListener("input", () => {
    config.name = name.value;
  });

  const kind = node("select", {
    class: "field",
    "aria-label": "Pool kind"
  }, ["generic", "people", "choices", "tasks"].map((value) =>
    node("option", { value, text: value })
  ));
  kind.value = config.kind;
  kind.addEventListener("change", () => {
    config.kind = kind.value;
  });

  modal.append(
    node("h2", { text: "Save current list as Pool" }),
    node("p", {
      text: "This saves the current run input as a reusable source. Later edits to the Pool will not rewrite this run automatically."
    }),
    name,
    kind,
    node("div", { class: "modal-actions" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => {
          state.modal = null;
          render();
        }
      }, "Cancel"),
      node("button", {
        class: "primary",
        type: "button",
        onClick: async () => {
          try {
            const labels = parseList(ts.listText);
            if (!labels.length) throw new Error("Current list is empty.");

            const weights = selectionTools.has(tool.id)
              ? reconcileSelectionEntries(labels, ts.selectionEntries || [])
              : labels.map(() => ({ weight: 1 }));

            const pool = createPool({
              name: config.name,
              kind: config.kind,
              items: labels.map((label, index) => ({
                label,
                weight: weights[index]?.weight ?? 1,
                active: true
              }))
            });

            await put("pools", pool);
            state.pools.unshift(pool);
            applyWorkingSetToTool(tool.id, ts, createWorkingSet(pool));
            ts.workingSetDirty = false;
            requestPersistentStorage();
            state.modal = null;
            render();
          } catch (error) {
            config.error = error.message;
            render();
          }
        }
      }, "Save Pool")
    ])
  );

  if (config.error) modal.prepend(toolError(config.error));
}

function renderAddRuleModal(modal, config) {
  const tool = getTool(config.toolId);
  const ts = ensureToolState(config.toolId);
  const { context } = constraintValidation(tool, ts);
  const types = ruleTypesForTool(tool.id);

  modal.classList.add("rule-builder-modal");
  modal.append(
    node("h2", { text: "Add rule" }),
    node("p", {
      text: "Required rules must always be satisfied. Prefer rules only rank otherwise-valid results."
    })
  );

  if (config.error) modal.append(toolError(config.error));

  const typeSelect = node("select", {
    class: "field",
    "aria-label": "Rule type"
  }, types.map((type) =>
    node("option", { value: type, text: ruleTypeLabel(type) })
  ));
  typeSelect.value = config.ruleType;
  typeSelect.addEventListener("change", () => {
    config.ruleType = typeSelect.value;
    if (config.ruleType === "balanceField" || config.ruleType === "historyAvoid") {
      config.strength = "soft";
    }
    config.error = null;
    render();
  });

  const softOnly = config.ruleType === "balanceField";
  const strength = node("select", {
    class: "field",
    "aria-label": "Rule strength",
    disabled: softOnly ? "disabled" : null
  }, softOnly
    ? [node("option", { value: "soft", text: "Prefer" })]
    : [
        node("option", { value: "hard", text: "Required" }),
        node("option", { value: "soft", text: "Prefer" })
      ]
  );
  strength.value = softOnly ? "soft" : config.strength;
  strength.addEventListener("change", () => {
    config.strength = strength.value;
    render();
  });

  modal.append(node("div", { class: "rule-builder-grid" }, [
    node("div", { class: "control" }, [
      node("label", { text: "Rule" }),
      typeSelect
    ]),
    node("div", { class: "control" }, [
      node("label", { text: "Strength" }),
      strength
    ])
  ]));

  const body = node("div", { class: "rule-builder-body" });

  const itemSelect = (label, current, onChange) => {
    const select = node("select", {
      class: "field",
      "aria-label": label
    }, context.items.map((item) =>
      node("option", { value: item.id, text: item.label })
    ));
    select.value = current || context.items[0]?.id || "";
    select.addEventListener("change", () => onChange(select.value));
    return node("div", { class: "control" }, [
      node("label", { text: label }),
      select
    ]);
  };

  if (config.ruleType === "together" || config.ruleType === "apart") {
    body.append(
      itemSelect("Item A", config.itemA, (value) => { config.itemA = value; }),
      itemSelect("Item B", config.itemB, (value) => { config.itemB = value; })
    );
  } else if (config.ruleType === "fixed") {
    body.append(
      itemSelect("Item", config.itemA, (value) => { config.itemA = value; })
    );
    const target = node("select", {
      class: "field",
      "aria-label": "Target"
    }, context.targets.map((item) =>
      node("option", { value: item.id, text: item.label })
    ));
    target.value = config.targetId || context.targets[0]?.id || "";
    target.addEventListener("change", () => { config.targetId = target.value; });
    body.append(node("div", { class: "control" }, [
      node("label", { text: "Target" }),
      target
    ]));
  } else if (config.ruleType === "capacity") {
    const max = node("input", {
      class: "field",
      type: "number",
      min: "1",
      value: String(config.max || 1),
      "aria-label": "Maximum items per target"
    });
    max.addEventListener("input", () => { config.max = Number(max.value); });
    body.append(node("div", { class: "control" }, [
      node("label", { text: "Maximum per target" }),
      max
    ]));
  } else if (config.ruleType === "requiredTag" || config.ruleType === "maxTag") {
    const tags = Array.from(new Set(context.items.flatMap((item) => item.tags || []))).sort();
    const tag = node("input", {
      class: "field",
      list: "rule-tags",
      value: config.tag,
      placeholder: tags[0] || "leader",
      "aria-label": "Tag"
    });
    tag.addEventListener("input", () => { config.tag = tag.value; });

    const data = node("datalist", { id: "rule-tags" },
      tags.map((value) => node("option", { value }))
    );

    const count = node("input", {
      class: "field",
      type: "number",
      min: "0",
      value: String(config.count ?? 1),
      "aria-label": "Tag count"
    });
    count.addEventListener("input", () => { config.count = Number(count.value); });

    body.append(
      node("div", { class: "control" }, [
        node("label", { text: "Tag" }),
        tag,
        data
      ]),
      node("div", { class: "control" }, [
        node("label", {
          text: config.ruleType === "requiredTag"
            ? "Minimum per target"
            : "Maximum per target"
        }),
        count
      ])
    );
  } else if (config.ruleType === "balanceField") {
    const numericFields = context.fields.filter((field) => field.type === "number");
    if (!numericFields.length) {
      body.append(node("div", { class: "constraint-validation is-warning" }, [
        node("strong", { text: "No numeric Pool fields" }),
        node("span", {
          text: "Add a Number field to the source Pool, refresh this WorkingSet, then add a balance rule."
        })
      ]));
    } else {
      const field = node("select", {
        class: "field",
        "aria-label": "Numeric field"
      }, numericFields.map((item) =>
        node("option", { value: item.id, text: item.name })
      ));
      field.value = config.fieldId || numericFields[0].id;
      field.addEventListener("change", () => { config.fieldId = field.value; });
      body.append(node("div", { class: "control" }, [
        node("label", { text: "Field to balance" }),
        field
      ]));
    }
  } else if (config.ruleType === "historyAvoid") {
    const depth = node("input", {
      class: "field",
      type: "number",
      min: "1",
      max: "100",
      value: String(config.depth || 5),
      "aria-label": "Recent run depth"
    });
    depth.addEventListener("input", () => { config.depth = Number(depth.value); });
    body.append(node("div", { class: "control" }, [
      node("label", { text: "Look back this many runs" }),
      depth
    ]));
  }

  if (config.strength === "soft" || softOnly) {
    const priority = node("input", {
      class: "field",
      type: "number",
      min: "1",
      max: "100",
      value: String(config.priority || 10),
      "aria-label": "Preference priority"
    });
    priority.addEventListener("input", () => {
      config.priority = Number(priority.value);
    });
    body.append(node("div", { class: "control" }, [
      node("label", { text: "Preference priority" }),
      priority
    ]));
  }

  modal.append(body);

  modal.append(node("div", { class: "modal-actions" }, [
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Cancel"),
    node("button", {
      class: "primary",
      type: "button",
      onClick: () => {
        try {
          let params = {};

          if (config.ruleType === "together" || config.ruleType === "apart") {
            if (!config.itemA || !config.itemB || config.itemA === config.itemB) {
              throw new Error("Choose two different items.");
            }
            params = { itemIds: [config.itemA, config.itemB] };
          } else if (config.ruleType === "fixed") {
            if (!config.itemA || !config.targetId) {
              throw new Error("Choose both an item and a target.");
            }
            params = { itemId: config.itemA, targetId: config.targetId };
          } else if (config.ruleType === "capacity") {
            params = { max: Number(config.max) };
          } else if (config.ruleType === "requiredTag" || config.ruleType === "maxTag") {
            params = { tag: String(config.tag || "").trim(), count: Number(config.count) };
          } else if (config.ruleType === "balanceField") {
            if (!config.fieldId) throw new Error("Choose a numeric field.");
            params = { fieldId: config.fieldId };
          } else if (config.ruleType === "historyAvoid") {
            params = { depth: Number(config.depth) };
          }

          const rule = createRule(config.ruleType, params, {
            strength: softOnly ? "soft" : config.strength,
            priority: config.priority
          });
          ts.rules.push(rule);
          invalidateTool(tool.id, ts);
          state.modal = null;
          render();
        } catch (error) {
          config.error = error?.message || "Could not add rule.";
          render();
        }
      }
    }, "Add rule")
  ]));
}

function renderSavePresetModal(modal, config) {
  const tool = getTool(config.toolId);
  const ts = ensureToolState(config.toolId);
  const source = ts.workingSet?.source || null;

  modal.classList.add("setup-modal");
  modal.append(
    node("h2", { text: "Save Preset" }),
    node("p", {
      text: "A Preset saves tool configuration. Choose whether its input stays live, is frozen now, or is requested fresh each time."
    })
  );

  if (config.error) modal.append(toolError(config.error));

  const name = node("input", {
    class: "field",
    placeholder: "Preset name",
    value: config.name,
    "aria-label": "Preset name"
  });
  name.addEventListener("input", () => { config.name = name.value; });

  const description = node("input", {
    class: "field",
    placeholder: "Description (optional)",
    value: config.description,
    "aria-label": "Preset description"
  });
  description.addEventListener("input", () => {
    config.description = description.value;
  });

  const options = [];
  if (listInputTools.has(tool.id)) {
    if (source?.poolId) {
      options.push(
        node("option", {
          value: "live-source",
          text: source.viewId ? "Live View" : "Live Pool"
        })
      );
    }
    options.push(
      node("option", { value: "frozen", text: "Freeze current input" }),
      node("option", { value: "prompt", text: "Ask for fresh input" })
    );
  } else {
    options.push(node("option", {
      value: "none",
      text: "No list input"
    }));
  }

  const binding = node("select", {
    class: "field",
    "aria-label": "Preset input binding"
  }, options);
  binding.value = config.bindingMode;
  binding.addEventListener("change", () => {
    config.bindingMode = binding.value;
  });

  const favorite = node("input", {
    type: "checkbox",
    checked: config.favorite,
    "aria-label": "Favorite Preset"
  });
  favorite.addEventListener("change", () => {
    config.favorite = favorite.checked;
  });

  const sourcePoolId = source?.poolId || null;
  const compatibleSets = state.ruleSets.filter((ruleSet) =>
    ruleSetCompatible(ruleSet, {
      toolId: tool.id,
      sourcePoolId
    })
  );

  const ruleSetSelect = node("select", {
    class: "field",
    "aria-label": "Saved Rule Set"
  }, [
    node("option", { value: "", text: "Keep current rules in Preset" }),
    ...compatibleSets.map((ruleSet) =>
      node("option", { value: ruleSet.id, text: ruleSet.name })
    )
  ]);
  ruleSetSelect.value = config.ruleSetId || "";
  ruleSetSelect.addEventListener("change", () => {
    config.ruleSetId = ruleSetSelect.value || null;
  });

  modal.append(
    name,
    description,
    binding,
    constraintTools.has(tool.id) ? ruleSetSelect : null,
    node("label", { class: "settings-sound-toggle setup-favorite-toggle" }, [
      favorite,
      node("span", { text: "Favorite Preset" })
    ])
  );

  modal.append(node("div", { class: "modal-actions" }, [
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Cancel"),
    node("button", {
      class: "primary",
      type: "button",
      onClick: async () => {
        try {
          let inputBinding = { mode: "none" };

          if (config.bindingMode === "live-source") {
            if (!source?.poolId) {
              throw new Error("No live Pool or View is attached.");
            }
            inputBinding = source.viewId
              ? {
                  mode: "live-view",
                  poolId: source.poolId,
                  viewId: source.viewId
                }
              : {
                  mode: "live-pool",
                  poolId: source.poolId
                };
          } else if (config.bindingMode === "frozen") {
            inputBinding = {
              mode: "frozen",
              items: frozenPresetItems(tool.id, ts),
              fields: cloneData(ts.workingSet?.fields || []),
              sourceLabel: source?.name || "Frozen input"
            };
          } else if (config.bindingMode === "prompt") {
            inputBinding = { mode: "prompt" };
          }

          const preset = createPreset({
            name: config.name,
            description: config.description,
            toolId: tool.id,
            inputBinding,
            configSnapshot: presetConfigSnapshot(tool.id, ts),
            rulesSnapshot: cloneData(ts.rules || []),
            ruleSetId: config.ruleSetId,
            favorite: config.favorite
          });

          await put("presets", preset);
          state.presets = [preset, ...state.presets];
          ts.activePresetId = preset.id;
          state.modal = null;
          render();
          announce("Preset saved.");
        } catch (error) {
          config.error = error?.message || "Could not save Preset.";
          render();
        }
      }
    }, "Save Preset")
  ]));
}

function renderPresetDetailModal(modal, config) {
  const preset = presetById(config.presetId);
  if (!preset) {
    modal.append(node("h2", { text: "Preset unavailable" }));
    return;
  }

  const tool = getTool(preset.toolId);
  modal.append(
    node("h2", { text: preset.name }),
    node("p", {
      text:
        (tool?.name || preset.toolId)
        + " · "
        + preset.inputBinding.mode
    })
  );

  if (preset.description) {
    modal.append(node("div", {
      class: "notice",
      text: preset.description
    }));
  }

  modal.append(node("div", { class: "modal-actions" }, [
    node("button", {
      class: "primary",
      type: "button",
      onClick: () => applyPresetToTool(preset)
    }, "Play"),
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => togglePresetFavorite(preset)
    }, preset.favorite ? "Unfavorite" : "Favorite"),
    node("button", {
      class: "danger",
      type: "button",
      onClick: async () => {
        const removed = await deletePreset(preset);
        if (!removed) return;
        state.modal = null;
        render();
      }
    }, "Delete"),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Close")
  ]));
}

function renderSaveRuleSetModal(modal, config) {
  const tool = getTool(config.toolId);
  const ts = ensureToolState(config.toolId);
  const source = ts.workingSet?.source || null;

  modal.append(
    node("h2", { text: "Save Rule Set" }),
    node("p", {
      text: "Portable sets use only general rules. Item- or field-specific rules stay tied to their source Pool."
    })
  );

  if (config.error) modal.append(toolError(config.error));

  const name = node("input", {
    class: "field",
    placeholder: "Rule Set name",
    value: config.name,
    "aria-label": "Rule Set name"
  });
  name.addEventListener("input", () => { config.name = name.value; });

  modal.append(name);

  modal.append(node("div", { class: "modal-actions" }, [
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Cancel"),
    node("button", {
      class: "primary",
      type: "button",
      onClick: async () => {
        try {
          const ruleSet = createRuleSet({
            name: config.name,
            toolId: tool.id,
            rules: ts.rules,
            sourcePoolId: source?.poolId || null,
            sourcePoolRevision: source?.revision || null,
            favorite: config.favorite
          });
          await put("ruleSets", ruleSet);
          state.ruleSets = [ruleSet, ...state.ruleSets];
          state.modal = null;
          render();
          announce("Rule Set saved.");
        } catch (error) {
          config.error = error?.message || "Could not save Rule Set.";
          render();
        }
      }
    }, "Save Rule Set")
  ]));
}

function renderUseResultModal(modal, config) {
  const items = resultToItems(config.sourceToolId, config.result);
  const targets = [...listInputTools]
    .filter((id) => id !== config.sourceToolId)
    .map(getTool)
    .filter(Boolean);

  modal.classList.add("use-result-modal");
  modal.append(
    node("h2", { text: "Use Result In…" }),
    node("p", {
      text:
        items.length
        + " reusable item"
        + (items.length === 1 ? "" : "s")
        + " can be sent into another list-based tool."
    })
  );

  if (config.error) modal.append(toolError(config.error));

  if (items.length) {
    modal.append(node("div", { class: "use-result-preview" },
      items.slice(0, 10).map((item) =>
        node("span", { text: item })
      )
    ));
  }

  modal.append(node("div", { class: "tool-grid modal-tool-grid" },
    targets.map((tool) =>
      node("button", {
        class: "tool-card accent-" + tool.accent,
        type: "button",
        disabled: items.length ? null : "disabled",
        onClick: async () => {
          try {
            const targetState = ensureToolState(tool.id);

            if (
              targetState.activeSessionId
              && isStatefulTool(tool.id)
            ) {
              await endActiveSession(tool.id, "abandoned", true);
            }

            const next = ensureToolState(tool.id);
            next.listText = items.join("\n");
            next.workingSet = null;
            next.workingSetDirty = false;
            next.activePresetId = null;
            next.templateSessionId = null;
            next.templateStepIndex = null;
            next.templateStepId = null;
            invalidateTool(tool.id, next);
            if (selectionTools.has(tool.id)) {
              reconcileToolSelection(tool.id, next);
            }

            state.modal = null;
            openTool(tool.id);
          } catch (error) {
            config.error = error?.message || "Could not reuse result.";
            render();
          }
        }
      }, [
        node("span", {
          class: "tool-icon",
          text: tool.icon,
          "aria-hidden": "true"
        }),
        node("strong", { text: tool.name }),
        node("small", { text: tool.blurb })
      ])
    )
  ));
}

function renderNewSessionTemplateModal(modal, config) {
  modal.classList.add("template-builder-modal");
  modal.append(
    node("h2", { text: "New Session Template" }),
    node("p", {
      text: "Combine saved Presets into a linear session. A later step may replace its Preset input with the previous step's result."
    })
  );

  if (config.error) modal.append(toolError(config.error));

  if (!state.presets.length) {
    modal.append(node("div", {
      class: "constraint-validation is-warning"
    }, [
      node("strong", { text: "Save a Preset first" }),
      node("span", {
        text: "Custom Session Templates are built from saved Presets so each step has a reusable configuration."
      })
    ]));
  }

  const name = node("input", {
    class: "field",
    placeholder: "Template name",
    value: config.name,
    "aria-label": "Template name"
  });
  name.addEventListener("input", () => { config.name = name.value; });

  const description = node("input", {
    class: "field",
    placeholder: "Description (optional)",
    value: config.description,
    "aria-label": "Template description"
  });
  description.addEventListener("input", () => {
    config.description = description.value;
  });

  modal.append(name, description);

  const steps = node("div", { class: "template-builder-steps" });

  config.steps.forEach((step, index) => {
    const presetSelect = node("select", {
      class: "field",
      "aria-label": "Preset for step " + (index + 1)
    }, state.presets.map((preset) =>
      node("option", {
        value: preset.id,
        text:
          preset.name
          + " · "
          + (getTool(preset.toolId)?.name || preset.toolId)
      })
    ));
    presetSelect.value = step.presetId;
    presetSelect.addEventListener("change", () => {
      step.presetId = presetSelect.value;
    });

    const kinds = index === 0
      ? [
          ["preset", "Use Preset input"],
          ["prompt", "Ask for fresh input"]
        ]
      : [
          ["preset", "Use Preset input"],
          ["previous", "Previous result"],
          ["prompt", "Ask for fresh input"]
        ];

    const inputKind = node("select", {
      class: "field",
      "aria-label": "Input source for step " + (index + 1)
    }, kinds.map(([value, label]) =>
      node("option", { value, text: label })
    ));
    inputKind.value = step.inputKind;
    inputKind.addEventListener("change", () => {
      step.inputKind = inputKind.value;
    });

    steps.append(node("div", { class: "template-builder-step" }, [
      node("span", {
        class: "template-step-number",
        text: String(index + 1)
      }),
      presetSelect,
      inputKind,
      node("div", { class: "template-builder-step-actions" }, [
        index > 0
          ? node("button", {
              class: "small-action",
              type: "button",
              "aria-label": "Move step up",
              onClick: () => {
                const previous = config.steps[index - 1];
                config.steps[index - 1] = config.steps[index];
                config.steps[index] = previous;
                render();
              }
            }, "↑")
          : null,
        index < config.steps.length - 1
          ? node("button", {
              class: "small-action",
              type: "button",
              "aria-label": "Move step down",
              onClick: () => {
                const following = config.steps[index + 1];
                config.steps[index + 1] = config.steps[index];
                config.steps[index] = following;
                render();
              }
            }, "↓")
          : null,
        config.steps.length > 1
          ? node("button", {
              class: "small-action",
              type: "button",
              onClick: () => {
                config.steps.splice(index, 1);
                render();
              }
            }, "×")
          : null
      ])
    ]));
  });

  modal.append(
    steps,
    node("button", {
      class: "small-action",
      type: "button",
      disabled:
        config.steps.length >= 8 || !state.presets.length
          ? "disabled"
          : null,
      onClick: () => {
        config.steps.push({
          presetId: state.presets[0]?.id || "",
          inputKind: config.steps.length ? "previous" : "preset"
        });
        render();
      }
    }, "+ Add step")
  );

  modal.append(node("div", { class: "modal-actions" }, [
    node("button", {
      class: "secondary",
      type: "button",
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Cancel"),
    node("button", {
      class: "primary",
      type: "button",
      disabled: state.presets.length ? null : "disabled",
      onClick: async () => {
        try {
          if (!config.steps.length) throw new Error("Add at least one step.");

          const ids = config.steps.map(() => crypto.randomUUID());
          const definitions = config.steps.map((step, index) => {
            const preset = presetById(step.presetId);
            if (!preset) {
              throw new Error("Every step needs a saved Preset.");
            }

            const input = step.inputKind === "previous"
              ? {
                  kind: "previous",
                  sourceStepId: ids[index - 1]
                }
              : step.inputKind === "prompt"
                ? { kind: "prompt" }
                : {
                    kind: "preset",
                    presetId: preset.id
                  };

            return {
              id: ids[index],
              name: preset.name,
              toolId: preset.toolId,
              presetId: preset.id,
              input
            };
          });

          const template = createSessionTemplate({
            name: config.name,
            description: config.description,
            steps: definitions
          });

          await put("sessionTemplates", template);
          state.sessionTemplates = [template, ...state.sessionTemplates];
          state.modal = null;
          render();
          announce("Session Template saved.");
        } catch (error) {
          config.error = error?.message || "Could not save Template.";
          render();
        }
      }
    }, "Save Template")
  ]));
}

function renderRunDetailModal(modal, config) {
  const run = historyRunById(config.runId);
  if (!run) {
    modal.append(
      node("h2", { text: "Run unavailable" }),
      node("p", { text: "This History record could not be loaded." })
    );
    return;
  }

  modal.classList.add("run-detail-modal");

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "long"
  });

  modal.append(
    node("div", { class: "run-detail-title" }, [
      node("span", {
        class: "history-icon",
        text: run.icon || "✦"
      }),
      node("div", {}, [
        node("h2", { text: run.toolName || run.toolId }),
        node("span", {
          text: formatter.format(new Date(run.timestamp))
        })
      ])
    ]),
    node("div", { class: "run-detail-result" }, [
      node("span", { text: "Result" }),
      node("strong", { text: run.summary || "Stored result" })
    ])
  );

  const metadata = [
    ["Origin", run.origin || "local"],
    ["Run ID", run.id],
    ["Session", run.sessionId || "Standalone"],
    [
      "Template Session",
      run.templateSessionId
        ? run.templateSessionId
        : "None"
    ],
    [
      "Template Step",
      run.templateStepId || "None"
    ],
    [
      "Party Session",
      run.partySessionId || "None"
    ],
    ["Setup", run.setupFingerprint || "Legacy / unavailable"],
    [
      "Randomness",
      run.randomContext?.mode === "seeded"
        ? "Seeded · position " + run.randomContext.position
        : run.randomContext?.mode === "secure"
          ? "Secure random"
          : "Legacy / unavailable"
    ]
  ];

  modal.append(node("div", { class: "run-detail-meta" },
    metadata.map(([label, value]) =>
      node("div", {}, [
        node("span", { text: label }),
        node("strong", { text: String(value) })
      ])
    )
  ));

  if (run.detail) {
    modal.append(
      node("h3", { class: "run-detail-heading", text: "Stored details" }),
      node("pre", {
        class: "run-detail-json",
        text: JSON.stringify(run.detail, null, 2)
      })
    );
  }

  const actions = node("div", { class: "modal-actions" });

  if (run.origin !== "legacy" && run.afterState) {
    actions.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: () => replayStoredRun(run)
    }, "Replay"));
  }

  if (run.origin !== "legacy" && run.beforeState) {
    actions.append(node("button", {
      class: "primary",
      type: "button",
      onClick: () => rerunStoredRun(run)
    }, "Rerun"));
  }

  if (run.sessionId) {
    const session = sessionById(run.sessionId);
    if (session) {
      actions.append(node("button", {
        class: "secondary",
        type: "button",
        onClick: () => resumeStoredSession(session)
      }, session.status === "active" ? "Resume Session" : "Open Session"));
    }
  }

  actions.append(node("button", {
    class: "small-action",
    type: "button",
    onClick: () => {
      state.modal = null;
      render();
    }
  }, "Close"));

  modal.append(actions);
}

function renderModal() {
  if (!state.modal) return null;

  const backdrop = node("div", {
    class: "modal-backdrop",
    onClick: (event) => {
      if (event.target === backdrop) {
        if (typeof state.modal === "object" && state.modal.type === "pool-editor") {
          return;
        }
        state.modal = null;
        render();
      }
    }
  });

  const modal = node("section", {
    class: "modal",
    role: "dialog",
    "aria-modal": "true"
  });

  if (
    typeof state.modal === "object"
    && state.modal.type === "save-preset"
  ) {
    renderSavePresetModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "preset-detail"
  ) {
    renderPresetDetailModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "save-rule-set"
  ) {
    renderSaveRuleSetModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "use-result"
  ) {
    renderUseResultModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "new-session-template"
  ) {
    renderNewSessionTemplateModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "run-detail"
  ) {
    renderRunDetailModal(modal, state.modal);
  } else if (state.modal === "settings") {
    state.settings = normalizeExperienceSettings(state.settings);

    modal.append(
      node("h2", { text: "Randomness" }),
      node("p", {
        text: "Secure mode uses Web Crypto. Seeded mode gives a reproducible sequence for testing and shared challenges."
      })
    );

    const modes = node("div", { class: "segmented" });

    for (const mode of ["secure", "seeded"]) {
      modes.append(node("button", {
        class: state.settings.randomness.mode === mode ? "active" : "",
        type: "button",
        onClick: async () => {
          state.settings.randomness.mode = mode;
          if (mode === "seeded") state.settings.randomness.position = 0;
          await saveSettings(state.settings);
          render();
        }
      }, mode === "secure" ? "Secure" : "Seeded"));
    }

    modal.append(modes);

    if (state.settings.randomness.mode === "seeded") {
      const seed = node("input", {
        class: "field",
        value: state.settings.randomness.seed || "ARCADE-2026",
        "aria-label": "Seed",
        style: { marginTop: "12px" }
      });

      seed.addEventListener("change", async () => {
        state.settings.randomness.seed = seed.value || "ARCADE-2026";
        state.settings.randomness.position = 0;
        await saveSettings(state.settings);
      });

      modal.append(seed);
    }

    modal.append(
      node("h3", {
        class: "settings-section-title",
        text: "Presentation"
      }),
      node("p", {
        class: "settings-section-copy",
        text: "Game feel is presentation only. Results are already committed before reveal effects start."
      })
    );

    const revealModes = node("div", {
      class: "segmented settings-reveal-modes"
    }, [
      ["instant", "Instant"],
      ["normal", "Normal"],
      ["showtime", "Showtime"]
    ].map(([value, label]) =>
      node("button", {
        class:
          state.settings.presentation.mode === value
            ? "active"
            : "",
        type: "button",
        onClick: async () => {
          await updatePresentationSetting("mode", value);
          render();
        }
      }, label)
    ));
    modal.append(revealModes);

    const effects = node("select", {
      class: "field",
      "aria-label": "Effects quality"
    }, [
      node("option", { value: "auto", text: "Effects · Auto" }),
      node("option", { value: "low", text: "Effects · Low" }),
      node("option", { value: "high", text: "Effects · High" })
    ]);
    effects.value = state.settings.presentation.effects;
    effects.addEventListener("change", async () => {
      await updatePresentationSetting("effects", effects.value);
    });

    const haptics = node("select", {
      class: "field",
      "aria-label": "Haptic strength"
    }, [
      node("option", { value: "off", text: "Haptics · Off" }),
      node("option", { value: "light", text: "Haptics · Light" }),
      node("option", { value: "standard", text: "Haptics · Standard" }),
      node("option", { value: "strong", text: "Haptics · Strong" })
    ]);
    haptics.value = state.settings.presentation.haptics;
    haptics.addEventListener("change", async () => {
      await updatePresentationSetting("haptics", haptics.value);
    });

    const motion = node("select", {
      class: "field",
      "aria-label": "Motion preference"
    }, [
      node("option", { value: "system", text: "Motion · System" }),
      node("option", { value: "reduced", text: "Motion · Reduced" }),
      node("option", { value: "full", text: "Motion · Full" })
    ]);
    motion.value = state.settings.presentation.motion;
    motion.addEventListener("change", async () => {
      await updatePresentationSetting("motion", motion.value);
    });

    const sound = node("input", {
      type: "checkbox",
      checked: state.settings.presentation.sound,
      "aria-label": "Enable game sounds"
    });
    sound.addEventListener("change", async () => {
      await updatePresentationSetting("sound", sound.checked);
    });

    modal.append(
      node("div", { class: "settings-presentation-grid" }, [
        effects,
        haptics,
        motion,
        node("label", { class: "settings-sound-toggle" }, [
          sound,
          node("span", { text: "Game sounds" })
        ])
      ]),
      node("div", {
        class: "notice settings-performance-note",
        text: "Auto effects reduce particles and secondary effects on lower-end devices or when Reduced Motion is active."
      })
    );

    modal.append(node("div", { class: "modal-actions" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => {
          state.modal = null;
          render();
        }
      }, "Done")
    ]));
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "add-rule"
  ) {
    renderAddRuleModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "pool-editor"
  ) {
    renderPoolEditorModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "pool-import"
  ) {
    renderPoolImportModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "save-tool-pool"
  ) {
    renderSaveToolPoolModal(modal, state.modal);
  } else if (state.modal === "pool") {
    modal.append(
      node("h2", { text: "New Pool" }),
      node("p", {
        text: "Start with a quick pasted list. You can add tags, fields, weights, and Views after creation."
      })
    );

    const name = node("input", {
      class: "field",
      placeholder: "Pool name",
      "aria-label": "Pool name"
    });
    const description = node("input", {
      class: "field",
      placeholder: "Description (optional)",
      "aria-label": "Pool description"
    });
    const kind = node("select", {
      class: "field",
      "aria-label": "Pool kind"
    }, ["generic", "people", "choices", "tasks", "cards"].map((value) =>
      node("option", { value, text: value[0].toUpperCase() + value.slice(1) })
    ));
    const items = node("textarea", {
      class: "field",
      placeholder: "Anna\nBen\nDavid\nSarah",
      "aria-label": "Pool items"
    });
    const error = node("div", {
      class: "tool-error modal-error",
      role: "alert",
      hidden: "hidden"
    });

    modal.append(
      node("div", { class: "pool-create-grid" }, [
        name,
        kind,
        description
      ]),
      items,
      error
    );

    modal.append(node("div", { class: "modal-actions" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => {
          state.modal = null;
          render();
        }
      }, "Cancel"),
      node("button", {
        class: "primary",
        type: "button",
        onClick: async () => {
          try {
            const labels = parseList(items.value);
            if (!labels.length) throw new Error("Add at least one item.");
            const pool = createPool({
              name: name.value,
              description: description.value,
              kind: kind.value,
              labels
            });
            await put("pools", pool);
            state.pools.unshift(pool);
            requestPersistentStorage();
            state.modal = null;
            openPoolEditor(pool.id);
          } catch (failure) {
            error.hidden = false;
            error.replaceChildren(
              node("strong", { text: "Could not create Pool" }),
              node("span", { text: failure.message })
            );
          }
        }
      }, "Create Pool")
    ]));
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "use-pool"
  ) {
    const pool = state.pools.find((item) => item.id === state.modal.poolId);
    if (!pool) return null;

    modal.append(
      node("h2", { text: pool.name }),
      node("p", { text: "Choose a compatible randomizer." })
    );

    const choices = [
      "picker", "sampler", "wheel", "shuffle",
      "teams", "groups", "pairs", "assignment",
      "elimination", "ladder", "tournament", "secret-santa"
    ];

    modal.append(node("div", {
      class: "tool-grid modal-tool-grid"
    }, choices.map((id) => {
      const tool = getTool(id);
      return node("button", {
        class: "tool-card accent-" + tool.accent,
        type: "button",
        onClick: () => {
          const ts = ensureToolState(id);
          applyWorkingSetToTool(id, ts, createWorkingSet(pool));
          ts.workingSetDirty = false;
          state.modal = null;
          openTool(id);
        }
      }, [
        node("span", {
          class: "tool-icon",
          text: tool.icon,
          "aria-hidden": "true"
        }),
        node("strong", { text: tool.name }),
        node("small", { text: tool.blurb })
      ]);
    })));
  }

  backdrop.append(modal);
  return backdrop;
}

function render() {
  if (!state.settings) return;

  document.querySelectorAll(".modal-backdrop").forEach((item) => item.remove());

  if (state.view === "audience") {
    root.replaceChildren(renderAudience());
    return;
  }

  if (state.view === "party") {
    root.replaceChildren(renderParty());
    return;
  }

  const layout = node("div", { class: "layout" });
  layout.append(topBar());

  if (state.view === "play") layout.append(renderPlay());
  else if (state.view === "arcade") layout.append(renderArcade());
  else if (state.view === "pools") layout.append(renderPools());
  else if (state.view === "history") layout.append(renderHistory());
  else if (state.view === "studio") layout.append(renderStudio());
  else if (state.view === "template-session") layout.append(renderTemplateSession());
  else if (state.view === "tool") layout.append(renderTool());

  layout.append(bottomNav());
  root.replaceChildren(layout);

  const modal = renderModal();
  if (modal) document.body.append(modal);
}

async function init() {
  const params = new URLSearchParams(location.search);
  const requestedAudience = params.get("audience");

  if (requestedAudience) {
    state.settings = normalizeExperienceSettings({});
    state.audiencePartyId = requestedAudience;
    state.view = "audience";
    state.toolId = null;

    const channel = partyChannelFor(requestedAudience);
    if (channel) {
      channel.onmessage = (event) => {
        const payload = event.data;
        if (
          payload
          && payload.schemaVersion === 1
          && payload.partyId === requestedAudience
          && payload.tool
        ) {
          state.audienceState = cloneData(payload);
          render();
        }
      };

      channel.postMessage({
        type: "party-state-request",
        partyId: requestedAudience
      });
    }

    render();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    return;
  }

  await loadData();

  const requestedParty = params.get("party");
  const requestedTemplateSession = params.get("templateSession");
  const requestedTool = params.get("tool");

  if (
    requestedParty
    && partySessionById(requestedParty)?.status === "active"
  ) {
    const party = partySessionById(requestedParty);
    state.activePartySessionId = party.id;
    state.view = "party";
    state.toolId = party.toolId;
    const latest = latestPartyRun(party);
    if (latest?.afterState) {
      restoreToolSnapshot(party.toolId, latest.afterState);
    } else {
      ensureToolState(party.toolId);
    }
    maybeResumeLatestSession(party.toolId);
    if (party.options.wakeLock) requestPartyWakeLock(party);
    broadcastPartyAudience({
      party,
      stage: party.options.paused
        ? "paused"
        : latest
          ? "result"
          : "ready"
    });
  } else if (
    requestedTemplateSession
    && templateSessionById(requestedTemplateSession)
  ) {
    state.activeTemplateSessionId = requestedTemplateSession;
    state.view = "template-session";
    state.toolId = null;
  } else if (getTool(requestedTool)) {
    state.view = "tool";
    state.toolId = requestedTool;
    ensureToolState(requestedTool);
    maybeResumeLatestSession(requestedTool);
  }

  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modal) {
      if (
        typeof state.modal === "object"
        && state.modal.type === "pool-editor"
      ) {
        announce("Use Save Pool or Cancel to close the Pool editor.");
        return;
      }
      state.modal = null;
      render();
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
      for (const toolId of Object.keys(state.tool)) {
        finishPresentation(toolId, null, false);
      }

      const secret = state.tool["secret-santa"];
      if (secret?.secretReveal != null) {
        secret.secretReveal = null;
      }

      cancelPartyCountdown({ renderAfter: false });
      cancelHaptics();
      await releasePartyWakeLock();

      if (state.view === "tool" || state.view === "party") render();
      return;
    }

    if (state.view === "party") {
      const party = activePartySession();
      if (party?.options?.wakeLock) {
        await requestPartyWakeLock(party);
      }
      broadcastPartyAudience({
        party,
        stage: party?.options?.paused ? "paused" : "ready",
        privateReveal:
          isPrivatePartyTool(party?.toolId)
          && ensureToolState(party?.toolId).secretReveal != null
      });
    }
  });
}
init().catch((error) => {
  root.replaceChildren(node("div", { class: "boot-screen" }, [
    node("div", { class: "brand-mark", text: "!" }),
    node("strong", { text: "Could not start Randomizer Arcade" }),
    node("span", {
      text: error?.message || "Unknown startup error."
    })
  ]));
});
