import { createRng, pick, sample } from "./random-core.js";
import { CATEGORIES, TOOLS, getTool, searchTools } from "./registry.js";
import {
  iconNode,
  toolIconId,
  categoryIconId
} from "./icon-system.js";
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
  requestPersistentStorage,
  dumpDatabaseStores,
  replaceDatabaseStores,
  getStorageStatus,
  getDeviceIdentity,
  renameDevice,
  getRecentPage,
  getRecentForTool,
  getAllByIndex,
  getLatestByCompoundPrefix,
  getMany,
  deleteMatching,
  DATABASE_VERSION,
  PORTABLE_STORAGE_STORES
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
  normalizeWorkflow,
  createWorkflow,
  updateWorkflow,
  createWorkflowNode,
  createWorkflowEdge,
  validateWorkflow,
  createWorkflowSession,
  provideWorkflowInput,
  recordWorkflowNode,
  evaluateBranchCondition,
  pauseWorkflowSession,
  resumeWorkflowSession,
  failWorkflowSession,
  abandonWorkflowSession
} from "./workflow-model.js";
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
import {
  CUSTOM_PRIMITIVES,
  CUSTOM_ACCENTS,
  CUSTOM_LAYOUTS,
  createCustomExperience,
  updateCustomExperience,
  publishCustomExperience,
  validateCustomExperience,
  exportCustomExperience,
  importCustomExperience,
  customToolId,
  customIdFromToolId,
  experienceAsTool
} from "./custom-experience-model.js";
import {
  executeCustomExperience,
  customResultItems,
  prepareCustomListEntries
} from "./custom-engine.js";
import {
  createPortablePackage,
  serializePortablePackage,
  parsePortablePackage,
  mergePortableStores,
  replaceStoresFromPackage,
  portablePackageSummary,
  safePortableFilename,
  LIBRARY_STORES,
  PORTABLE_STORES
} from "./data-portability.js";
import {
  HISTORY_PAGE_SIZE,
  HISTORY_RENDER_CHUNK,
  POOL_RENDER_CHUNK,
  RESULT_RENDER_LIMIT,
  FAIRNESS_RENDER_LIMIT,
  shouldOffloadTool,
  progressiveSlice,
  mergeRecentRecords,
  nextProgressiveLimit
} from "./performance-model.js";
import {
  computeWorkerSupported,
  runComputeTask
} from "./worker-client.js";
import {
  normalizeAccessibilitySettings,
  resolveRegionalLocale,
  formatDateTime,
  formatNumber,
  formatBytes,
  effectiveContrastMode,
  focusableSelector,
  nextFocusIndex
} from "./accessibility-i18n.js";
import {
  assertJsonImportFile,
  isPartyStateRequest,
  normalizeAudienceMessage,
  safeRouteToken,
  sanitizeDownloadFilename
} from "./security.js";

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
  customExperiences: [],
  workflows: [],
  workflowSessions: [],
  activeWorkflowSessionId: null,
  workflowEditor: null,
  workflowInputText: "",
  workflowBusy: false,
  creationFilter: "all",
  builder: null,
  partyCountdown: null,
  audiencePartyId: null,
  audienceState: null,
  history: [],
  runs: [],
  sessions: [],
  historyPins: new Set(),
  historyFilter: "all",
  historyRenderLimit: HISTORY_RENDER_CHUNK,
  historyPaging: {
    runsBefore: null,
    historyBefore: null,
    runsHasMore: false,
    historyHasMore: false,
    loading: false
  },
  favorites: [],
  settings: null,
  device: null,
  storageStatus: null,
  networkOnline:
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  installPrompt: null,
  swRegistration: null,
  updateAvailable: false,
  reloadingForUpdate: false,
  computeBusy: false,
  performance: {
    workerTasks: 0,
    mainThreadTasks: 0,
    lastComputeMs: null,
    lastComputeMode: null
  },
  search: "",
  modal: null,
  tool: {},
  studioResult: null
};

const palette = [
  "#7c5cff", "#2ee5ff", "#ffca3a", "#ff5577",
  "#40e38b", "#4d8dff", "#ff63c3", "#ff923e"
];

function customExperienceById(id) {
  return state.customExperiences.find(
    (experience) => experience.id === id
  ) || null;
}

function customExperienceFromToolId(toolId) {
  const id = customIdFromToolId(toolId);
  return id ? customExperienceById(id) : null;
}

function resolveTool(id) {
  const builtin = getTool(id);
  if (builtin) return builtin;

  const experience = customExperienceFromToolId(id);
  if (!experience || experience.status !== "published") return null;
  return experienceAsTool(experience);
}

function customExperienceNeedsPromptInput(experience) {
  if (!experience) return false;

  if (
    ["pick", "sample", "shuffle"].includes(experience.primitive)
  ) {
    return experience.config?.source === "prompt";
  }

  if (experience.primitive === "compound") {
    return experience.config.steps.some(
      (step) =>
        step.input?.kind === "prompt"
        || (
          ["pick", "sample", "shuffle"].includes(step.primitive)
          && step.config?.source === "prompt"
          && step.input?.kind !== "step"
        )
    );
  }

  return false;
}

function toolAcceptsListInput(toolId) {
  if (listInputTools.has(toolId)) return true;
  const experience = customExperienceFromToolId(toolId);
  return customExperienceNeedsPromptInput(experience);
}

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
const presentationFeedbackTimers = new Map();
const wheelTickTimers = new Map();
let partyCountdownTimer = null;
let hostUnlockTimer = null;
let wakeLockSentinel = null;
let audienceChannel = null;
let modalReturnFocus = null;
let modalFocusSignature = null;
let modalA11yCounter = 0;

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

function visualToolIcon(tool, className = "") {
  const iconId = toolIconId(tool);
  if (iconId) {
    return iconNode(iconId, { className });
  }
  return node("span", {
    class: (className + " visual-icon-fallback").trim(),
    text: tool?.icon || "✦",
    "aria-hidden": "true"
  });
}

function visualCategoryIcon(category, className = "") {
  const iconId = categoryIconId(category);
  if (iconId) {
    return iconNode(iconId, { className });
  }
  return node("span", {
    class: (className + " visual-icon-fallback").trim(),
    text: category?.icon || "✦",
    "aria-hidden": "true"
  });
}

function announce(message) {
  announcer.textContent = "";
  window.setTimeout(() => {
    announcer.textContent = message;
  }, 20);
}


function currentRegionalLocale() {
  const normalized = normalizeAccessibilitySettings(
    state.settings || {}
  );
  return resolveRegionalLocale(
    normalized.accessibility.regionalFormat,
    navigator.languages || [navigator.language]
  );
}

function localizedDateTime(value, options = {}) {
  return formatDateTime(
    value,
    currentRegionalLocale(),
    options
  );
}

function localizedBytes(value) {
  return formatBytes(
    value,
    currentRegionalLocale()
  );
}


function localizedNumber(value, options = {}) {
  return formatNumber(
    value,
    currentRegionalLocale(),
    options
  );
}

function localizedNumberResultValues(result) {
  if (!Array.isArray(result?.values)) return [];
  const decimal = result.mode === "decimal";
  return result.values.map((value) =>
    localizedNumber(value, decimal
      ? {
          minimumFractionDigits: result.precision,
          maximumFractionDigits: result.precision
        }
      : {
          maximumFractionDigits: 0
        }
    )
  );
}

function systemPrefersMoreContrast() {
  return Boolean(
    window.matchMedia
    && window.matchMedia("(prefers-contrast: more)").matches
  );
}

function applyAccessibilityPreferences() {
  if (!state.settings) return;
  state.settings = normalizeAccessibilitySettings(state.settings);
  const locale = currentRegionalLocale();
  const accessibility = state.settings.accessibility;
  const rootElement = document.documentElement;

  rootElement.dataset.locale = locale;
  rootElement.dataset.contrast = effectiveContrastMode(
    accessibility.contrast,
    systemPrefersMoreContrast()
  );
  rootElement.dataset.controlSize = accessibility.controlSize;
}

function prefersReducedMotionNow() {
  const motion =
    state.settings?.presentation?.motion
    || state.settings?.motion
    || "system";
  if (motion === "reduced") return true;
  if (motion === "full") return false;
  return Boolean(
    window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotionNow() ? "auto" : "smooth"
  });
}

function modalSignature() {
  if (!state.modal) return null;
  if (typeof state.modal === "string") return state.modal;
  return state.modal.type || "modal";
}

function focusIdentity(element) {
  if (!(element instanceof HTMLElement)) return null;
  return {
    id: element.id || null,
    name: element.getAttribute("name"),
    ariaLabel: element.getAttribute("aria-label"),
    tagName: element.tagName,
    text:
      element.tagName === "BUTTON"
        ? element.textContent?.trim() || null
        : null
  };
}

function matchingFocusable(container, identity) {
  if (!identity) return null;
  const candidates = [
    ...container.querySelectorAll(focusableSelector())
  ];
  return candidates.find((candidate) => {
    if (!(candidate instanceof HTMLElement)) return false;
    if (identity.id && candidate.id === identity.id) return true;
    if (
      identity.name
      && candidate.getAttribute("name") === identity.name
      && candidate.tagName === identity.tagName
    ) return true;
    if (
      identity.ariaLabel
      && candidate.getAttribute("aria-label") === identity.ariaLabel
      && candidate.tagName === identity.tagName
    ) return true;
    if (
      identity.text
      && candidate.tagName === "BUTTON"
      && candidate.textContent?.trim() === identity.text
    ) return true;
    return false;
  }) || null;
}

function applySegmentedSemantics(container) {
  container.querySelectorAll(".segmented").forEach((group) => {
    if (!group.hasAttribute("role")) group.setAttribute("role", "group");
    group.querySelectorAll("button").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        button.classList.contains("active") ? "true" : "false"
      );
    });
  });
}

function finalizeModalAccessibility(modal, previousFocusIdentity = null) {
  modal.tabIndex = -1;
  applySegmentedSemantics(modal);

  const heading = modal.querySelector("h1,h2,h3");
  if (heading) {
    if (!heading.id) {
      modalA11yCounter += 1;
      heading.id = "modal-title-" + modalA11yCounter;
    }
    modal.setAttribute("aria-labelledby", heading.id);
  } else {
    modal.setAttribute("aria-label", "Dialog");
  }

  const description = modal.querySelector("p");
  if (description) {
    if (!description.id) {
      modalA11yCounter += 1;
      description.id = "modal-description-" + modalA11yCounter;
    }
    modal.setAttribute("aria-describedby", description.id);
  }

  modal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [
      ...modal.querySelectorAll(focusableSelector())
    ].filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      return element.offsetParent !== null || element === document.activeElement;
    });

    if (!focusable.length) {
      event.preventDefault();
      modal.focus();
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement);
    const nextIndex = nextFocusIndex({
      currentIndex,
      count: focusable.length,
      shiftKey: event.shiftKey
    });
    event.preventDefault();
    focusable[nextIndex]?.focus();
  });

  window.requestAnimationFrame(() => {
    const restored = matchingFocusable(
      modal,
      previousFocusIdentity
    );
    if (restored) {
      restored.focus({ preventScroll: true });
      return;
    }

    const first = modal.querySelector(focusableSelector());
    if (first instanceof HTMLElement) {
      first.focus({ preventScroll: true });
    } else {
      modal.focus({ preventScroll: true });
    }
  });
}

async function updateAccessibilitySetting(key, value) {
  state.settings = normalizeAccessibilitySettings(state.settings);
  state.settings.accessibility[key] = value;
  await saveSettings(state.settings);
  applyAccessibilityPreferences();
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
      computing: false,
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
      customInputText: "Option A\nOption B\nOption C",
      customTestInput: "Option A\nOption B\nOption C",
      presentation: null,
      activePresetId: null,
      templateSessionId: null,
      templateStepIndex: null,
      templateStepId: null,
      workflowSessionId: null,
      workflowNodeId: null,
      workflowSilent: false,
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

  const feedback = presentationFeedbackTimers.get(toolId) || [];
  feedback.forEach((timer) => clearTimeout(timer));
  presentationFeedbackTimers.delete(toolId);

  const ticks = wheelTickTimers.get(toolId) || [];
  ticks.forEach((timer) => clearTimeout(timer));
  wheelTickTimers.delete(toolId);
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

function beginPresentation(toolId, ts, result, { silent = false } = {}) {
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

  if (silent) {
    effectiveSettings.presentation.mode = "instant";
    effectiveSettings.presentation.effects = "low";
    effectiveSettings.presentation.sound = false;
    effectiveSettings.presentation.haptics = "off";
  }

  const customExperience = customExperienceFromToolId(toolId);
  const presentationToolId = customExperience
    ? ({
        wheel: "wheel",
        card: "cards",
        dice: "dice",
        list: "shuffle",
        number: "number",
        table: "picker",
        text: "picker",
        auto:
          customExperience.primitive === "dice"
            || customExperience.primitive === "faces"
              ? "dice"
              : customExperience.primitive === "deck"
                ? "cards"
                : customExperience.primitive === "shuffle"
                  ? "shuffle"
                  : customExperience.primitive === "number"
                    ? "number"
                    : "picker"
      })[customExperience.appearance.layout]
    : toolId;

  const plan = presentationPlan({
    toolId: presentationToolId,
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

  if (!silent) {
    primeAudio(settings.presentation.sound);
    const feedbackTimers = [];

    const scheduleFeedback = (delay, callback) => {
      if (delay <= 0) {
        callback();
        return;
      }
      feedbackTimers.push(setTimeout(callback, delay));
    };

    scheduleFeedback(plan.cueAtMs, () => {
      playPresentationCue(plan.cue, {
        enabled: settings.presentation.sound,
        mode: plan.mode
      });
    });
    scheduleFeedback(plan.hapticAtMs, () => {
      playHaptic(plan.haptic, settings.presentation.haptics);
    });

    if (feedbackTimers.length) {
      presentationFeedbackTimers.set(toolId, feedbackTimers);
    }
  }

  if (
    toolId === "wheel"
    && plan.tickSchedule?.length
    && settings.presentation.sound
    && !silent
  ) {
    const tickTimers = plan.tickSchedule.map((delay) =>
      setTimeout(() => {
        playWheelTick({
          enabled: settings.presentation.sound,
          mode: plan.mode
        });
      }, delay)
    );
    wheelTickTimers.set(toolId, tickTimers);
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
      workerRandomSpec: { mode: "secure" },
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
    workerRandomSpec: {
      mode: "seeded",
      seed: seed + "::" + position
    },
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
    customExperiences,
    workflows,
    historyPage,
    runPage,
    activeSessions,
    activeTemplateSessions,
    activePartySessions,
    activeWorkflowSessions,
    pausedWorkflowSessions,
    pins,
    favorites,
    settings
  ] = await Promise.all([
    getAll("pools"),
    getAll("poolViews"),
    getAll("presets"),
    getAll("ruleSets"),
    getAll("sessionTemplates"),
    getAll("customExperiences"),
    getAll("workflows"),
    getRecentPage("history", "recent", {
      limit: HISTORY_PAGE_SIZE
    }),
    getRecentPage("runs", "recent", {
      limit: HISTORY_PAGE_SIZE
    }),
    getAllByIndex("sessions", "status", "active"),
    getAllByIndex("templateSessions", "status", "active"),
    getAllByIndex("partySessions", "status", "active"),
    getAllByIndex("workflowSessions", "status", "active"),
    getAllByIndex("workflowSessions", "status", "paused"),
    getAll("historyPins"),
    getAll("favorites"),
    getSettings()
  ]);

  const templateIds = [
    ...BUILTIN_SESSION_TEMPLATES.map((template) => String(template.id)),
    ...sessionTemplates.map((template) => String(template.id))
  ];
  const workflowIds = workflows.map((workflow) => String(workflow.id));

  const [
    latestTemplateSessions,
    latestWorkflowSessions
  ] = await Promise.all([
    getLatestByCompoundPrefix(
      "templateSessions",
      "templateRecent",
      templateIds
    ),
    getLatestByCompoundPrefix(
      "workflowSessions",
      "workflowRecent",
      workflowIds
    )
  ]);

  const templateSessions = mergeRecentRecords(
    activeTemplateSessions,
    latestTemplateSessions,
    { sortKey: "updatedAt" }
  );
  const partySessions = activePartySessions;
  const workflowSessions = mergeRecentRecords(
    [...activeWorkflowSessions, ...pausedWorkflowSessions],
    latestWorkflowSessions,
    { sortKey: "updatedAt" }
  );

  const activeSessionIds = new Set(
    activeSessions.map((session) => String(session.id))
  );
  const linkedSessionIds = [...new Set(
    runPage.records
      .map((run) => run.sessionId)
      .filter(Boolean)
      .map(String)
  )].filter((id) => !activeSessionIds.has(id));
  const linkedSessions = linkedSessionIds.length
    ? await getMany("sessions", linkedSessionIds)
    : [];
  const sessions = mergeRecentRecords(
    activeSessions,
    linkedSessions,
    { sortKey: "updatedAt" }
  );

  const loadedRunIds = new Set(
    runPage.records.map((run) => String(run.id))
  );
  const criticalRunIds = new Set();

  for (const session of sessions) {
    if (session.status !== "active") continue;
    for (const runId of session.runIds || []) {
      criticalRunIds.add(String(runId));
    }
  }
  for (const session of templateSessions) {
    if (session.status !== "active") continue;
    for (const step of session.steps || []) {
      if (step.runId) criticalRunIds.add(String(step.runId));
    }
  }
  for (const session of partySessions) {
    if (session.status !== "active") continue;
    for (const runId of session.runIds || []) {
      criticalRunIds.add(String(runId));
    }
  }
  for (const session of workflowSessions) {
    if (session.status !== "active" && session.status !== "paused") continue;
    for (const entry of session.path || []) {
      if (entry.runId) criticalRunIds.add(String(entry.runId));
    }
  }

  const missingCriticalRunIds = [...criticalRunIds]
    .filter((id) => !loadedRunIds.has(id));
  const criticalRuns = missingCriticalRunIds.length
    ? await getMany("runs", missingCriticalRunIds)
    : [];

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
  state.customExperiences = customExperiences.sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  state.workflows = workflows
    .map(normalizeWorkflow)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  state.workflowSessions = workflowSessions.sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  state.history = historyPage.records
    .sort((a, b) => b.timestamp - a.timestamp);
  state.runs = mergeRecentRecords(
    runPage.records,
    criticalRuns,
    { sortKey: "timestamp" }
  );
  state.historyPaging = {
    runsBefore: runPage.nextCursor,
    historyBefore: historyPage.nextCursor,
    runsHasMore: runPage.hasMore,
    historyHasMore: historyPage.hasMore,
    loading: false
  };
  state.historyRenderLimit = HISTORY_RENDER_CHUNK;
  state.sessions = sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  state.historyPins = new Set(pins.map((entry) => entry.id));
  state.favorites = favorites.map((entry) => entry.id);
  state.settings = normalizeAccessibilitySettings(
    normalizeExperienceSettings(settings)
  );
}

function cloneData(value) {
  return value == null ? value : structuredClone(value);
}

function snapshotToolState(toolId, toolState) {
  const snapshot = cloneData(toolState);
  delete snapshot.error;
  delete snapshot.computing;
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
  delete snapshot.workflowSessionId;
  delete snapshot.workflowNodeId;
  delete snapshot.workflowSilent;
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
  const experience = customExperienceFromToolId(toolId);
  return {
    items: parseList(
      experience && customExperienceNeedsPromptInput(experience)
        ? toolState.customInputText
        : toolState.listText
    ),
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

async function ensureRunsLoaded(runIds) {
  const loaded = new Set(state.runs.map((run) => String(run.id)));
  const missing = [...new Set((runIds || []).filter(Boolean).map(String))]
    .filter((id) => !loaded.has(id));
  if (!missing.length) return;

  const records = await getMany("runs", missing);
  state.runs = mergeRecentRecords(
    state.runs,
    records,
    { sortKey: "timestamp" }
  );
}


async function openRunDetailById(runId) {
  let run = historyRunById(runId);

  if (!run && !String(runId).startsWith("legacy:")) {
    try {
      await ensureRunsLoaded([runId]);
      run = historyRunById(runId);
    } catch (error) {
      announce(error?.message || "Could not load this Run.");
      return;
    }
  }

  if (!run) {
    announce("This stored Run is unavailable.");
    return;
  }

  state.modal = { type: "run-detail", runId: run.id };
  render();
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

function workflowById(id) {
  return state.workflows.find((workflow) => workflow.id === id) || null;
}

function workflowSessionById(id) {
  return state.workflowSessions.find((session) => session.id === id) || null;
}

function workflowForSession(session) {
  if (!session) return null;
  if (session.workflowSnapshot) {
    return normalizeWorkflow(session.workflowSnapshot);
  }
  return workflowById(session.workflowId);
}

function replaceWorkflow(next) {
  state.workflows = [
    next,
    ...state.workflows.filter((workflow) => workflow.id !== next.id)
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

function replaceWorkflowSession(next) {
  state.workflowSessions = [
    next,
    ...state.workflowSessions.filter((session) => session.id !== next.id)
  ].sort((a, b) => b.updatedAt - a.updatedAt);
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
  const tool = resolveTool(party.toolId);
  if (!tool) return;

  const channel = partyChannelFor(party.id);
  if (!channel) return;

  channel.onmessage = (event) => {
    const message = event.data;
    if (
      isPartyStateRequest(message, party.id)
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
  const tool = resolveTool(toolId);
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
  const experience = customExperienceFromToolId(toolId);
  const labels = parseList(
    experience && customExperienceNeedsPromptInput(experience)
      ? toolState.customInputText
      : toolState.listText
  );
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
  const tool = resolveTool(preset.toolId);
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
    workflowSessionId: null,
    workflowNodeId: null,
    workflowSilent: false,
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
    if (tool.custom) next.customInputText = "";
    else next.listText = "";
    next.workingSet = null;
    next.workingSetDirty = false;
  } else if (resolved.workingSet) {
    next.workingSet = resolved.workingSet;
    if (tool.custom) {
      next.customInputText = workingSetLabels(resolved.workingSet).join("\n");
    } else {
      next.listText = workingSetLabels(resolved.workingSet).join("\n");
    }
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
    scrollToTop();
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

  if (tool.custom) {
    const experience = customExperienceFromToolId(tool.id);
    const fairness = ts.lastCustomFairness;
    panel.querySelector(".fairness-body").append(
      node("div", { class: "fairness-method" }, [
        node("strong", { text: "Declarative Custom Experience" }),
        node("p", {
          text:
            "This creation uses the approved “"
            + (experience?.primitive || "custom")
            + "” primitive. It cannot execute custom JavaScript, HTML, or CSS."
        })
      ]),
      fairness
        ? node("div", { class: "fairness-method" }, [
            node("strong", {
              text: fairness.mode || fairness.kind || "Random operation"
            }),
            node("p", {
              text:
                (fairness.candidateCount != null
                  ? fairness.candidateCount + " configured candidates. "
                  : "")
                + (fairness.eligibleCount != null
                  ? fairness.eligibleCount + " currently eligible."
                  : "")
            })
          ])
        : null
    );
  } else if (selectionTools.has(tool.id)) {
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
  const tool = party ? resolveTool(party.toolId) : null;

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
      visualToolIcon(tool, "party-tool-icon"),
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
      node("div", { class: "audience-waiting-mark" },
        iconNode("brand")
      ),
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
      visualToolIcon(data.tool, "party-tool-icon"),
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
      node("div", { class: "audience-status-mark" },
        iconNode("check")
      ),
      node("strong", { text: "Party ended" }),
      node("span", { text: "Thanks for playing." })
    ]));
  } else if (data.stage === "paused") {
    shell.append(node("section", {
      class: "audience-private audience-paused"
    }, [
      node("div", { class: "audience-status-mark" },
        iconNode("pause")
      ),
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
      node("div", { class: "audience-private-mark" },
        iconNode("lock")
      ),
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
  scrollToTop();
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
    await ensureRunsLoaded([runtimeStep.runId]);
    const run = runById(runtimeStep.runId);
    if (run) replayStoredRun(run);
    else announce("The stored Run for this step is unavailable.");
    return;
  }

  const tool = resolveTool(definition.toolId);
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
    if (tool.custom) ts.customInputText = items.join("\n");
    else ts.listText = items.join("\n");
    ts.workingSet = null;
    ts.workingSetDirty = false;
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
  } else if (definition.input.kind === "frozen") {
    const text = (definition.input.items || []).join("\n");
    if (tool.custom) ts.customInputText = text;
    else ts.listText = text;
    ts.workingSet = null;
    ts.workingSetDirty = false;
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
  } else if (definition.input.kind === "prompt") {
    if (tool.custom) ts.customInputText = "";
    else ts.listText = "";
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
  scrollToTop();
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
    const tool = resolveTool(definition.toolId);
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
  scrollToTop();
}

function openTool(id) {
  if (state.toolId && state.toolId !== id) {
    finishPresentation(state.toolId, null, false);
  }
  const tool = resolveTool(id);
  if (!tool) return;
  state.view = "tool";
  state.toolId = id;
  state.modal = null;
  const openedState = ensureToolState(id);
  openedState.workflowSessionId = null;
  openedState.workflowNodeId = null;
  openedState.workflowSilent = false;
  maybeResumeLatestSession(id);
  history.replaceState({}, "", location.pathname + "?tool=" + encodeURIComponent(id));
  render();
  scrollToTop();
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

function toolCard(tool, {
  variant = "standard",
  eyebrow = "",
  note = ""
} = {}) {
  const favorite = Boolean(
    state.favorites.includes(tool.id)
    || (
      tool.custom
      && customExperienceFromToolId(tool.id)?.favorite
    )
  );

  return node("button", {
    class:
      "tool-card tool-card-v2 tool-card-"
      + variant
      + " accent-"
      + tool.accent,
    type: "button",
    onClick: () => openTool(tool.id)
  }, [
    node("div", {
      class: "tool-card-visual",
      "aria-hidden": "true"
    }, [
      node("span", { class: "tool-card-aura" }),
      visualToolIcon(tool, "tool-icon")
    ]),
    node("div", { class: "tool-card-copy" }, [
      eyebrow
        ? node("span", { class: "tool-card-eyebrow", text: eyebrow })
        : null,
      node("strong", { text: tool.name }),
      node("small", { text: tool.blurb }),
      note
        ? node("span", { class: "tool-card-note", text: note })
        : null
    ]),
    favorite
      ? node("span", {
          class: "tool-card-favorite",
          "aria-label": "Favorite"
        }, iconNode("star-filled"))
      : null
  ]);
}

function homeSectionHeader(
  title,
  note = "",
  actionLabel = "",
  action = null
) {
  return node("div", { class: "home-section-head" }, [
    node("div", {}, [
      node("h2", { text: title }),
      note ? node("p", { text: note }) : null
    ]),
    actionLabel && action
      ? node("button", {
          class: "home-section-action",
          type: "button",
          onClick: action
        }, actionLabel)
      : null
  ]);
}

function homeSearchBox({
  className = "",
  placeholder = "Search randomizers…"
} = {}) {
  const wrap = node("label", {
    class: ("search-box home-search-box " + className).trim()
  }, [
    iconNode("search", { className: "search-icon" }),
    node("span", { class: "sr-only", text: "Search randomizers" })
  ]);

  const search = node("input", {
    type: "search",
    value: state.search,
    placeholder,
    onInput: (event) => {
      state.search = event.target.value;
      render();
      const next = document.querySelector(
        "." + className.split(" ").filter(Boolean)[0] + " input"
      ) || document.querySelector(".home-search-box input");
      if (next) {
        next.focus();
        next.setSelectionRange(state.search.length, state.search.length);
      }
    }
  });

  wrap.append(search);
  return wrap;
}

function recentHomeTools(limit = 6) {
  const seen = new Set();
  const recent = [];

  for (const run of [...state.runs].sort(
    (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)
  )) {
    const tool = resolveTool(run.toolId);
    if (!tool || seen.has(tool.id)) continue;
    seen.add(tool.id);
    recent.push({ tool, run });
    if (recent.length >= limit) break;
  }

  return recent;
}

function homeContinuations(limit = 4) {
  const items = [];

  const seenToolSessions = new Set();
  for (const session of [...state.sessions].sort(
    (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
  )) {
    if (session.status !== "active") continue;
    if (seenToolSessions.has(session.toolId)) continue;
    const tool = resolveTool(session.toolId);
    if (!tool) continue;
    seenToolSessions.add(session.toolId);
    items.push({
      id: "tool-session:" + session.id,
      kind: "Tool session",
      title: tool.name,
      detail: "Resume where you left off",
      icon: visualToolIcon(tool, "continue-icon"),
      updatedAt: session.updatedAt || session.createdAt || 0,
      action: () => openTool(tool.id)
    });
  }

  for (const session of state.templateSessions) {
    if (session.status !== "active") continue;
    const template = sessionTemplateById(session.templateId);
    if (!template) continue;
    items.push({
      id: "template-session:" + session.id,
      kind: "Guided session",
      title: template.name,
      detail:
        (session.currentIndex != null
          ? "Step " + (session.currentIndex + 1)
          : "In progress"),
      icon: iconNode("template", { className: "continue-icon" }),
      updatedAt: session.updatedAt || session.createdAt || 0,
      action: () => openTemplateSession(session.id)
    });
  }

  for (const session of state.workflowSessions) {
    if (!["active", "paused"].includes(session.status)) continue;
    const workflow = workflowForSession(session);
    if (!workflow) continue;
    items.push({
      id: "workflow-session:" + session.id,
      kind: session.status === "paused" ? "Paused workflow" : "Workflow",
      title: workflow.name,
      detail:
        session.stepCount
        + (session.stepCount === 1 ? " committed step" : " committed steps"),
      icon: iconNode("studio", { className: "continue-icon" }),
      updatedAt: session.updatedAt || session.createdAt || 0,
      action: () => openWorkflowSession(session.id)
    });
  }

  return items
    .sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime()
        - new Date(a.updatedAt || 0).getTime()
    )
    .slice(0, limit);
}

function continuationCard(item) {
  return node("button", {
    class: "continue-card",
    type: "button",
    onClick: item.action
  }, [
    node("div", { class: "continue-card-icon" }, item.icon),
    node("div", { class: "continue-card-copy" }, [
      node("span", { text: item.kind }),
      node("strong", { text: item.title }),
      node("small", { text: item.detail })
    ]),
    node("span", {
      class: "continue-card-cta",
      text: "Continue"
    })
  ]);
}

function arcadeCategoryCopy(categoryId) {
  return ({
    classics: "Fast decisions and the randomizers you reach for first.",
    people: "Fairly split, pair, order, and assign people.",
    generators: "Generate numbers, dates, colors, directions, and more.",
    games: "Draws, brackets, elimination, cards, and playful chance."
  })[categoryId] || "Explore randomizers.";
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
  const tool = resolveTool(preset.toolId);
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
      class: "saved-setup-icon"
    }, visualToolIcon(tool, "saved-setup-tool-icon")),
    node("div", { class: "saved-setup-copy" }, [
      node("div", { class: "saved-setup-title-row" }, [
        node("strong", { text: preset.name }),
        preset.favorite
          ? node("span", {
              class: "saved-favorite-badge",
              "aria-hidden": "true"
            }, iconNode("star-filled"))
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
      class: "session-template-icon"
    }, iconNode("template")),
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


function starterCustomDefinition(kind = "wheel") {
  if (kind === "dice") {
    return {
      name: "My Custom Dice",
      description: "Roll custom text faces.",
      icon: "⬡",
      primitive: "faces",
      config: {
        faces: ["Success", "Mixed", "Fail", "Bonus", "Twist", "Wild"],
        count: 1
      },
      appearance: {
        accent: "red",
        layout: "dice",
        resultLabel: "Roll",
        actionLabel: "ROLL"
      }
    };
  }

  if (kind === "deck") {
    return {
      name: "My Custom Deck",
      description: "Draw from a custom card list.",
      icon: "▰",
      primitive: "deck",
      config: {
        cards: ["Fire", "Water", "Earth", "Air"],
        drawCount: 1,
        replacement: false
      },
      appearance: {
        accent: "purple",
        layout: "card",
        resultLabel: "Draw",
        actionLabel: "DRAW"
      }
    };
  }

  if (kind === "table") {
    return {
      name: "Random Table",
      description: "Weighted lookup table.",
      icon: "▦",
      primitive: "table",
      config: {
        rows: [
          { label: "Common", value: "1 coin", weight: 6 },
          { label: "Uncommon", value: "3 coins", weight: 3 },
          { label: "Rare", value: "10 coins", weight: 1 }
        ]
      },
      appearance: {
        accent: "gold",
        layout: "table",
        resultLabel: "Result",
        actionLabel: "ROLL TABLE"
      }
    };
  }

  if (kind === "number") {
    return {
      name: "Custom Number",
      description: "Generate numbers from your own range.",
      icon: "#",
      primitive: "number",
      config: {
        mode: "integer",
        min: 1,
        max: 20,
        count: 1,
        precision: 2,
        unique: false
      },
      appearance: {
        accent: "cyan",
        layout: "number",
        resultLabel: "Number",
        actionLabel: "GENERATE"
      }
    };
  }

  if (kind === "compound") {
    return {
      name: "Adventure Generator",
      description: "A bounded multi-step generator.",
      icon: "◇",
      primitive: "compound",
      config: {
        steps: [
          {
            id: "place",
            name: "Place",
            primitive: "pick",
            input: { kind: "config" },
            config: {
              entries: ["Forest", "Ruins", "Harbor"]
            }
          },
          {
            id: "danger",
            name: "Danger",
            primitive: "pick",
            input: { kind: "config" },
            config: {
              entries: ["Low", "Medium", "High"]
            }
          }
        ],
        finalStepId: "danger"
      },
      appearance: {
        accent: "orange",
        layout: "list",
        resultLabel: "Generated",
        actionLabel: "GENERATE"
      }
    };
  }

  if (kind === "picker") {
    return {
      name: "My Picker",
      description: "Pick one from a custom or fresh list.",
      icon: "✦",
      primitive: "pick",
      config: {
        source: "prompt"
      },
      appearance: {
        accent: "cyan",
        layout: "text",
        resultLabel: "Selected",
        actionLabel: "PICK"
      }
    };
  }

  return {
    name: "My Wheel",
    description: "A custom weighted wheel.",
    icon: "◉",
    primitive: "pick",
    config: {
      entries: [
        { label: "Pizza", weight: 1 },
        { label: "Sushi", weight: 1 },
        { label: "Tacos", weight: 1 },
        { label: "Korean", weight: 1 }
      ]
    },
    appearance: {
      accent: "gold",
      layout: "wheel",
      resultLabel: "Result",
      actionLabel: "SPIN"
    }
  };
}

function weightedRowsText(entries = []) {
  return entries.map((entry) =>
    String(entry.label || "")
    + " | "
    + String(entry.weight == null ? 1 : entry.weight)
    + (
      entry.value != null && String(entry.value) !== String(entry.label)
        ? " | " + String(entry.value)
        : ""
    )
  ).join("\n");
}

function parseWeightedRowsText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      return {
        id: "entry:" + index,
        label: parts[0],
        weight: parts[1] === "" || parts[1] == null
          ? 1
          : Number(parts[1]),
        value: parts[2] || parts[0]
      };
    });
}

function simpleLinesText(items = []) {
  return items.map(String).join("\n");
}

function parseSimpleLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function defaultCustomConfig(primitive) {
  return starterCustomDefinition(
    primitive === "faces"
      ? "dice"
      : primitive === "deck"
        ? "deck"
        : primitive === "table"
          ? "table"
          : primitive === "number"
            ? "number"
            : primitive === "compound"
              ? "compound"
              : primitive === "pick"
                ? "wheel"
                : "picker"
  ).config;
}

function replaceCustomExperience(next) {
  state.customExperiences = [
    next,
    ...state.customExperiences.filter((item) => item.id !== next.id)
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

function openBuilder(experienceId = null, starter = "wheel") {
  const source = experienceId
    ? customExperienceById(experienceId)
    : null;
  const draft = source
    ? cloneData(source)
    : createCustomExperience({
        ...starterCustomDefinition(starter),
        status: "draft"
      });

  state.builder = {
    draft,
    baseRevision: source?.revision ?? null,
    isNew: !source,
    testIndex: 0,
    testInput: "Option A\nOption B\nOption C",
    testResult: null,
    error: null
  };
  state.view = "builder";
  state.toolId = null;
  state.modal = null;
  history.replaceState({}, "", location.pathname + "?builder=" + encodeURIComponent(draft.id));
  render();
  scrollToTop();
}

async function persistBuilder(status = "draft") {
  const builder = state.builder;
  if (!builder) return null;

  const existing = customExperienceById(builder.draft.id);
  let next;

  if (existing) {
    next = updateCustomExperience(existing, {
      ...cloneData(builder.draft),
      status
    });
    await putWithRevision("customExperiences", next, existing.revision);
  } else {
    next = createCustomExperience({
      ...cloneData(builder.draft),
      id: builder.draft.id,
      status
    });
    await put("customExperiences", next);
  }

  replaceCustomExperience(next);
  builder.draft = cloneData(next);
  builder.baseRevision = next.revision;
  builder.isNew = false;
  builder.error = null;
  announce(status === "published" ? "Creation published." : "Draft saved.");
  render();
  return next;
}

function testBuilder() {
  const builder = state.builder;
  if (!builder) return;

  const validation = validateCustomExperience(builder.draft);
  if (!validation.valid) {
    builder.error = validation.errors[0]?.message || "Creation is invalid.";
    builder.testResult = null;
    render();
    return;
  }

  try {
    const rng = createRng({
      mode: "seeded",
      seed:
        "builder-test:"
        + builder.draft.id
        + "::"
        + builder.testIndex
    });
    builder.testIndex += 1;
    builder.testResult = executeCustomExperience(
      validation.value,
      {
        inputItems: parseList(builder.testInput)
      },
      rng
    );
    builder.error = null;
    render();
  } catch (error) {
    builder.error = error?.message || "Test failed.";
    builder.testResult = null;
    render();
  }
}

function downloadCustomExperience(experience) {
  const text = exportCustomExperience(experience);
  const blob = new Blob([text], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeDownloadFilename(
    (experience.name || "custom-experience") + ".randomizer.json",
    "custom-experience.randomizer.json"
  );
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


const PORTABILITY_APP_VERSION = "1.0.0";

function downloadTextFile(text, filename, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeDownloadFilename(
    filename,
    "randomizer-export.json"
  );
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatStorageBytes(value) {
  return localizedBytes(value);
}

async function refreshStorageStatus() {
  state.storageStatus = await getStorageStatus();
  return state.storageStatus;
}

async function ensureDeviceIdentity() {
  if (!state.device) state.device = await getDeviceIdentity();
  return state.device;
}

function portableRecordCount(portable) {
  try {
    return portablePackageSummary(portable).records;
  } catch {
    return 0;
  }
}

async function runBackgroundOrFallback(
  type,
  payload,
  fallback,
  {
    enabled = true,
    timeoutMs = 30000
  } = {}
) {
  if (!enabled || !computeWorkerSupported()) {
    return fallback();
  }

  const started =
    globalThis.performance?.now
      ? globalThis.performance.now()
      : Date.now();

  try {
    const result = await runComputeTask(
      type,
      payload,
      { timeoutMs }
    );
    state.performance.workerTasks += 1;
    state.performance.lastComputeMode = "worker";
    return result;
  } catch (error) {
    if ([
      "COMPUTE_WORKER_UNAVAILABLE",
      "COMPUTE_WORKER_POST_FAILED",
      "COMPUTE_WORKER_CRASHED"
    ].includes(error?.code)) {
      state.performance.mainThreadTasks += 1;
      state.performance.lastComputeMode = "main-fallback";
      return fallback();
    }
    throw error;
  } finally {
    const ended =
      globalThis.performance?.now
        ? globalThis.performance.now()
        : Date.now();
    state.performance.lastComputeMs = Math.max(
      0,
      Math.round((ended - started) * 10) / 10
    );
  }
}

async function serializePortableSmart(portable) {
  const records = portableRecordCount(portable);
  return runBackgroundOrFallback(
    "portability.serialize",
    { portable },
    () => serializePortablePackage(portable),
    { enabled: records >= 1000 }
  );
}

async function createAppPortablePackage(scope = "full") {
  const device = await ensureDeviceIdentity();
  const stores = await dumpDatabaseStores(
    scope === "library"
      ? LIBRARY_STORES
      : PORTABLE_STORAGE_STORES
  );
  return createPortablePackage({
    stores,
    scope,
    device: {
      id: device.deviceId,
      name: device.name,
      platform: device.platform
    },
    appVersion: PORTABILITY_APP_VERSION,
    databaseVersion: DATABASE_VERSION
  });
}

async function downloadPortablePackage(scope = "full", {
  announceAfter = true
} = {}) {
  const portable = await createAppPortablePackage(scope);
  const text = await serializePortableSmart(portable);
  const filename = safePortableFilename({
    scope,
    createdAt: portable.createdAt
  });
  downloadTextFile(text, filename);
  if (announceAfter) {
    announce(
      scope === "full"
        ? "Full backup downloaded."
        : "Library transfer package downloaded."
    );
  }
  return { portable, text, filename };
}

async function shareLibraryPackage() {
  try {
    const { portable, text, filename } =
      await downloadOrShareLibraryPayload(false);
    const file = new File([text], filename, {
      type: "application/json"
    });

    if (
      navigator.share
      && (
        !navigator.canShare
        || navigator.canShare({ files: [file] })
      )
    ) {
      await navigator.share({
        title: "Randomizer Arcade library",
        text:
          "Randomizer Arcade transfer package from "
          + portable.device.name,
        files: [file]
      });
      announce("Library transfer shared.");
      return;
    }

    downloadTextFile(text, filename);
    announce("Sharing is unavailable here. Transfer package downloaded instead.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    announce(error?.message || "Could not share library.");
  }
}

async function downloadOrShareLibraryPayload(download = true) {
  const portable = await createAppPortablePackage("library");
  const text = await serializePortableSmart(portable);
  const filename = safePortableFilename({
    scope: "library",
    createdAt: portable.createdAt
  });
  if (download) downloadTextFile(text, filename);
  return { portable, text, filename };
}

function openPortableImportPicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.multiple = false;

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      assertJsonImportFile(file);
      const text = await file.text();
      const portable = await runBackgroundOrFallback(
        "portability.parse",
        { text },
        () => parsePortablePackage(text),
        { enabled: file.size >= 256 * 1024 }
      );
      const summary = portablePackageSummary(portable);
      state.modal = {
        type: "portable-import",
        portable,
        summary,
        filename: file.name,
        mode: "merge",
        error: null
      };
      render();
    } catch (error) {
      announce(error?.message || "Could not read this backup.");
    }
  }, { once: true });

  input.click();
}

async function applyPortableImport(config) {
  const portable = config.portable;
  const local = await dumpDatabaseStores(PORTABLE_STORAGE_STORES);
  const mode = config.mode === "replace" ? "replace" : "merge";

  if (mode === "replace") {
    // Destructive restore always emits a safety backup first.
    const safety = await createPortablePackage({
      stores: local,
      scope: "full",
      device: {
        id: (await ensureDeviceIdentity()).deviceId,
        name: state.device.name,
        platform: state.device.platform
      },
      appVersion: PORTABILITY_APP_VERSION,
      databaseVersion: DATABASE_VERSION
    });
    downloadTextFile(
      await serializePortableSmart(safety),
      "randomizer-pre-restore-"
        + new Date().toISOString().replace(/[:.]/g, "-")
        + ".json"
    );
  }

  const localCount = Object.values(local)
    .reduce(
      (total, records) =>
        total + (Array.isArray(records) ? records.length : 0),
      0
    );
  const result = mode === "replace"
    ? {
        stores: replaceStoresFromPackage(local, portable),
        totals: { added: 0, updated: 0, conflicts: 0 }
      }
    : await runBackgroundOrFallback(
        "portability.merge",
        { localStores: local, portable },
        () => mergePortableStores(local, portable),
        {
          enabled:
            localCount + portableRecordCount(portable) >= 1200,
          timeoutMs: 45000
        }
      );

  const targetStores =
    portable.payload.scope === "library"
      ? LIBRARY_STORES
      : PORTABLE_STORES;

  await replaceDatabaseStores(result.stores, {
    storeNames: targetStores
  });

  state.tool = {};
  state.activeTemplateSessionId = null;
  state.activePartySessionId = null;
  state.activeWorkflowSessionId = null;
  state.workflowEditor = null;
  state.builder = null;
  state.modal = null;
  state.view = "play";
  state.toolId = null;

  await loadData();
  await refreshStorageStatus();
  history.replaceState({}, "", location.pathname);
  render();

  if (mode === "merge") {
    announce(
      "Import complete"
      + (result.totals.conflicts
        ? " · " + result.totals.conflicts + " conflicts kept local."
        : ".")
    );
  } else {
    announce("Restore complete. A pre-restore safety backup was downloaded.");
  }
}

async function requestDurableStorage() {
  const granted = await requestPersistentStorage();
  await refreshStorageStatus();
  announce(
    granted
      ? "Persistent storage granted."
      : "The browser did not grant persistent storage."
  );
  render();
}

async function renameCurrentDevice(value) {
  try {
    state.device = await renameDevice(value);
    announce("Device name updated.");
    render();
  } catch (error) {
    announce(error?.message || "Could not rename device.");
  }
}

async function installPwa() {
  const prompt = state.installPrompt;
  if (!prompt) return;
  state.installPrompt = null;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    // Browser installation prompts are user-controlled.
  }
  render();
}

function activateWaitingServiceWorker() {
  const waiting = state.swRegistration?.waiting;
  if (!waiting) return;
  state.reloadingForUpdate = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}

async function toggleCustomFavorite(experience) {
  const next = updateCustomExperience(experience, {
    favorite: !experience.favorite
  });
  await putWithRevision(
    "customExperiences",
    next,
    experience.revision
  );
  replaceCustomExperience(next);
  render();
}

async function deleteCustomExperience(experience) {
  const toolId = customToolId(experience.id);
  const presetRefs = state.presets.filter(
    (preset) => preset.toolId === toolId
  );
  const templateRefs = state.sessionTemplates.filter((template) =>
    template.steps.some((step) => step.toolId === toolId)
  );
  const partyRefs = state.partySessions.filter(
    (party) =>
      party.toolId === toolId
      && party.status === "active"
  );

  if (presetRefs.length || templateRefs.length || partyRefs.length) {
    announce(
      "This creation is still referenced by a Preset, Session Template, or active Party."
    );
    return false;
  }

  await remove("customExperiences", experience.id);
  state.customExperiences = state.customExperiences.filter(
    (item) => item.id !== experience.id
  );
  state.favorites = state.favorites.filter(
    (id) => id !== toolId
  );
  await remove("favorites", toolId);
  render();
  return true;
}

function customCreationCard(experience) {
  const tool = experienceAsTool(experience);
  return node("article", {
    class:
      "creation-card accent-"
      + tool.accent
      + (experience.status === "draft" ? " is-draft" : "")
  }, [
    node("div", {
      class: "creation-icon",
      text: experience.icon
    }),
    node("div", { class: "creation-copy" }, [
      node("div", { class: "creation-title-row" }, [
        node("strong", { text: experience.name }),
        node("span", {
          class:
            "creation-status "
            + (
              experience.status === "published"
                ? "published"
                : "draft"
            ),
          text: experience.status
        }),
        experience.favorite
          ? node("span", {
              class: "saved-favorite-badge",
              "aria-hidden": "true"
            }, iconNode("star-filled"))
          : null
      ]),
      node("span", {
        text:
          experience.primitive
          + " · "
          + experience.appearance.layout
          + " · revision "
          + experience.revision
      }),
      experience.description
        ? node("small", { text: experience.description })
        : null
    ]),
    node("div", { class: "creation-actions" }, [
      experience.status === "published"
        ? node("button", {
            class: "primary",
            type: "button",
            onClick: () => openTool(customToolId(experience.id))
          }, "Play")
        : null,
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => openBuilder(experience.id)
      }, "Edit"),
      node("button", {
        class: "small-action",
        type: "button",
        "aria-label": experience.favorite
          ? "Remove creation favorite"
          : "Favorite creation",
        onClick: () => toggleCustomFavorite(experience)
      }, experience.favorite ? "★" : "☆"),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => downloadCustomExperience(experience)
      }, "Export"),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: async () => {
          const copy = createCustomExperience({
            ...cloneData(experience),
            id: undefined,
            name: experience.name + " Copy",
            status: "draft",
            favorite: false
          });
          await put("customExperiences", copy);
          replaceCustomExperience(copy);
          openBuilder(copy.id);
        }
      }, "Duplicate"),
      node("button", {
        class: "small-action danger-lite",
        type: "button",
        onClick: async () => {
          if (!confirm("Delete “" + experience.name + "”? Existing Runs stay in History.")) {
            return;
          }
          await deleteCustomExperience(experience);
        }
      }, "Delete")
    ])
  ]);
}

function renderCreations() {
  const filtered = state.customExperiences.filter((experience) => {
    if (state.creationFilter === "drafts") {
      return experience.status === "draft";
    }
    if (state.creationFilter === "published") {
      return experience.status === "published";
    }
    if (state.creationFilter === "favorites") {
      return experience.favorite;
    }
    return true;
  });

  const content = node("main", {
    class: "content creations-view"
  }, [
    node("div", { class: "creation-page-head" }, [
      node("div", {}, [
        node("div", {
          class: "kicker",
          text: "Safe declarative builder"
        }),
        node("h1", {
          class: "view-title",
          text: "My Creations"
        }),
        node("p", {
          class: "view-subtitle",
          text:
            "Build randomizers from approved primitives. No custom JavaScript, HTML, or CSS."
        })
      ]),
      node("div", { class: "button-row" }, [
        node("button", {
          class: "primary",
          type: "button",
          onClick: () => openBuilder(null, "wheel")
        }, "+ New Creation"),
        node("button", {
          class: "secondary",
          type: "button",
          onClick: () => {
            state.modal = {
              type: "import-custom-experience",
              text: "",
              error: null
            };
            render();
          }
        }, "Import")
      ])
    ])
  ]);

  content.append(node("div", {
    class: "builder-starters"
  }, [
    ["wheel", "◉", "Wheel"],
    ["picker", "✦", "Picker"],
    ["dice", "⬡", "Custom Dice"],
    ["deck", "▰", "Deck"],
    ["table", "▦", "Random Table"],
    ["number", "#", "Number"],
    ["compound", "◇", "Compound"]
  ].map(([kind, icon, label]) =>
    node("button", {
      class: "starter-card",
      type: "button",
      onClick: () => openBuilder(null, kind)
    }, [
      node("span", { text: icon }),
      node("strong", { text: label })
    ])
  )));

  content.append(node("div", {
    class: "segmented creation-filter"
  }, [
    ["all", "All"],
    ["published", "Published"],
    ["drafts", "Drafts"],
    ["favorites", "Favorites"]
  ].map(([value, label]) =>
    node("button", {
      class: state.creationFilter === value ? "active" : "",
      type: "button",
      onClick: () => {
        state.creationFilter = value;
        render();
      }
    }, label)
  )));

  if (!filtered.length) {
    content.append(emptyState(
      "No creations here",
      "Start from a Wheel, Dice, Deck, Table, Number, Picker, or Compound template."
    ));
    return content;
  }

  content.append(node("div", {
    class: "creation-grid"
  }, filtered.map(customCreationCard)));

  return content;
}

function builderField(label, control) {
  return node("div", { class: "control" }, [
    node("label", { text: label }),
    control
  ]);
}

function builderTextInput(label, value, onChange, options = {}) {
  const input = node("input", {
    class: "field",
    type: options.type || "text",
    value: value == null ? "" : String(value),
    placeholder: options.placeholder || "",
    min: options.min,
    max: options.max,
    step: options.step
  });
  input.addEventListener("input", () => {
    onChange(
      options.type === "number"
        ? Number(input.value)
        : input.value
    );
  });
  return builderField(label, input);
}

function builderSelect(label, value, options, onChange) {
  const select = node("select", {
    class: "field"
  }, options.map(([optionValue, optionLabel]) =>
    node("option", {
      value: optionValue,
      text: optionLabel
    })
  ));
  select.value = value;
  select.addEventListener("change", () => {
    onChange(select.value);
    render();
  });
  return builderField(label, select);
}

function builderTextarea(label, value, onChange, placeholder = "") {
  const area = node("textarea", {
    class: "field builder-textarea",
    placeholder
  });
  area.value = value || "";
  area.addEventListener("input", () => onChange(area.value));
  return builderField(label, area);
}

function markBuilderDirty() {
  if (!state.builder) return;
  state.builder.error = null;
  state.builder.testResult = null;
}

function renderBuilderSimpleConfig(builder, panel) {
  const draft = builder.draft;
  const config = draft.config;

  if (["pick", "sample", "shuffle"].includes(draft.primitive)) {
    panel.append(builderSelect(
      "Input source",
      config.source || "embedded",
      [
        ["embedded", "Configured entries"],
        ["prompt", "Fresh list at runtime"]
      ],
      (value) => {
        config.source = value;
        if (value === "embedded" && !config.entries?.length) {
          config.entries = parseWeightedRowsText("Option A | 1\nOption B | 1");
        }
        markBuilderDirty();
      }
    ));

    if ((config.source || "embedded") === "embedded") {
      panel.append(builderTextarea(
        "Entries · label | weight | optional value",
        weightedRowsText(config.entries || []),
        (value) => {
          config.entries = parseWeightedRowsText(value);
          markBuilderDirty();
        },
        "Pizza | 1\nSushi | 2"
      ));
    }

    if (draft.primitive === "sample") {
      panel.append(
        builderTextInput(
          "Draw count",
          config.count || 2,
          (value) => {
            config.count = value;
            markBuilderDirty();
          },
          { type: "number", min: 1, max: 100 }
        )
      );
      const replacement = node("input", {
        type: "checkbox",
        checked: Boolean(config.replacement)
      });
      replacement.addEventListener("change", () => {
        config.replacement = replacement.checked;
        markBuilderDirty();
      });
      panel.append(node("label", {
        class: "settings-sound-toggle builder-check"
      }, [
        replacement,
        node("span", { text: "Allow repeated draws" })
      ]));
    }
    return;
  }

  if (draft.primitive === "number") {
    panel.append(node("div", { class: "builder-grid" }, [
      builderSelect(
        "Mode",
        config.mode || "integer",
        [
          ["integer", "Integer"],
          ["decimal", "Decimal"]
        ],
        (value) => {
          config.mode = value;
          markBuilderDirty();
        }
      ),
      builderTextInput("Minimum", config.min, (value) => {
        config.min = value;
        markBuilderDirty();
      }, { type: "number" }),
      builderTextInput("Maximum", config.max, (value) => {
        config.max = value;
        markBuilderDirty();
      }, { type: "number" }),
      builderTextInput("How many", config.count || 1, (value) => {
        config.count = value;
        markBuilderDirty();
      }, { type: "number", min: 1, max: 100 }),
      config.mode === "decimal"
        ? builderTextInput(
            "Decimal places",
            config.precision || 2,
            (value) => {
              config.precision = value;
              markBuilderDirty();
            },
            { type: "number", min: 1, max: 6 }
          )
        : null
    ]));
    const unique = node("input", {
      type: "checkbox",
      checked: Boolean(config.unique)
    });
    unique.addEventListener("change", () => {
      config.unique = unique.checked;
      markBuilderDirty();
    });
    panel.append(node("label", {
      class: "settings-sound-toggle builder-check"
    }, [
      unique,
      node("span", { text: "Unique values" })
    ]));
    return;
  }

  if (draft.primitive === "dice") {
    panel.append(builderTextInput(
      "Safe dice expression",
      config.expression || "1d6",
      (value) => {
        config.expression = value;
        markBuilderDirty();
      },
      { placeholder: "4d6kh3+2" }
    ));
    return;
  }

  if (draft.primitive === "faces") {
    panel.append(
      builderTextarea(
        "Faces · one per line",
        simpleLinesText(config.faces || []),
        (value) => {
          config.faces = parseSimpleLines(value);
          markBuilderDirty();
        }
      ),
      builderTextInput(
        "Dice count",
        config.count || 1,
        (value) => {
          config.count = value;
          markBuilderDirty();
        },
        { type: "number", min: 1, max: 100 }
      )
    );
    return;
  }

  if (draft.primitive === "deck") {
    panel.append(
      builderTextarea(
        "Cards · one per line",
        simpleLinesText(config.cards || []),
        (value) => {
          config.cards = parseSimpleLines(value);
          markBuilderDirty();
        }
      ),
      builderTextInput(
        "Draw count",
        config.drawCount || 1,
        (value) => {
          config.drawCount = value;
          markBuilderDirty();
        },
        { type: "number", min: 1, max: 100 }
      )
    );
    const replacement = node("input", {
      type: "checkbox",
      checked: Boolean(config.replacement)
    });
    replacement.addEventListener("change", () => {
      config.replacement = replacement.checked;
      markBuilderDirty();
    });
    panel.append(node("label", {
      class: "settings-sound-toggle builder-check"
    }, [
      replacement,
      node("span", { text: "Draw with replacement" })
    ]));
    return;
  }

  if (draft.primitive === "table") {
    panel.append(builderTextarea(
      "Rows · label | weight | value",
      weightedRowsText(config.rows || []),
      (value) => {
        config.rows = parseWeightedRowsText(value);
        markBuilderDirty();
      },
      "Common | 5 | 1 coin\nRare | 1 | 10 coins"
    ));
  }
}

function compoundDefaultStep(index) {
  return {
    id: "step-" + (index + 1) + "-" + Date.now().toString(36),
    name: "Step " + (index + 1),
    primitive: "pick",
    input: { kind: "config" },
    config: {
      entries: ["Option A", "Option B"]
    }
  };
}

function renderCompoundStep(builder, step, index) {
  const draft = builder.draft;
  const previous = draft.config.steps.slice(0, index);
  const card = node("article", {
    class: "compound-step-card"
  });

  const nameInput = node("input", {
    class: "field",
    value: step.name
  });
  nameInput.addEventListener("input", () => {
    step.name = nameInput.value;
    markBuilderDirty();
  });

  const primitive = node("select", {
    class: "field"
  }, [
    "pick",
    "sample",
    "shuffle",
    "number",
    "dice",
    "faces",
    "table"
  ].map((value) =>
    node("option", { value, text: value })
  ));
  primitive.value = step.primitive;
  primitive.addEventListener("change", () => {
    step.primitive = primitive.value;
    step.config = cloneData(defaultCustomConfig(step.primitive));
    step.input = { kind: "config" };
    markBuilderDirty();
    render();
  });

  const dependencyCapable = ["pick", "sample", "shuffle"].includes(step.primitive);
  const inputOptions = [
    ["config", "Own configured data"]
  ];
  if (dependencyCapable) {
    inputOptions.push(["prompt", "Runtime prompt input"]);
    previous.forEach((earlier) => {
      inputOptions.push([
        "step:" + earlier.id,
        "Previous step · " + earlier.name
      ]);
    });
  }

  const input = node("select", {
    class: "field"
  }, inputOptions.map(([value, label]) =>
    node("option", { value, text: label })
  ));
  input.value = step.input.kind === "step"
    ? "step:" + step.input.stepId
    : step.input.kind;
  input.addEventListener("change", () => {
    const value = input.value;
    step.input = value.startsWith("step:")
      ? { kind: "step", stepId: value.slice(5) }
      : { kind: value };
    markBuilderDirty();
    render();
  });

  card.append(node("div", { class: "compound-step-head" }, [
    node("span", {
      class: "template-step-number",
      text: String(index + 1)
    }),
    nameInput,
    primitive,
    input,
    draft.config.steps.length > 2
      ? node("button", {
          class: "small-action",
          type: "button",
          "aria-label": "Remove compound step " + (index + 1),
          onClick: () => {
            const removedId = step.id;
            draft.config.steps.splice(index, 1);
            draft.config.steps.forEach((candidate) => {
              if (
                candidate.input?.kind === "step"
                && candidate.input.stepId === removedId
              ) {
                candidate.input = { kind: "config" };
              }
            });
            if (draft.config.finalStepId === removedId) {
              draft.config.finalStepId =
                draft.config.steps[draft.config.steps.length - 1].id;
            }
            markBuilderDirty();
            render();
          }
        }, "×")
      : null
  ]));

  const body = node("div", { class: "compound-step-body" });

  if (["pick", "sample", "shuffle"].includes(step.primitive)) {
    if (step.input.kind === "config") {
      body.append(builderTextarea(
        "Step entries · label | weight | value",
        weightedRowsText(step.config.entries || []),
        (value) => {
          step.config.entries = parseWeightedRowsText(value);
          markBuilderDirty();
        }
      ));
    }
    if (step.primitive === "sample") {
      body.append(builderTextInput(
        "Draw count",
        step.config.count || 2,
        (value) => {
          step.config.count = value;
          markBuilderDirty();
        },
        { type: "number", min: 1, max: 100 }
      ));
    }
  } else if (step.primitive === "number") {
    body.append(node("div", { class: "builder-grid" }, [
      builderTextInput("Minimum", step.config.min ?? 1, (value) => {
        step.config.min = value;
        markBuilderDirty();
      }, { type: "number" }),
      builderTextInput("Maximum", step.config.max ?? 100, (value) => {
        step.config.max = value;
        markBuilderDirty();
      }, { type: "number" })
    ]));
  } else if (step.primitive === "dice") {
    body.append(builderTextInput(
      "Dice expression",
      step.config.expression || "1d6",
      (value) => {
        step.config.expression = value;
        markBuilderDirty();
      }
    ));
  } else if (step.primitive === "faces") {
    body.append(builderTextarea(
      "Faces",
      simpleLinesText(step.config.faces || []),
      (value) => {
        step.config.faces = parseSimpleLines(value);
        markBuilderDirty();
      }
    ));
  } else if (step.primitive === "table") {
    body.append(builderTextarea(
      "Rows · label | weight | value",
      weightedRowsText(step.config.rows || []),
      (value) => {
        step.config.rows = parseWeightedRowsText(value);
        markBuilderDirty();
      }
    ));
  }

  card.append(body);
  return card;
}

function renderBuilder() {
  const builder = state.builder;
  if (!builder) {
    return node("main", { class: "content" }, [
      emptyState(
        "No Builder draft open",
        "Open My Creations and start or edit a creation.",
        "My Creations",
        () => setView("creations")
      )
    ]);
  }

  const draft = builder.draft;
  const validation = validateCustomExperience(draft);

  const content = node("main", {
    class: "content builder-view"
  });

  content.append(node("div", {
    class: "builder-head"
  }, [
    iconButton("Back to My Creations", "←", () => setView("creations")),
    node("div", {}, [
      node("div", {
        class: "kicker",
        text: draft.status === "published" ? "Published creation" : "Draft creation"
      }),
      node("h1", {
        class: "view-title",
        text: draft.name || "Untitled Creation"
      }),
      node("p", {
        class: "view-subtitle",
        text:
          "Declarative only · "
          + draft.primitive
          + " · revision "
          + draft.revision
      })
    ])
  ]));

  if (builder.error) {
    content.append(toolError(builder.error));
  }

  content.append(node("div", {
    class: "builder-safety-banner"
  }, [
    node("strong", { text: "Safe Builder" }),
    node("span", {
      text:
        "No JavaScript, HTML, CSS, event handlers, network code, or arbitrary expressions are accepted. Dice notation is parsed by the safe Dice engine."
    })
  ]));

  const identity = node("section", {
    class: "builder-panel"
  }, [
    node("h2", { text: "1. Identity" })
  ]);

  const name = node("input", {
    class: "field",
    value: draft.name
  });
  name.addEventListener("input", () => {
    draft.name = name.value;
    markBuilderDirty();
  });

  const description = node("textarea", {
    class: "field builder-description"
  });
  description.value = draft.description || "";
  description.addEventListener("input", () => {
    draft.description = description.value;
    markBuilderDirty();
  });

  identity.append(
    node("div", { class: "builder-grid" }, [
      builderField("Name", name),
      builderTextInput("Icon", draft.icon, (value) => {
        draft.icon = value;
        markBuilderDirty();
      })
    ]),
    builderField("Description", description)
  );

  const primitivePanel = node("section", {
    class: "builder-panel"
  }, [
    node("h2", { text: "2. Randomization" })
  ]);

  primitivePanel.append(builderSelect(
    "Primitive",
    draft.primitive,
    CUSTOM_PRIMITIVES.map((value) => [value, value]),
    (value) => {
      draft.primitive = value;
      draft.config = cloneData(defaultCustomConfig(value));
      markBuilderDirty();
    }
  ));

  if (draft.primitive === "compound") {
    const steps = node("div", {
      class: "compound-step-list"
    }, draft.config.steps.map((step, index) =>
      renderCompoundStep(builder, step, index)
    ));

    primitivePanel.append(steps);

    primitivePanel.append(node("div", {
      class: "builder-compound-actions"
    }, [
      node("button", {
        class: "small-action",
        type: "button",
        disabled:
          draft.config.steps.length >= 8
            ? "disabled"
            : null,
        onClick: () => {
          draft.config.steps.push(
            compoundDefaultStep(draft.config.steps.length)
          );
          draft.config.finalStepId =
            draft.config.steps[draft.config.steps.length - 1].id;
          markBuilderDirty();
          render();
        }
      }, "+ Add step"),
      builderSelect(
        "Final output",
        draft.config.finalStepId,
        draft.config.steps.map((step) => [step.id, step.name]),
        (value) => {
          draft.config.finalStepId = value;
          markBuilderDirty();
        }
      )
    ]));
  } else {
    renderBuilderSimpleConfig(builder, primitivePanel);
  }

  const rulesPanel = node("section", {
    class: "builder-panel"
  }, [
    node("h2", { text: "3. Rules" }),
    node("p", {
      class: "builder-panel-copy",
      text:
        "Safe input rules apply to list-consuming primitives: deduplicate labels, exclude exact labels, and enforce bounded item counts."
    })
  ]);

  if (!draft.rules) {
    draft.rules = {
      deduplicate: false,
      excludedLabels: [],
      caseSensitiveExclusions: false,
      minItems: 1,
      maxItems: 500
    };
  }

  const dedupe = node("input", {
    type: "checkbox",
    checked: Boolean(draft.rules.deduplicate)
  });
  dedupe.addEventListener("change", () => {
    draft.rules.deduplicate = dedupe.checked;
    markBuilderDirty();
  });

  const caseSensitive = node("input", {
    type: "checkbox",
    checked: Boolean(draft.rules.caseSensitiveExclusions)
  });
  caseSensitive.addEventListener("change", () => {
    draft.rules.caseSensitiveExclusions = caseSensitive.checked;
    markBuilderDirty();
  });

  rulesPanel.append(
    node("div", { class: "builder-grid" }, [
      builderTextInput(
        "Minimum input items",
        draft.rules.minItems ?? 1,
        (value) => {
          draft.rules.minItems = value;
          markBuilderDirty();
        },
        { type: "number", min: 1, max: 500 }
      ),
      builderTextInput(
        "Maximum input items",
        draft.rules.maxItems ?? 500,
        (value) => {
          draft.rules.maxItems = value;
          markBuilderDirty();
        },
        { type: "number", min: 1, max: 500 }
      )
    ]),
    builderTextarea(
      "Excluded labels · one per line",
      simpleLinesText(draft.rules.excludedLabels || []),
      (value) => {
        draft.rules.excludedLabels = parseSimpleLines(value);
        markBuilderDirty();
      }
    ),
    node("div", { class: "builder-rule-toggles" }, [
      node("label", {
        class: "settings-sound-toggle builder-check"
      }, [
        dedupe,
        node("span", { text: "Deduplicate labels" })
      ]),
      node("label", {
        class: "settings-sound-toggle builder-check"
      }, [
        caseSensitive,
        node("span", { text: "Case-sensitive exclusions" })
      ])
    ])
  );

  const appearance = node("section", {
    class: "builder-panel"
  }, [
    node("h2", { text: "4. Appearance" }),
    node("div", { class: "builder-grid" }, [
      builderSelect(
        "Accent",
        draft.appearance.accent,
        CUSTOM_ACCENTS.map((value) => [value, value]),
        (value) => {
          draft.appearance.accent = value;
          markBuilderDirty();
        }
      ),
      builderSelect(
        "Stage layout",
        draft.appearance.layout,
        CUSTOM_LAYOUTS.map((value) => [value, value]),
        (value) => {
          draft.appearance.layout = value;
          markBuilderDirty();
        }
      ),
      builderTextInput(
        "Result label",
        draft.appearance.resultLabel,
        (value) => {
          draft.appearance.resultLabel = value;
          markBuilderDirty();
        }
      ),
      builderTextInput(
        "Action label",
        draft.appearance.actionLabel,
        (value) => {
          draft.appearance.actionLabel = value;
          markBuilderDirty();
        }
      )
    ])
  ]);

  const test = node("section", {
    class: "builder-panel builder-test-panel"
  }, [
    node("div", { class: "builder-panel-head" }, [
      node("div", {}, [
        node("h2", { text: "5. Test Mode" }),
        node("p", {
          text:
            "Test runs use a deterministic Builder-only seed. They create no Run and do not advance your app's seeded sequence."
        })
      ]),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: testBuilder
      }, "TEST")
    ])
  ]);

  if (customExperienceNeedsPromptInput(draft)) {
    test.append(builderTextarea(
      "Test input",
      builder.testInput,
      (value) => {
        builder.testInput = value;
        builder.testResult = null;
      }
    ));
  }

  if (builder.testResult) {
    test.append(node("div", {
      class: "builder-test-result"
    }, [
      node("span", { text: "Test result" }),
      node("strong", {
        text: builder.testResult.summary
      }),
      builder.testResult.detail
        ? node("pre", {
            text: JSON.stringify(builder.testResult.detail, null, 2)
          })
        : null
    ]));
  }

  const validationPanel = node("section", {
    class:
      "builder-validation "
      + (validation.valid ? "is-valid" : "is-invalid")
  }, [
    node("strong", {
      text: validation.valid
        ? "Definition valid"
        : "Definition needs attention"
    }),
    node("span", {
      text: validation.valid
        ? "Ready to save or publish."
        : validation.errors[0]?.message || "Invalid definition."
    })
  ]);

  content.append(
    identity,
    primitivePanel,
    rulesPanel,
    appearance,
    test,
    validationPanel
  );

  content.append(node("div", {
    class: "builder-footer"
  }, [
    node("button", {
      class: "secondary",
      type: "button",
      onClick: async () => {
        try {
          await persistBuilder("draft");
        } catch (error) {
          builder.error = error?.message || "Could not save draft.";
          render();
        }
      }
    }, "Save Draft"),
    node("button", {
      class: "small-action",
      type: "button",
      disabled: validation.valid ? null : "disabled",
      onClick: () => {
        try {
          downloadCustomExperience(draft);
        } catch (error) {
          builder.error = error?.message || "Could not export.";
          render();
        }
      }
    }, "Export"),
    node("span", {
      class: "builder-footer-spacer"
    }),
    draft.status === "published"
      ? node("button", {
          class: "small-action",
          type: "button",
          onClick: async () => {
            try {
              await persistBuilder("draft");
            } catch (error) {
              builder.error = error?.message || "Could not unpublish.";
              render();
            }
          }
        }, "Unpublish")
      : null,
    node("button", {
      class: "primary",
      type: "button",
      disabled: validation.valid ? null : "disabled",
      onClick: async () => {
        try {
          const saved = await persistBuilder("published");
          if (saved) openTool(customToolId(saved.id));
        } catch (error) {
          builder.error = error?.message || "Could not publish.";
          render();
        }
      }
    }, draft.status === "published" ? "Publish Changes" : "Publish")
  ]));

  return content;
}

function renderPortableImportModal(modal, config) {
  modal.classList.add("setup-modal", "portable-import-modal");
  const summary = config.summary;

  modal.append(
    node("h2", { text: "Import Randomizer data" }),
    node("p", {
      text:
        summary.scope === "full"
          ? "This is a full app backup, including reusable content, history, and active sessions."
          : "This is a library transfer package containing reusable content and settings, without run history."
    })
  );

  if (config.error) modal.append(toolError(config.error));

  modal.append(node("div", { class: "portable-package-summary" }, [
    node("div", {}, [
      node("span", { text: "File" }),
      node("strong", { text: config.filename || "Portable package" })
    ]),
    node("div", {}, [
      node("span", { text: "Source device" }),
      node("strong", { text: summary.device?.name || "Unknown device" })
    ]),
    node("div", {}, [
      node("span", { text: "Created" }),
      node("strong", {
        text: summary.createdAt
          ? new Intl.DateTimeFormat(currentRegionalLocale(), {
              dateStyle: "medium",
              timeStyle: "short"
            }).format(new Date(summary.createdAt))
          : "Unknown"
      })
    ]),
    node("div", {}, [
      node("span", { text: "Records" }),
      node("strong", { text: String(summary.records) })
    ])
  ]));

  const modes = node("div", {
    class: "segmented portable-import-modes",
    "aria-label": "Import strategy"
  }, [
    ["merge", "Merge safely"],
    ["replace", summary.scope === "full" ? "Restore backup" : "Replace library"]
  ].map(([value, label]) =>
    node("button", {
      class: config.mode === value ? "active" : "",
      type: "button",
      disabled: config.busy ? "disabled" : null,
      onClick: () => {
        config.mode = value;
        render();
      }
    }, label)
  ));

  modal.append(
    modes,
    node("div", {
      class:
        "portable-import-explanation "
        + (config.mode === "replace" ? "is-destructive" : "is-merge")
    }, [
      node("strong", {
        text:
          config.mode === "replace"
            ? "Replacement restore"
            : "Deterministic merge"
      }),
      node("span", {
        text:
          config.mode === "replace"
            ? (
                summary.scope === "full"
                  ? "Replaces all portable app data. A full safety backup is downloaded automatically before anything is changed."
                  : "Replaces reusable library content while preserving local history and active run records. A safety backup is downloaded first."
              )
            : "Keeps newer revisions, unions unique records, never silently overwrites conflicting immutable Runs, and keeps local data on unresolved ties."
      })
    ])
  );

  modal.append(node("div", { class: "modal-actions" }, [
    node("button", {
      class: "secondary",
      type: "button",
      disabled: config.busy ? "disabled" : null,
      onClick: () => {
        state.modal = null;
        render();
      }
    }, "Cancel"),
    node("button", {
      class: config.mode === "replace" ? "danger" : "primary",
      type: "button",
      disabled: config.busy ? "disabled" : null,
      onClick: async () => {
        config.busy = true;
        config.error = null;
        render();
        try {
          await applyPortableImport(config);
        } catch (error) {
          config.busy = false;
          config.error = error?.message || "Import failed.";
          render();
        }
      }
    }, config.busy
      ? "Importing…"
      : config.mode === "replace"
        ? "Restore"
        : "Merge Import")
  ]));
}

function renderCustomImportModal(modal, config) {
  modal.classList.add("setup-modal");
  modal.append(
    node("h2", { text: "Import Custom Experience" }),
    node("p", {
      text:
        "Paste a Randomizer Arcade Custom Experience JSON export. Imports are validated and always arrive as drafts."
    })
  );

  if (config.error) modal.append(toolError(config.error));

  const area = node("textarea", {
    class: "field custom-import-text",
    placeholder: "{ ... }"
  });
  area.value = config.text || "";
  area.addEventListener("input", () => {
    config.text = area.value;
  });

  modal.append(area);

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
          const imported = importCustomExperience(config.text);
          await put("customExperiences", imported);
          replaceCustomExperience(imported);
          state.modal = null;
          openBuilder(imported.id);
        } catch (error) {
          config.error = error?.message || "Import failed.";
          render();
        }
      }
    }, "Import as Draft")
  ]));
}

function openSettingsPanel() {
  if (state.computeBusy) {
    announce("Finish the current randomization before changing settings.");
    return;
  }
  state.modal = "settings";
  render();
  Promise.all([
    ensureDeviceIdentity(),
    refreshStorageStatus()
  ]).then(() => {
    if (state.modal === "settings") render();
  }).catch(() => {});
}

function shellViewContext() {
  if (state.view === "tool") {
    const tool = currentTool();
    return {
      eyebrow: "Randomizer",
      title: tool?.name || "Tool"
    };
  }

  if (state.view === "template-session") {
    const session = templateSessionById(state.activeTemplateSessionId);
    const template = session
      ? sessionTemplateById(session.templateId)
      : null;
    return {
      eyebrow: "Guided session",
      title: template?.name || "Session"
    };
  }

  const contexts = {
    play: ["Randomizer Arcade", "Play"],
    arcade: ["Browse", "Arcade"],
    studio: ["Automation", "Decision Studio"],
    pools: ["Library", "Pools"],
    history: ["Activity", "History"],
    creations: ["Custom tools", "My Creations"],
    builder: ["Custom tools", "Builder"]
  };
  const [eyebrow, title] = contexts[state.view] || ["Randomizer Arcade", "Play"];
  return { eyebrow, title };
}

function brandLockup(className = "") {
  return node("div", {
    class: ("brand " + className).trim()
  }, [
    node("div", {
      class: "brand-icon",
      "aria-hidden": "true"
    }, iconNode("brand", { className: "brand-mark-svg" })),
    node("div", { class: "brand-copy" }, [
      node("strong", { text: "Randomizer" }),
      node("span", { text: "Arcade" })
    ])
  ]);
}

function topBar() {
  const seeded = state.settings.randomness.mode === "seeded";
  const context = shellViewContext();

  return node("header", { class: "topbar" }, [
    brandLockup("topbar-brand"),
    node("div", { class: "topbar-context" }, [
      node("div", { class: "topbar-context-copy" }, [
        node("span", {
          class: "topbar-context-kicker",
          text: context.eyebrow
        }),
        node("strong", {
          class: "topbar-context-title",
          text: context.title
        })
      ])
    ]),
    node("div", { class: "top-actions" }, [
      node("button", {
        class: "pill-button topbar-randomness",
        type: "button",
        "aria-label":
          "Randomness mode: "
          + (seeded ? "Seeded" : "Secure")
          + ". Open settings",
        title: "Randomness settings",
        onClick: openSettingsPanel
      }, [
        node("span", { class: "rng-dot", "aria-hidden": "true" }),
        node("span", {
          class: "pill-label",
          text: seeded ? "Seeded" : "Secure"
        })
      ]),
      node("button", {
        class: "icon-button topbar-settings",
        type: "button",
        "aria-label": "Open settings",
        title: "Open settings",
        onClick: openSettingsPanel
      }, iconNode("settings"))
    ])
  ]);
}

function primaryNavigation() {
  const items = [
    ["play", "play", "Play"],
    ["arcade", "arcade", "Arcade"],
    ["studio", "studio", "Studio"],
    ["pools", "pools", "Pools"],
    ["history", "history", "History"]
  ];
  const activeView = ({
    tool: "play",
    "template-session": "play",
    creations: "arcade",
    builder: "arcade"
  })[state.view] || state.view;

  const brand = node("button", {
    class: "app-nav-brand",
    type: "button",
    "aria-label": "Go to Play",
    title: "Randomizer Arcade",
    onClick: () => setView("play")
  }, [
    node("div", {
      class: "brand-icon",
      "aria-hidden": "true"
    }, iconNode("brand", { className: "brand-mark-svg" })),
    node("div", { class: "brand-copy" }, [
      node("strong", { text: "Randomizer" }),
      node("span", { text: "Arcade" })
    ])
  ]);

  const navItems = node("div", {
    class: "app-nav-items"
  }, items.map(([id, iconId, label]) => node("button", {
    class: "nav-button " + (activeView === id ? "active" : ""),
    type: "button",
    title: label,
    "aria-current": activeView === id ? "page" : null,
    onClick: () => setView(id)
  }, [
    iconNode(iconId, { className: "nav-icon" }),
    node("span", { class: "nav-label", text: label })
  ])));

  const footer = node("div", { class: "app-nav-footer" }, [
    node("div", {
      class: "nav-status-row",
      role: "status",
      "aria-label": state.networkOnline
        ? "Local-first. Ready when the network is not."
        : "Offline. Local tools remain available."
    }, [
      node("div", {
        class: "nav-status-mark",
        "aria-hidden": "true"
      }, iconNode(state.networkOnline ? "check" : "offline")),
      node("div", { class: "nav-status-copy" }, [
        node("strong", {
          text: state.networkOnline ? "Local-first" : "Offline"
        }),
        node("span", {
          text: state.networkOnline
            ? "Ready when the network is not."
            : "Local tools remain available."
        })
      ])
    ])
  ]);

  return node("nav", {
    class: "app-nav bottom-nav",
    "aria-label": "Primary navigation"
  }, [
    brand,
    node("span", {
      class: "app-nav-section-label",
      text: "Navigate",
      "aria-hidden": "true"
    }),
    navItems,
    footer
  ]);
}

function sectionHeader(title, note = "") {
  return node("div", { class: "section-head section" }, [
    node("h2", { text: title }),
    node("p", { text: note })
  ]);
}

function emptyState(title, copy, actionLabel, action) {
  const box = node("div", { class: "empty" }, [
    node("div", { class: "empty-state-mark", "aria-hidden": "true" },
      iconNode("brand")
    ),
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

function quickButton(label, id) {
  const tool = resolveTool(id);
  return node("button", {
    class: "quick-button accent-" + (tool?.accent || "cyan"),
    type: "button",
    onClick: () => openTool(id)
  }, [
    visualToolIcon(tool, "quick-tool-icon"),
    label
  ]);
}

function renderPlay() {
  const content = node("main", { class: "content home-v2" });

  const featureTool = getTool("wheel");
  const hero = node("section", {
    class: "home-hero-v2 accent-rainbow"
  }, [
    node("div", { class: "home-hero-copy" }, [
      node("div", { class: "kicker", text: "Randomizer Arcade" }),
      node("h1", { text: "Make the choice. Keep the moment." }),
      node("p", {
        text:
          "Fast randomizers for everyday decisions, games, groups, "
          + "and anything that should be left to chance."
      }),
      homeSearchBox({
        className: "home-primary-search",
        placeholder: "Search tools, uses, or ideas…"
      }),
      node("div", { class: "home-hero-actions" }, [
        node("button", {
          class: "primary home-hero-primary",
          type: "button",
          onClick: () => openTool("picker")
        }, "Pick something"),
        node("button", {
          class: "secondary",
          type: "button",
          onClick: () => setView("arcade")
        }, "Browse all tools")
      ])
    ]),
    node("button", {
      class: "home-feature",
      type: "button",
      onClick: () => openTool(featureTool.id),
      "aria-label": "Open Wheel"
    }, [
      node("div", { class: "home-feature-orbit", "aria-hidden": "true" }, [
        node("span", { class: "home-feature-ring ring-one" }),
        node("span", { class: "home-feature-ring ring-two" }),
        visualToolIcon(featureTool, "home-feature-icon")
      ]),
      node("div", { class: "home-feature-copy" }, [
        node("span", { text: "Featured randomizer" }),
        node("strong", { text: featureTool.name }),
        node("small", { text: "Spin any list into a decision." })
      ])
    ])
  ]);

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    const customResults = state.customExperiences
      .filter((experience) => experience.status === "published")
      .filter((experience) =>
        [
          experience.name,
          experience.description,
          experience.primitive,
          ...(experience.tags || [])
        ].join(" ").toLowerCase().includes(q)
      )
      .map(experienceAsTool);
    const results = [
      ...searchTools(state.search),
      ...customResults
    ];

    content.append(hero);
    content.append(node("section", {
      class: "home-section home-search-results"
    }, [
      homeSectionHeader(
        "Search results",
        results.length + (results.length === 1 ? " match" : " matches"),
        "Clear",
        () => {
          state.search = "";
          render();
        }
      ),
      results.length
        ? node("div", { class: "home-tool-grid search-tool-grid" },
            results.map((tool, index) =>
              toolCard(tool, {
                variant: index < 2 ? "wide" : "standard"
              })
            )
          )
        : emptyState(
            "No randomizer found",
            "Try a broader word or browse the full Arcade.",
            "Browse Arcade",
            () => {
              state.search = "";
              setView("arcade");
            }
          )
    ]));
    return content;
  }

  content.append(hero);

  content.append(node("section", {
    class: "home-quick-launch",
    "aria-label": "Quick randomizers"
  }, [
    quickButton("Coin", "coin"),
    quickButton("Dice", "dice"),
    quickButton("Wheel", "wheel"),
    quickButton("Number", "number")
  ]));

  const continuations = homeContinuations();
  if (continuations.length) {
    content.append(node("section", {
      class: "home-section continue-section"
    }, [
      homeSectionHeader(
        "Continue",
        "Pick up an unfinished session."
      ),
      node("div", { class: "continue-grid" },
        continuations.map(continuationCard)
      )
    ]));
  }

  const recent = recentHomeTools(6);
  if (recent.length) {
    content.append(node("section", {
      class: "home-section recent-section"
    }, [
      homeSectionHeader(
        "Jump back in",
        "Your recently used randomizers.",
        "History",
        () => setView("history")
      ),
      node("div", { class: "home-tool-grid recent-tool-grid" },
        recent.map(({ tool, run }, index) =>
          toolCard(tool, {
            variant: index === 0 ? "wide" : "compact",
            eyebrow: index === 0 ? "Most recent" : "",
            note: run.timestamp
              ? localizedDateTime(run.timestamp, {
                  month: "short",
                  day: "numeric"
                })
              : ""
          })
        )
      )
    ]));
  }

  const favorites = [
    ...TOOLS.filter((tool) => state.favorites.includes(tool.id)),
    ...state.customExperiences
      .filter(
        (experience) =>
          experience.status === "published"
          && (
            experience.favorite
            || state.favorites.includes(customToolId(experience.id))
          )
      )
      .map(experienceAsTool)
  ];

  if (favorites.length) {
    content.append(node("section", {
      class: "home-section favorites-section"
    }, [
      homeSectionHeader(
        "Favorites",
        "Your pinned shortcuts.",
        "Arcade",
        () => setView("arcade")
      ),
      node("div", { class: "favorite-strip" },
        favorites.slice(0, 8).map((tool) =>
          toolCard(tool, { variant: "compact" })
        )
      )
    ]));
  }

  const favoritePresets = state.presets.filter((preset) => preset.favorite);
  const regularPresets = state.presets.filter((preset) => !preset.favorite);
  const templates = allSessionTemplates();

  if (state.presets.length || templates.length) {
    content.append(node("section", {
      class: "home-section home-library-section"
    }, [
      homeSectionHeader(
        "Saved & guided",
        "Reusable setups and multi-step sessions."
      ),
      node("div", { class: "home-library-layout" }, [
        state.presets.length
          ? node("div", { class: "home-library-panel" }, [
              node("div", { class: "home-library-panel-head" }, [
                node("div", {}, [
                  node("span", { text: "Presets" }),
                  node("strong", { text: "Saved setups" })
                ]),
                node("small", {
                  text:
                    favoritePresets.length
                      ? favoritePresets.length + " favorite"
                      : state.presets.length + " saved"
                })
              ]),
              node("div", { class: "saved-setup-grid home-saved-grid" }, [
                ...favoritePresets.map(presetCard),
                ...regularPresets.map(presetCard)
              ])
            ])
          : null,
        node("div", { class: "home-library-panel template-home-panel" }, [
          node("div", { class: "home-library-panel-head" }, [
            node("div", {}, [
              node("span", { text: "Sessions" }),
              node("strong", { text: "Guided flows" })
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
                    {
                      presetId: state.presets[0]?.id || "",
                      inputKind: "preset"
                    },
                    {
                      presetId:
                        state.presets[1]?.id
                        || state.presets[0]?.id
                        || "",
                      inputKind: "previous"
                    }
                  ],
                  error: null
                };
                render();
              }
            }, "+ New")
          ]),
          node("div", { class: "session-template-grid home-template-grid" },
            templates.map(templateCard)
          )
        ])
      ].filter(Boolean))
    ]));
  }

  const explore = [
    "picker",
    "teams",
    "dice",
    "color",
    "elimination",
    "tournament"
  ].map(getTool).filter(Boolean);

  content.append(node("section", {
    class: "home-section explore-section"
  }, [
    homeSectionHeader(
      "Explore",
      "Useful starting points across the Arcade.",
      "All " + TOOLS.length + " tools",
      () => setView("arcade")
    ),
    node("div", { class: "home-tool-grid explore-tool-grid" },
      explore.map((tool, index) =>
        toolCard(tool, {
          variant: index < 2 ? "wide" : "standard"
        })
      )
    )
  ]));

  return content;
}

function renderArcade() {
  const publishedCustom = state.customExperiences.filter(
    (experience) => experience.status === "published"
  );
  const totalTools = TOOLS.length + publishedCustom.length;
  const content = node("main", {
    class: "content arcade-v2"
  });

  content.append(node("section", { class: "arcade-hero-v2" }, [
    node("div", { class: "arcade-hero-copy" }, [
      node("span", { class: "kicker", text: "Complete library" }),
      node("h1", { text: "The Arcade" }),
      node("p", {
        text:
          "Every randomizer in one place—organized by what you "
          + "want chance to do."
      }),
      node("div", { class: "arcade-stats" }, [
        node("span", {}, [
          node("strong", { text: String(totalTools) }),
          " tools"
        ]),
        node("span", {}, [
          node("strong", { text: String(CATEGORIES.length) }),
          " categories"
        ]),
        publishedCustom.length
          ? node("span", {}, [
              node("strong", { text: String(publishedCustom.length) }),
              " custom"
            ])
          : null
      ].filter(Boolean))
    ]),
    node("div", { class: "arcade-hero-actions" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => setView("creations")
      }, publishedCustom.length ? "My Creations" : "Create a tool")
    ]),
    homeSearchBox({
      className: "arcade-primary-search",
      placeholder: "Search all randomizers…"
    })
  ]));

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    const customResults = publishedCustom
      .filter((experience) =>
        [
          experience.name,
          experience.description,
          experience.primitive,
          ...(experience.tags || [])
        ].join(" ").toLowerCase().includes(q)
      )
      .map(experienceAsTool);
    const results = [
      ...searchTools(state.search),
      ...customResults
    ];

    content.append(node("section", {
      class: "arcade-section arcade-search-section"
    }, [
      homeSectionHeader(
        "Search results",
        results.length + (results.length === 1 ? " match" : " matches"),
        "Clear",
        () => {
          state.search = "";
          render();
        }
      ),
      results.length
        ? node("div", { class: "arcade-tool-grid search-tool-grid" },
            results.map((tool, index) =>
              toolCard(tool, {
                variant: index < 2 ? "wide" : "standard"
              })
            )
          )
        : emptyState(
            "Nothing matched",
            "Try another word or clear the search to browse by category."
          )
    ]));
    return content;
  }

  content.append(node("nav", {
    class: "arcade-category-jumps",
    "aria-label": "Randomizer categories"
  }, CATEGORIES.map((category) => {
    const count = TOOLS.filter(
      (tool) => tool.category === category.id
    ).length;
    return node("button", {
      class: "category-jump category-" + category.id,
      type: "button",
      onClick: () => {
        document.getElementById(
          "arcade-category-" + category.id
        )?.scrollIntoView({
          behavior: prefersReducedMotionNow() ? "auto" : "smooth",
          block: "start"
        });
      }
    }, [
      visualCategoryIcon(category, "category-jump-icon"),
      node("span", {}, [
        node("strong", { text: category.name }),
        node("small", {
          text: count + (count === 1 ? " tool" : " tools")
        })
      ])
    ]);
  })));

  if (publishedCustom.length) {
    content.append(node("section", {
      class: "arcade-section custom-arcade-section"
    }, [
      homeSectionHeader(
        "My Creations",
        publishedCustom.length + " published",
        "Manage",
        () => setView("creations")
      ),
      node("div", { class: "arcade-tool-grid custom-tool-grid" },
        publishedCustom.map((experience, index) =>
          toolCard(experienceAsTool(experience), {
            variant: index === 0 ? "wide" : "standard",
            eyebrow: index === 0 ? "Your collection" : ""
          })
        )
      )
    ]));
  }

  for (const category of CATEGORIES) {
    const tools = TOOLS.filter(
      (tool) => tool.category === category.id
    );
    if (!tools.length) continue;

    content.append(node("section", {
      class:
        "arcade-section arcade-category-section category-"
        + category.id,
      id: "arcade-category-" + category.id
    }, [
      node("div", { class: "arcade-category-head" }, [
        node("div", { class: "arcade-category-mark" },
          visualCategoryIcon(category, "category-icon")
        ),
        node("div", { class: "arcade-category-copy" }, [
          node("div", {}, [
            node("h2", { text: category.name }),
            node("span", {
              text:
                tools.length
                + (tools.length === 1 ? " tool" : " tools")
            })
          ]),
          node("p", { text: arcadeCategoryCopy(category.id) })
        ])
      ]),
      node("div", { class: "arcade-tool-grid" },
        tools.map((tool, index) =>
          toolCard(tool, {
            variant: index === 0 ? "feature" : "standard",
            eyebrow: index === 0 ? "Category pick" : ""
          })
        )
      )
    ]));
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
    visibleLimit: POOL_RENDER_CHUNK,
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
  search.addEventListener("change", () => {
    render();
  });
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
  await deleteMatching(
    "runs",
    (run) =>
      !run.sessionId
      && !run.templateSessionId
      && !run.partySessionId
      && !run.workflowSessionId
  );
  await clear("history");

  for (const key of [...state.historyPins]) {
    if (key.startsWith("burst:") || key.startsWith("run:")) {
      await remove("historyPins", key);
      state.historyPins.delete(key);
    }
  }

  state.runs = state.runs.filter(
    (run) =>
      run.sessionId
      || run.templateSessionId
      || run.partySessionId
      || run.workflowSessionId
  );
  state.history = [];
  render();
}

async function loadOlderHistory() {
  if (state.historyPaging.loading) return;
  if (
    !state.historyPaging.runsHasMore
    && !state.historyPaging.historyHasMore
  ) return;

  state.historyPaging.loading = true;
  render();

  try {
    const [runPage, historyPage] = await Promise.all([
      state.historyPaging.runsHasMore
        ? getRecentPage("runs", "recent", {
            limit: HISTORY_PAGE_SIZE,
            before: state.historyPaging.runsBefore
          })
        : Promise.resolve(null),
      state.historyPaging.historyHasMore
        ? getRecentPage("history", "recent", {
            limit: HISTORY_PAGE_SIZE,
            before: state.historyPaging.historyBefore
          })
        : Promise.resolve(null)
    ]);

    if (runPage) {
      const knownSessionIds = new Set(
        state.sessions.map((session) => String(session.id))
      );
      const missingSessionIds = [...new Set(
        runPage.records
          .map((run) => run.sessionId)
          .filter(Boolean)
          .map(String)
      )].filter((id) => !knownSessionIds.has(id));

      if (missingSessionIds.length) {
        const linkedSessions = await getMany(
          "sessions",
          missingSessionIds
        );
        state.sessions = mergeRecentRecords(
          state.sessions,
          linkedSessions,
          { sortKey: "updatedAt" }
        );
      }

      state.runs = mergeRecentRecords(
        state.runs,
        runPage.records,
        { sortKey: "timestamp" }
      );
      state.historyPaging.runsBefore = runPage.nextCursor;
      state.historyPaging.runsHasMore = runPage.hasMore;
    }

    if (historyPage) {
      state.history = mergeRecentRecords(
        state.history,
        historyPage.records,
        { sortKey: "timestamp" }
      );
      state.historyPaging.historyBefore = historyPage.nextCursor;
      state.historyPaging.historyHasMore = historyPage.hasMore;
    }

    state.historyRenderLimit = nextProgressiveLimit(
      state.historyRenderLimit,
      state.runs.length + state.history.length,
      HISTORY_RENDER_CHUNK
    );
  } catch (error) {
    announce(error?.message || "Could not load older History.");
  } finally {
    state.historyPaging.loading = false;
    render();
  }
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
        state.historyRenderLimit = HISTORY_RENDER_CHUNK;
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

  const formatter = new Intl.DateTimeFormat(currentRegionalLocale(), {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const groupWindow = progressiveSlice(
    groups,
    state.historyRenderLimit,
    HISTORY_RENDER_CHUNK
  );
  const list = node("div", { class: "history-group-list" });

  for (const group of groupWindow.visible) {
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
        "aria-label": pinned ? "Unpin History group" : "Pin History group",
        onClick: () => toggleHistoryPin(pinKey)
      }, pinned ? "★" : "☆")
    ]);

    if (group.kind === "session" && session) {
      actions.append(node("button", {
        class: "secondary",
        type: "button",
        onClick: () => resumeStoredSession(session)
      }, session.status === "active" ? "Resume" : "Open"));
    } else if (
      latest.origin !== "legacy"
      && latest.afterState
      && resolveTool(latest.toolId)
    ) {
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
      onClick: () => openRunDetailById(latest.id)
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
      node("div", { class: "history-icon" },
        visualToolIcon(
          resolveTool(group.toolId) || {
            id: group.toolId,
            icon: group.icon || "✦"
          },
          "history-tool-icon"
        )
      ),
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

  if (
    groupWindow.hasMore
    || state.historyPaging.runsHasMore
    || state.historyPaging.historyHasMore
  ) {
    content.append(node("div", {
      class: "history-load-more"
    }, [
      node("span", {
        text:
          groupWindow.shown
          + " of "
          + groups.length
          + " loaded groups shown"
      }),
      node("button", {
        class: "secondary",
        type: "button",
        disabled: state.historyPaging.loading ? "disabled" : null,
        onClick: () => {
          if (groupWindow.hasMore) {
            state.historyRenderLimit = groupWindow.nextLimit;
            render();
          } else {
            loadOlderHistory();
          }
        }
      }, state.historyPaging.loading
        ? "Loading…"
        : groupWindow.hasMore
          ? "Show more"
          : "Load older History")
    ]));
  }

  return content;
}
function workflowPresetChoices() {
  return state.presets.filter((preset) => {
    const tool = resolveTool(preset.toolId);
    return tool && !isStatefulTool(tool.id);
  });
}

function workflowValidation(workflow, allowDraft = false) {
  return validateWorkflow(workflow, {
    presetIds: new Set(
      workflowPresetChoices().map((preset) => preset.id)
    ),
    allowDraft
  });
}

function workflowNodeLabel(workflow, nodeId) {
  return workflow.nodes.find((node) => node.id === nodeId)?.name || "Unknown node";
}

function workflowNodeIcon(type, className = "") {
  const iconId = {
    input: "input",
    tool: "brand",
    branch: "branch",
    output: "output"
  }[type] || "brand";
  return iconNode(iconId, { className });
}

function workflowStatusText(status) {
  return {
    active: "Running",
    paused: "Paused",
    completed: "Completed",
    abandoned: "Ended",
    error: "Error"
  }[status] || String(status || "Unknown");
}

function startWorkflowEditor(workflow = null) {
  const draft = workflow
    ? normalizeWorkflow(cloneData(workflow))
    : createWorkflow({
        name: "New decision workflow",
        description: "Connect inputs, saved randomizer Presets, branches, and outcomes."
      });

  state.workflowEditor = {
    draft,
    baseRevision: workflow?.revision ?? null,
    selectedNodeId: draft.startNodeId,
    error: null
  };
  state.activeWorkflowSessionId = null;
  state.view = "studio";
  state.toolId = null;
  history.replaceState({}, "", location.pathname + "?studio=edit");
  render();
  scrollToTop();
}

function closeWorkflowEditor() {
  state.workflowEditor = null;
  history.replaceState({}, "", location.pathname);
  render();
}

function workflowEditorNode(nodeId) {
  return state.workflowEditor?.draft?.nodes?.find(
    (candidate) => candidate.id === nodeId
  ) || null;
}

function setWorkflowEdge(draft, from, port, to) {
  draft.edges = draft.edges.filter(
    (edge) => !(edge.from === from && edge.port === port)
  );
  if (to) {
    draft.edges.push(createWorkflowEdge(from, to, { port }));
  }
}

function addWorkflowEditorNode(type) {
  const editor = state.workflowEditor;
  if (!editor) return;

  const choices = workflowPresetChoices();
  const created = createWorkflowNode(type, {
    position: {
      x: 60 + (editor.draft.nodes.length % 3) * 280,
      y: 80 + Math.floor(editor.draft.nodes.length / 3) * 190
    },
    config:
      type === "tool"
        ? {
            presetId: choices[0]?.id || "",
            inputMode: "previous"
          }
        : {}
  });

  const selected = workflowEditorNode(editor.selectedNodeId);
  if (selected && selected.type !== "output" && selected.type !== "branch") {
    const existing = editor.draft.edges.find(
      (edge) => edge.from === selected.id && edge.port === "next"
    );
    setWorkflowEdge(editor.draft, selected.id, "next", created.id);

    if (created.type === "branch" && existing?.to) {
      setWorkflowEdge(editor.draft, created.id, "true", existing.to);
      setWorkflowEdge(editor.draft, created.id, "false", existing.to);
    } else if (created.type !== "output" && existing?.to) {
      setWorkflowEdge(editor.draft, created.id, "next", existing.to);
    }
  }

  editor.draft.nodes.push(created);
  editor.selectedNodeId = created.id;
  editor.error = null;
  render();
}

function removeWorkflowEditorNode(nodeId) {
  const editor = state.workflowEditor;
  if (!editor || editor.draft.nodes.length <= 1) return;

  editor.draft.nodes = editor.draft.nodes.filter((node) => node.id !== nodeId);
  editor.draft.edges = editor.draft.edges.filter(
    (edge) => edge.from !== nodeId && edge.to !== nodeId
  );

  if (editor.draft.startNodeId === nodeId) {
    editor.draft.startNodeId = editor.draft.nodes[0]?.id || null;
  }
  if (editor.selectedNodeId === nodeId) {
    editor.selectedNodeId = editor.draft.startNodeId;
  }
  editor.error = null;
  render();
}

function workflowTargetSelect(draft, nodeDef, port, label) {
  const select = node("select", {
    class: "field workflow-target-select",
    "aria-label": label
  }, [
    node("option", { value: "", text: "Not connected" }),
    ...draft.nodes
      .filter((candidate) => candidate.id !== nodeDef.id)
      .map((candidate) =>
        node("option", {
          value: candidate.id,
          text: candidate.name + " · " + candidate.type
        })
      )
  ]);

  select.value = draft.edges.find(
    (edge) => edge.from === nodeDef.id && edge.port === port
  )?.to || "";

  select.addEventListener("change", () => {
    setWorkflowEdge(draft, nodeDef.id, port, select.value || null);
    state.workflowEditor.error = null;
    render();
  });

  return node("label", { class: "workflow-edge-control" }, [
    node("span", { text: label }),
    select
  ]);
}

function workflowNodeEditorCard(editor, nodeDef, index) {
  const draft = editor.draft;
  const selected = editor.selectedNodeId === nodeDef.id;
  const incoming = draft.edges.filter((edge) => edge.to === nodeDef.id).length;
  const selectNode = () => {
    if (editor.selectedNodeId !== nodeDef.id) {
      editor.selectedNodeId = nodeDef.id;
      render();
    }
  };

  const card = node("article", {
    class:
      "workflow-node-card workflow-node-" + nodeDef.type
      + (selected ? " is-selected" : "")
      + (draft.startNodeId === nodeDef.id ? " is-start" : ""),
    role: "group",
    tabindex: "0",
    "aria-label":
      nodeDef.name
      + " · "
      + nodeDef.type
      + (selected ? " · selected" : ""),
    onClick: selectNode,
    onKeydown: (event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectNode();
      }
    }
  });

  const nameInput = node("input", {
    class: "field workflow-node-name",
    type: "text",
    value: nodeDef.name,
    "aria-label": "Node name"
  });
  nameInput.addEventListener("input", () => {
    nodeDef.name = nameInput.value.slice(0, 80);
  });

  card.append(node("div", { class: "workflow-node-head" }, [
    workflowNodeIcon(nodeDef.type, "workflow-node-glyph"),
    node("div", { class: "workflow-node-heading" }, [
      node("small", {
        text:
          (draft.startNodeId === nodeDef.id ? "Start · " : "")
          + nodeDef.type
          + " · "
          + incoming
          + " incoming"
      }),
      nameInput
    ]),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: (event) => {
        event.stopPropagation();
        draft.startNodeId = nodeDef.id;
        editor.selectedNodeId = nodeDef.id;
        render();
      }
    }, draft.startNodeId === nodeDef.id ? "Start" : "Set start")
  ]));

  const config = node("div", { class: "workflow-node-config" });

  if (nodeDef.type === "input") {
    const mode = node("select", {
      class: "field",
      "aria-label": "Input mode"
    }, [
      node("option", { value: "prompt", text: "Ask when workflow starts" }),
      node("option", { value: "fixed", text: "Use fixed items" })
    ]);
    mode.value = nodeDef.config.mode;
    mode.addEventListener("change", () => {
      nodeDef.config.mode = mode.value;
      render();
    });

    config.append(node("label", { class: "control" }, [
      node("span", { text: "Input source" }),
      mode
    ]));

    if (nodeDef.config.mode === "fixed") {
      const fixed = node("textarea", {
        class: "field workflow-fixed-input",
        "aria-label": "Fixed input items",
        placeholder: "One item per line"
      });
      fixed.value = (nodeDef.config.fixedItems || []).join("\n");
      fixed.addEventListener("input", () => {
        nodeDef.config.fixedItems = parseList(fixed.value).slice(0, 500);
      });
      config.append(node("label", { class: "control" }, [
        node("span", { text: "Fixed items" }),
        fixed
      ]));
    }
  } else if (nodeDef.type === "tool") {
    const choices = workflowPresetChoices();
    const preset = node("select", {
      class: "field",
      "aria-label": "Saved Preset"
    }, [
      node("option", { value: "", text: "Choose a Preset" }),
      ...choices.map((item) => {
        const tool = resolveTool(item.toolId);
        return node("option", {
          value: item.id,
          text: item.name + " · " + (tool?.name || item.toolId)
        });
      })
    ]);
    preset.value = nodeDef.config.presetId || "";
    preset.addEventListener("change", () => {
      nodeDef.config.presetId = preset.value;
      render();
    });

    const inputMode = node("select", {
      class: "field",
      "aria-label": "Randomizer input source"
    }, [
      node("option", {
        value: "previous",
        text: "Use previous node output when supported"
      }),
      node("option", {
        value: "preset",
        text: "Use the Preset's own input"
      })
    ]);
    inputMode.value = nodeDef.config.inputMode || "previous";
    inputMode.addEventListener("change", () => {
      nodeDef.config.inputMode = inputMode.value;
    });

    config.append(
      node("label", { class: "control" }, [
        node("span", { text: "Randomizer Preset" }),
        preset
      ]),
      node("label", { class: "control" }, [
        node("span", { text: "Input" }),
        inputMode
      ])
    );

    if (!choices.length) {
      config.append(node("div", {
        class: "notice",
        text: "Save at least one non-stateful Preset before adding automated Randomizer nodes."
      }));
    }
  } else if (nodeDef.type === "branch") {
    const condition = nodeDef.config.condition;
    const kind = node("select", {
      class: "field",
      "aria-label": "Branch condition"
    }, [
      ["contains", "Output contains text"],
      ["equals", "Output equals text"],
      ["count-at-least", "Output count is at least"],
      ["count-at-most", "Output count is at most"],
      ["non-empty", "Output is non-empty"],
      ["empty", "Output is empty"],
      ["always", "Always true"]
    ].map(([value, text]) => node("option", { value, text })));
    kind.value = condition.kind;
    kind.addEventListener("change", () => {
      condition.kind = kind.value;
      render();
    });

    config.append(node("label", { class: "control" }, [
      node("span", { text: "Condition" }),
      kind
    ]));

    if (["contains", "equals"].includes(condition.kind)) {
      const value = node("input", {
        class: "field",
        type: "text",
        value: condition.value || "",
        placeholder: "Text to match"
      });
      value.addEventListener("input", () => {
        condition.value = value.value;
      });
      const sensitive = node("input", {
        type: "checkbox",
        checked: Boolean(condition.caseSensitive)
      });
      sensitive.addEventListener("change", () => {
        condition.caseSensitive = sensitive.checked;
      });
      config.append(
        node("label", { class: "control" }, [
          node("span", { text: "Match" }),
          value
        ]),
        node("label", { class: "workflow-inline-check" }, [
          sensitive,
          node("span", { text: "Case-sensitive" })
        ])
      );
    } else if (["count-at-least", "count-at-most"].includes(condition.kind)) {
      const count = node("input", {
        class: "field",
        type: "number",
        min: "0",
        max: "10000",
        value: String(condition.count ?? 1)
      });
      count.addEventListener("input", () => {
        condition.count = Math.max(0, Number(count.value) || 0);
      });
      config.append(node("label", { class: "control" }, [
        node("span", { text: "Count" }),
        count
      ]));
    }
  } else if (nodeDef.type === "output") {
    const title = node("input", {
      class: "field",
      type: "text",
      value: nodeDef.config.title || "",
      placeholder: "Outcome label"
    });
    title.addEventListener("input", () => {
      nodeDef.config.title = title.value.slice(0, 120);
    });
    config.append(node("label", { class: "control" }, [
      node("span", { text: "Outcome label" }),
      title
    ]));
  }

  card.append(config);

  if (nodeDef.type === "branch") {
    card.append(node("div", { class: "workflow-edges" }, [
      workflowTargetSelect(draft, nodeDef, "true", "True →"),
      workflowTargetSelect(draft, nodeDef, "false", "False →")
    ]));
  } else if (nodeDef.type !== "output") {
    card.append(node("div", { class: "workflow-edges" }, [
      workflowTargetSelect(draft, nodeDef, "next", "Next →")
    ]));
  }

  card.append(node("div", { class: "workflow-node-footer" }, [
    node("span", { text: "Node " + (index + 1) }),
    node("button", {
      class: "danger subtle-danger",
      type: "button",
      disabled: draft.nodes.length <= 1 ? "disabled" : null,
      onClick: (event) => {
        event.stopPropagation();
        removeWorkflowEditorNode(nodeDef.id);
      }
    }, "Remove")
  ]));

  return card;
}

async function saveWorkflowEditor() {
  const editor = state.workflowEditor;
  if (!editor) return;

  const existing = workflowById(editor.draft.id);
  const candidate = existing
    ? updateWorkflow(existing, {
        name: editor.draft.name,
        description: editor.draft.description,
        automation: editor.draft.automation,
        startNodeId: editor.draft.startNodeId,
        nodes: editor.draft.nodes,
        edges: editor.draft.edges
      })
    : normalizeWorkflow(editor.draft);

  const validation = workflowValidation(candidate);
  if (!validation.valid) {
    editor.error = validation.errors[0]?.message || "Workflow is not ready to save.";
    render();
    return;
  }

  try {
    if (existing) {
      await putWithRevision("workflows", candidate, existing.revision);
    } else {
      await put("workflows", candidate);
    }
    replaceWorkflow(candidate);
    state.workflowEditor = null;
    announce("Workflow saved.");
    history.replaceState({}, "", location.pathname);
    render();
  } catch (error) {
    editor.error = error?.message || "Could not save workflow.";
    render();
  }
}

async function deleteWorkflow(workflow) {
  if (!workflow) return;
  if (!window.confirm("Delete this workflow definition? Existing workflow run history will remain.")) {
    return;
  }

  await remove("workflows", workflow.id);
  state.workflows = state.workflows.filter((item) => item.id !== workflow.id);
  state.workflowEditor = null;
  state.activeWorkflowSessionId = null;
  history.replaceState({}, "", location.pathname);
  render();
}

function renderWorkflowEditor() {
  const editor = state.workflowEditor;
  const draft = editor.draft;
  const validation = workflowValidation(draft, true);
  const strict = workflowValidation(draft);

  const content = node("main", { class: "content workflow-editor-view" }, [
    node("div", { class: "workflow-page-head" }, [
      node("div", {}, [
        node("div", { class: "kicker", text: "Decision Studio · Graph editor" }),
        node("h1", { class: "view-title", text: "Build a workflow" }),
        node("p", {
          class: "view-subtitle",
          text:
            "Connect runtime input, saved Presets, conditional branches, and terminal outcomes. "
            + "Automation is bounded and cycles are rejected."
        })
      ]),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: closeWorkflowEditor
      }, "Close")
    ])
  ]);

  const identity = node("section", { class: "controls workflow-editor-identity" });
  const name = node("input", {
    class: "field",
    type: "text",
    value: draft.name,
    placeholder: "Workflow name"
  });
  name.addEventListener("input", () => {
    draft.name = name.value.slice(0, 100);
  });

  const description = node("textarea", {
    class: "field",
    placeholder: "What does this workflow decide?"
  });
  description.value = draft.description || "";
  description.addEventListener("input", () => {
    draft.description = description.value.slice(0, 400);
  });

  const automation = node("select", {
    class: "field",
    "aria-label": "Workflow execution mode"
  }, [
    node("option", { value: "auto", text: "Auto — continue until an outcome" }),
    node("option", { value: "step", text: "Step — run one node at a time" })
  ]);
  automation.value = draft.automation.mode;
  automation.addEventListener("change", () => {
    draft.automation.mode = automation.value;
  });

  const maxSteps = node("input", {
    class: "field",
    type: "number",
    min: "1",
    max: "64",
    value: String(draft.automation.maxSteps || 24)
  });
  maxSteps.addEventListener("input", () => {
    draft.automation.maxSteps = Math.max(
      1,
      Math.min(64, Number(maxSteps.value) || 24)
    );
  });

  identity.append(
    node("label", { class: "control" }, [
      node("span", { text: "Name" }),
      name
    ]),
    node("label", { class: "control" }, [
      node("span", { text: "Description" }),
      description
    ]),
    node("div", { class: "control-grid workflow-automation-grid" }, [
      node("label", { class: "control" }, [
        node("span", { text: "Execution" }),
        automation
      ]),
      node("label", { class: "control" }, [
        node("span", { text: "Automation safety limit" }),
        maxSteps
      ])
    ])
  );

  const paletteBar = node("section", { class: "workflow-node-palette" }, [
    node("div", {}, [
      node("strong", { text: "Add node" }),
      node("span", { text: "New nodes insert after the selected linear node when possible." })
    ]),
    node("div", { class: "workflow-palette-actions" }, [
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => addWorkflowEditorNode("input")
      }, "+ Input"),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => addWorkflowEditorNode("tool")
      }, "+ Randomizer"),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => addWorkflowEditorNode("branch")
      }, "+ Branch"),
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => addWorkflowEditorNode("output")
      }, "+ Outcome")
    ])
  ]);

  const graph = node("section", { class: "workflow-graph" }, [
    node("div", { class: "workflow-graph-head" }, [
      node("div", {}, [
        node("strong", { text: "Workflow graph" }),
        node("span", {
          text:
            draft.nodes.length
            + " nodes · "
            + draft.edges.length
            + " connections"
        })
      ]),
      node("span", {
        class: "workflow-validation-pill " + (strict.valid ? "is-valid" : "is-draft"),
        text: strict.valid
          ? "Ready"
          : strict.errors.length + " issue" + (strict.errors.length === 1 ? "" : "s")
      })
    ]),
    node("div", { class: "workflow-node-grid" },
      draft.nodes.map((nodeDef, index) =>
        workflowNodeEditorCard(editor, nodeDef, index)
      )
    )
  ]);

  content.append(identity, paletteBar, graph);

  const issues = strict.valid
    ? validation.warnings
    : strict.errors.slice(0, 6);
  if (issues.length) {
    content.append(node("section", {
      class: "workflow-validation-list " + (strict.valid ? "is-warning" : "is-error")
    }, [
      node("strong", {
        text: strict.valid ? "Graph notes" : "Fix before saving"
      }),
      ...issues.map((issue) => node("span", { text: issue.message }))
    ]));
  }

  if (editor.error) content.append(toolError(editor.error));

  const existing = workflowById(draft.id);
  content.append(node("div", { class: "workflow-editor-footer" }, [
    existing
      ? node("button", {
          class: "danger",
          type: "button",
          onClick: () => deleteWorkflow(existing)
        }, "Delete workflow")
      : node("span"),
    node("div", { class: "workflow-editor-save-actions" }, [
      node("button", {
        class: "secondary",
        type: "button",
        onClick: closeWorkflowEditor
      }, "Cancel"),
      node("button", {
        class: "primary",
        type: "button",
        disabled: strict.valid ? null : "disabled",
        onClick: saveWorkflowEditor
      }, existing ? "Save Changes" : "Save Workflow")
    ])
  ]));

  return content;
}

function workflowRecentSession(workflowId) {
  return state.workflowSessions
    .filter((session) => session.workflowId === workflowId)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

function openWorkflowSession(sessionId) {
  const session = workflowSessionById(sessionId);
  if (!session) return;
  state.workflowEditor = null;
  state.activeWorkflowSessionId = session.id;
  const promptItems = session.pauseReason === "input"
    ? session.nodeInputs?.[session.currentNodeId] || []
    : [];
  state.workflowInputText = promptItems.join("\n");
  state.view = "studio";
  state.toolId = null;
  history.replaceState(
    {},
    "",
    location.pathname + "?workflowSession=" + encodeURIComponent(session.id)
  );
  render();
  scrollToTop();
}

async function startWorkflowSession(workflow) {
  const validation = workflowValidation(workflow);
  if (!validation.valid) {
    announce(validation.errors[0]?.message || "Workflow is not runnable.");
    return;
  }

  try {
    const session = createWorkflowSession(workflow);
    await put("workflowSessions", session);
    replaceWorkflowSession(session);
    openWorkflowSession(session.id);

    if (session.status === "active" && workflow.automation.mode === "auto") {
      setTimeout(() => advanceWorkflowSession(session.id), 0);
    }
  } catch (error) {
    announce(error?.message || "Could not start workflow.");
  }
}

async function persistWorkflowSessionTransition(current, next) {
  await putWithRevision(
    "workflowSessions",
    next,
    current.revision
  );
  replaceWorkflowSession(next);
  state.activeWorkflowSessionId = next.id;
  return next;
}

async function submitWorkflowInput(session) {
  try {
    const items = parseList(state.workflowInputText);
    const next = provideWorkflowInput(
      session,
      items,
      session.currentNodeId
    );
    await persistWorkflowSessionTransition(session, next);
    render();

    const workflow = workflowForSession(next);
    if (workflow) {
      setTimeout(
        () => advanceWorkflowSession(next.id, {
          singleStep: workflow.automation.mode === "step"
        }),
        0
      );
    }
  } catch (error) {
    announce(error?.message || "Could not apply workflow input.");
  }
}

async function executeWorkflowToolNode(session, workflow, nodeDef, {
  singleStep = false
} = {}) {
  const preset = presetById(nodeDef.config.presetId);
  if (!preset) {
    const failed = failWorkflowSession(
      session,
      "The workflow Preset no longer exists."
    );
    await persistWorkflowSessionTransition(session, failed);
    render();
    return;
  }

  const tool = resolveTool(preset.toolId);
  if (!tool || isStatefulTool(tool.id)) {
    const failed = failWorkflowSession(
      session,
      "This workflow node uses an unavailable or stateful tool."
    );
    await persistWorkflowSessionTransition(session, failed);
    render();
    return;
  }

  await applyPresetToTool(preset, {
    open: false,
    preserveTemplateContext: false
  });

  const ts = ensureToolState(tool.id);
  ts.templateSessionId = null;
  ts.templateStepIndex = null;
  ts.templateStepId = null;

  if (
    nodeDef.config.inputMode === "previous"
    && toolAcceptsListInput(tool.id)
  ) {
    const text = (session.lastOutputItems || []).join("\n");
    if (tool.custom) ts.customInputText = text;
    else ts.listText = text;
    ts.workingSet = null;
    ts.workingSetDirty = false;
    if (selectionTools.has(tool.id)) reconcileToolSelection(tool.id, ts);
  }

  ts.workflowSessionId = session.id;
  ts.workflowNodeId = nodeDef.id;
  ts.workflowSilent = true;
  ts.replayRunId = null;
  ts.result = null;

  await runTool(tool.id);

  const executedState = ensureToolState(tool.id);
  executedState.workflowSessionId = null;
  executedState.workflowNodeId = null;
  executedState.workflowSilent = false;

  const latest = workflowSessionById(session.id);
  if (!latest || latest.revision === session.revision) {
    const message =
      ensureToolState(tool.id).error
      || "Randomizer node did not commit a result.";
    const failed = failWorkflowSession(session, message);
    try {
      await persistWorkflowSessionTransition(session, failed);
    } catch {
      // If the workflow moved concurrently, keep the committed version.
    }
    render();
    return;
  }

  if (
    latest.status === "active"
    && workflow.automation.mode === "auto"
    && !singleStep
  ) {
    setTimeout(() => advanceWorkflowSession(latest.id), 0);
  }
}

async function advanceWorkflowSession(sessionId, {
  singleStep = false
} = {}) {
  if (state.workflowBusy) return;
  const session = workflowSessionById(sessionId);
  if (!session || session.status !== "active") return;

  const workflow = workflowForSession(session);
  if (!workflow) return;

  if (session.stepCount >= workflow.automation.maxSteps) {
    const failed = failWorkflowSession(
      session,
      "Automation stopped at the workflow safety limit of "
        + workflow.automation.maxSteps
        + " steps."
    );
    await persistWorkflowSessionTransition(session, failed);
    render();
    return;
  }

  const nodeDef = workflow.nodes.find(
    (candidate) => candidate.id === session.currentNodeId
  );
  if (!nodeDef) {
    const failed = failWorkflowSession(
      session,
      "The current workflow node no longer exists."
    );
    await persistWorkflowSessionTransition(session, failed);
    render();
    return;
  }

  state.workflowBusy = true;
  try {
    if (nodeDef.type === "tool") {
      await executeWorkflowToolNode(
        session,
        workflow,
        nodeDef,
        { singleStep }
      );
      return;
    }

    if (
      nodeDef.type === "input"
      && nodeDef.config.mode === "prompt"
      && !(session.nodeInputs?.[nodeDef.id] || []).length
    ) {
      const paused = pauseWorkflowSession(session, "input", nodeDef.id);
      await persistWorkflowSessionTransition(session, paused);
      state.workflowInputText = (
        paused.nodeInputs?.[nodeDef.id] || []
      ).join("\n");
      render();
      return;
    }

    let next;
    if (nodeDef.type === "branch") {
      const branch = evaluateBranchCondition(nodeDef.config.condition, {
        items: session.lastOutputItems,
        summary: session.lastSummary
      });
      next = recordWorkflowNode(session, workflow, nodeDef.id, {
        branchPort: branch ? "true" : "false",
        resultItems: session.lastOutputItems,
        summary: session.lastSummary
      });
    } else if (nodeDef.type === "input") {
      const items = nodeDef.config.mode === "fixed"
        ? nodeDef.config.fixedItems
        : (session.nodeInputs?.[nodeDef.id] || []);
      next = recordWorkflowNode(session, workflow, nodeDef.id, {
        resultItems: items,
        summary: items.join(", ")
      });
    } else {
      next = recordWorkflowNode(session, workflow, nodeDef.id, {
        resultItems: session.lastOutputItems,
        summary: session.lastSummary
      });
    }

    await persistWorkflowSessionTransition(session, next);
    render();

    if (next.status === "completed") {
      announce(
        next.lastSummary
          ? "Workflow complete: " + next.lastSummary
          : "Workflow complete."
      );
      return;
    }

    if (workflow.automation.mode === "auto" && !singleStep) {
      setTimeout(() => advanceWorkflowSession(next.id), 0);
    }
  } catch (error) {
    const current = workflowSessionById(session.id) || session;
    if (current.status === "active") {
      const failed = failWorkflowSession(current, error);
      try {
        await persistWorkflowSessionTransition(current, failed);
      } catch {
        // A concurrent commit takes precedence over this failure state.
      }
    }
    announce(error?.message || "Workflow could not continue.");
    render();
  } finally {
    state.workflowBusy = false;
  }
}

async function pauseCurrentWorkflow(session) {
  if (!session || session.status !== "active" || state.workflowBusy) return;
  try {
    const next = pauseWorkflowSession(session, "manual", session.currentNodeId);
    await persistWorkflowSessionTransition(session, next);
    render();
  } catch (error) {
    announce(error?.message || "Could not pause workflow.");
  }
}

async function resumeCurrentWorkflow(session) {
  if (!session || session.status !== "paused") return;
  try {
    const next = resumeWorkflowSession(session);
    await persistWorkflowSessionTransition(session, next);
    render();
    const workflow = workflowForSession(next);
    if (workflow?.automation.mode === "auto") {
      setTimeout(() => advanceWorkflowSession(next.id), 0);
    }
  } catch (error) {
    announce(error?.message || "Could not resume workflow.");
  }
}

async function abandonCurrentWorkflow(session) {
  if (!session || !["active", "paused"].includes(session.status)) return;
  try {
    const next = abandonWorkflowSession(session);
    await persistWorkflowSessionTransition(session, next);
    render();
  } catch (error) {
    announce(error?.message || "Could not end workflow.");
  }
}

function closeWorkflowRunner() {
  state.activeWorkflowSessionId = null;
  state.workflowInputText = "";
  history.replaceState({}, "", location.pathname);
  render();
}

function renderWorkflowRunner() {
  const session = workflowSessionById(state.activeWorkflowSessionId);
  const workflow = session ? workflowForSession(session) : null;

  if (!session || !workflow) {
    return node("main", { class: "content" }, [
      node("h1", { class: "view-title", text: "Workflow unavailable" }),
      node("p", {
        class: "view-subtitle",
        text: "The workflow definition or run could not be found."
      }),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: closeWorkflowRunner
      }, "Back to Decision Studio")
    ]);
  }

  const current = workflow.nodes.find(
    (nodeDef) => nodeDef.id === session.currentNodeId
  ) || null;

  const content = node("main", { class: "content workflow-runner-view" }, [
    node("div", { class: "workflow-page-head" }, [
      node("div", {}, [
        node("div", { class: "kicker", text: "Decision Studio · Workflow run" }),
        node("h1", { class: "view-title", text: workflow.name }),
        node("p", {
          class: "view-subtitle",
          text:
            workflowStatusText(session.status)
            + " · "
            + session.stepCount
            + " executed node"
            + (session.stepCount === 1 ? "" : "s")
            + " · "
            + (workflow.automation.mode === "auto" ? "Auto" : "Step")
        })
      ]),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: closeWorkflowRunner
      }, "Studio")
    ])
  ]);

  if (session.error) {
    content.append(toolError(session.error));
  }

  if (session.status === "paused" && session.pauseReason === "input") {
    const input = node("textarea", {
      class: "field workflow-runtime-input",
      placeholder: "One item per line",
      "aria-label": "Workflow input items"
    });
    input.value = state.workflowInputText || "";
    input.addEventListener("input", () => {
      state.workflowInputText = input.value;
    });

    content.append(node("section", {
      class: "controls workflow-input-gate"
    }, [
      node("div", {}, [
        node("strong", {
          text: current?.name || "Workflow input"
        }),
        node("span", {
          text: "Enter the values this workflow should process."
        })
      ]),
      input,
      node("button", {
        class: "primary",
        type: "button",
        onClick: () => submitWorkflowInput(session)
      }, "Continue")
    ]));
  } else if (session.status === "active" && current) {
    content.append(node("section", {
      class: "workflow-current-node workflow-node-" + current.type
    }, [
      workflowNodeIcon(current.type, "workflow-node-glyph"),
      node("div", {}, [
        node("small", { text: "Current node · " + current.type }),
        node("strong", { text: current.name }),
        current.type === "tool"
          ? node("span", {
              text:
                "Preset · "
                + (presetById(current.config.presetId)?.name || "Missing Preset")
            })
          : null
      ]),
      workflow.automation.mode === "step"
        ? node("button", {
            class: "primary",
            type: "button",
            disabled: state.workflowBusy ? "disabled" : null,
            onClick: () => advanceWorkflowSession(session.id, {
              singleStep: true
            })
          }, "Run next")
        : node("button", {
            class: "secondary",
            type: "button",
            disabled: state.workflowBusy ? "disabled" : null,
            onClick: () => pauseCurrentWorkflow(session)
          }, "Pause")
    ]));
  } else if (session.status === "paused") {
    content.append(node("section", {
      class: "workflow-current-node"
    }, [
      node("div", {}, [
        node("small", { text: "Paused" }),
        node("strong", {
          text: current?.name || "Workflow paused"
        })
      ]),
      node("button", {
        class: "primary",
        type: "button",
        onClick: () => resumeCurrentWorkflow(session)
      }, "Resume")
    ]));
  }

  if (session.lastOutputItems?.length || session.lastSummary) {
    content.append(node("section", {
      class: "tool-stage accent-purple workflow-output-stage"
    }, [
      node("div", { class: "stage-content" }, [
        node("div", {
          class: "stage-label",
          text: session.status === "completed" ? "Final output" : "Latest output"
        }),
        session.lastOutputItems?.length > 1
          ? resultList(session.lastOutputItems)
          : node("div", {
              class: "stage-result",
              text:
                session.lastOutputItems?.[0]
                || session.lastSummary
                || "Result"
            })
      ])
    ]));
  }

  const path = node("section", { class: "workflow-run-path" }, [
    node("div", { class: "workflow-graph-head" }, [
      node("div", {}, [
        node("strong", { text: "Execution path" }),
        node("span", {
          text: session.path.length
            ? session.path.length + " committed nodes"
            : "No nodes committed yet"
        })
      ])
    ])
  ]);

  if (session.path.length) {
    path.append(node("div", { class: "workflow-path-list" },
      session.path.map((entry, index) =>
        node("div", { class: "workflow-path-row" }, [
          node("span", {
            class: "workflow-path-index",
            text: String(index + 1)
          }),
          workflowNodeIcon(
            entry.nodeType,
            "workflow-node-glyph small"
          ),
          node("div", {}, [
            node("strong", { text: entry.nodeName }),
            node("span", {
              text:
                entry.branchPort
                  ? "Branch → " + entry.branchPort
                  : entry.summary || entry.nodeType
            })
          ]),
          entry.runId
            ? node("button", {
                class: "small-action",
                type: "button",
                onClick: () => openRunDetailById(entry.runId)
              }, "Run")
            : null
        ])
      )
    ));
  }

  content.append(path);

  const footerActions = [];
  if (["active", "paused"].includes(session.status)) {
    footerActions.push(node("button", {
      class: "danger",
      type: "button",
      disabled: state.workflowBusy ? "disabled" : null,
      onClick: () => abandonCurrentWorkflow(session)
    }, "End workflow"));
  }

  if (["completed", "abandoned", "error"].includes(session.status)) {
    footerActions.push(
      node("button", {
        class: "secondary",
        type: "button",
        onClick: closeWorkflowRunner
      }, "Back to Studio"),
      node("button", {
        class: "primary",
        type: "button",
        onClick: () => startWorkflowSession(workflow)
      }, "Run again")
    );
  }

  if (footerActions.length) {
    content.append(node("div", {
      class: "workflow-run-footer"
    }, footerActions));
  }

  return content;
}

function workflowCard(workflow) {
  const validation = workflowValidation(workflow);
  const latest = workflowRecentSession(workflow.id);
  const branches = workflow.nodes.filter((nodeDef) => nodeDef.type === "branch").length;
  const randomizers = workflow.nodes.filter((nodeDef) => nodeDef.type === "tool").length;

  return node("article", {
    class: "workflow-card" + (validation.valid ? "" : " is-invalid")
  }, [
    node("div", { class: "workflow-card-head" }, [
      iconNode("studio", { className: "workflow-card-icon" }),
      node("div", {}, [
        node("strong", { text: workflow.name }),
        node("span", {
          text:
            workflow.nodes.length
            + " nodes · "
            + randomizers
            + " randomizers · "
            + branches
            + " branches"
        })
      ]),
      node("span", {
        class: "workflow-mode-pill",
        text: workflow.automation.mode === "auto" ? "Auto" : "Step"
      })
    ]),
    workflow.description
      ? node("p", { text: workflow.description })
      : null,
    !validation.valid
      ? node("div", {
          class: "workflow-card-warning",
          text: validation.errors[0]?.message || "Workflow needs repair."
        })
      : null,
    latest
      ? node("div", {
          class: "workflow-card-latest",
          text:
            "Latest · "
            + workflowStatusText(latest.status)
            + " · "
            + new Intl.DateTimeFormat(currentRegionalLocale(), {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            }).format(new Date(latest.updatedAt))
        })
      : null,
    node("div", { class: "workflow-card-actions" }, [
      latest && ["active", "paused"].includes(latest.status)
        ? node("button", {
            class: "secondary",
            type: "button",
            onClick: () => openWorkflowSession(latest.id)
          }, "Resume")
        : null,
      node("button", {
        class: "small-action",
        type: "button",
        onClick: () => startWorkflowEditor(workflow)
      }, "Edit"),
      node("button", {
        class: "primary",
        type: "button",
        disabled: validation.valid ? null : "disabled",
        onClick: () => startWorkflowSession(workflow)
      }, "Run")
    ])
  ]);
}

function renderWorkflowLibrary() {
  const content = node("main", { class: "content workflow-library-view" }, [
    node("div", { class: "workflow-page-head" }, [
      node("div", {}, [
        node("div", { class: "kicker", text: "Decision Studio" }),
        node("h1", { class: "view-title", text: "Branch decisions into workflows." }),
        node("p", {
          class: "view-subtitle",
          text:
            "Build reusable decision graphs from saved Presets, route results through conditions, "
            + "and run the whole path automatically or one step at a time."
        })
      ]),
      node("button", {
        class: "primary",
        type: "button",
        onClick: () => startWorkflowEditor()
      }, "+ New Workflow")
    ])
  ]);

  const activeSessions = state.workflowSessions
    .filter((session) => ["active", "paused"].includes(session.status))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (activeSessions.length) {
    content.append(sectionHeader(
      "In progress",
      activeSessions.length + " workflow run" + (activeSessions.length === 1 ? "" : "s")
    ));
    content.append(node("div", {
      class: "workflow-active-grid"
    }, activeSessions.slice(0, 6).map((session) => {
      const workflow = workflowForSession(session);
      return node("button", {
        class: "workflow-active-card",
        type: "button",
        onClick: () => openWorkflowSession(session.id)
      }, [
        node("strong", { text: workflow?.name || session.workflowName }),
        node("span", {
          text:
            workflowStatusText(session.status)
            + " · "
            + session.stepCount
            + " nodes committed"
        })
      ]);
    })));
  }

  content.append(sectionHeader(
    "Workflows",
    state.workflows.length
      ? state.workflows.length + " saved"
      : "Create your first reusable decision graph"
  ));

  content.append(
    state.workflows.length
      ? node("div", { class: "workflow-card-grid" },
          state.workflows.map(workflowCard)
        )
      : emptyState(
          "No workflows yet",
          "Start with Input → Outcome, then insert Randomizer and Branch nodes.",
          "Create Workflow",
          () => startWorkflowEditor()
        )
  );

  const recent = state.workflowSessions
    .filter((session) => !["active", "paused"].includes(session.status))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);

  if (recent.length) {
    content.append(sectionHeader("Recent workflow runs", "Completed and ended sessions"));
    content.append(node("div", { class: "workflow-recent-list" },
      recent.map((session) =>
        node("button", {
          class: "workflow-recent-row",
          type: "button",
          onClick: () => openWorkflowSession(session.id)
        }, [
          node("span", {
            class: "workflow-node-glyph small",
            text: session.status === "completed" ? "✓" : "×"
          }),
          node("div", {}, [
            node("strong", {
              text: workflowById(session.workflowId)?.name || session.workflowName
            }),
            node("span", {
              text:
                workflowStatusText(session.status)
                + " · "
                + session.stepCount
                + " nodes"
            })
          ]),
          node("span", {
            text: session.lastSummary || "Open run"
          })
        ])
      )
    ));
  }

  return content;
}

function renderStudio() {
  if (state.workflowEditor) return renderWorkflowEditor();
  if (state.activeWorkflowSessionId) return renderWorkflowRunner();
  return renderWorkflowLibrary();
}

function currentTool() {
  return resolveTool(state.toolId);
}

const BUILTIN_TOOL_VISUAL_FAMILY = Object.freeze({
  coin: "coin",
  dice: "dice",
  wheel: "wheel",
  picker: "list",
  number: "generator",
  shuffle: "list",
  teams: "people",
  pairs: "people",
  cards: "cards",
  chance: "generator",
  lottery: "generator",
  color: "color",
  date: "generator",
  direction: "generator",
  letter: "generator",
  sampler: "list",
  groups: "people",
  assignment: "people",
  elimination: "competition",
  ladder: "competition",
  "secret-santa": "private",
  tournament: "competition",
  time: "generator",
  coordinate: "generator",
  rps: "generator"
});

function toolVisualFamily(tool) {
  if (tool?.custom) {
    const experience = customExperienceFromToolId(tool.id);
    const layout = experience?.appearance?.layout || "auto";
    if (layout === "wheel") return "wheel";
    if (layout === "dice") return "dice";
    if (layout === "card") return "cards";
    if (layout === "list" || layout === "table") return "list";
    if (layout === "number" || layout === "text") return "generator";
    if (experience?.primitive === "deck") return "cards";
    if (["dice", "faces"].includes(experience?.primitive)) return "dice";
    if (["pick", "sample", "shuffle"].includes(experience?.primitive)) {
      return "list";
    }
    return "generator";
  }

  return BUILTIN_TOOL_VISUAL_FAMILY[tool?.id] || "generator";
}

function toolFamilyLabel(family) {
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

function renderTool() {
  const tool = currentTool();
  const toolState = ensureToolState(tool.id);
  const family = toolVisualFamily(tool);
  const content = node("main", { class: "content tool-view-v2" });
  const favorite = state.favorites.includes(tool.id);

  const head = node("div", {
    class: "tool-head accent-" + tool.accent
  }, [
    iconButton("Back", iconNode("back"), closeTool, "tool-back-button"),
    node("div", { class: "tool-identity" }, [
      node("div", { class: "tool-symbol-shell", "aria-hidden": "true" },
        visualToolIcon(tool, "tool-symbol")
      ),
      node("div", { class: "tool-title-copy" }, [
        node("span", {
          class: "tool-family-label",
          text: toolFamilyLabel(family)
        }),
        node("h1", { text: tool.name }),
        node("p", { text: tool.blurb })
      ])
    ]),
    node("div", { class: "tool-head-actions" }, [
      iconButton(
        favorite ? "Remove favorite" : "Add favorite",
        iconNode(favorite ? "star-filled" : "star"),
        () => toggleFavorite(tool.id),
        favorite ? "favorite-star" : ""
      ),
      iconButton(
        "Randomness settings",
        iconNode("settings"),
        openSettingsPanel
      )
    ])
  ]);

  const ruleStrip = renderRuleStrip(tool, toolState);
  const stage = buildStage(tool, toolState);
  const actions = buildToolActionDock(tool, toolState);
  const controls = buildControls(tool, toolState);

  const workspace = node("div", { class: "tool-workspace" }, [
    node("div", { class: "tool-play-column" }, [
      stage,
      actions
    ]),
    controls
  ]);

  content.append(node("section", {
    class:
      "tool-screen tool-screen-v2 tool-family-"
      + family
      + " tool-id-"
      + tool.id
      + " accent-"
      + tool.accent,
    dataset: {
      tool: tool.id,
      family
    }
  }, [head, ruleStrip, workspace].filter(Boolean)));

  return content;
}

function resultList(items) {
  const values = Array.isArray(items) ? items : [];
  const preview = values.slice(0, RESULT_RENDER_LIMIT);
  const rows = preview.map((item, index) =>
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
  );

  if (values.length > preview.length) {
    rows.push(node("div", {
      class: "result-render-cap",
      text:
        "+ "
        + (values.length - preview.length)
        + " more stored results not rendered"
    }));
  }

  return node("div", { class: "result-list" }, rows);
}

function teamsResult(groups, prefix = "Team") {
  const values = Array.isArray(groups) ? groups : [];
  const perGroupLimit = Math.max(
    12,
    Math.floor(RESULT_RENDER_LIMIT / Math.max(1, values.length))
  );

  return node("div", { class: "teams-grid" }, values.map((group, index) => {
    const visible = group.slice(0, perGroupLimit);
    return node("div", {
      class: "team-card",
      style: { "--accent": palette[index % palette.length] }
    }, [
      node("strong", { text: prefix + " " + (index + 1) }),
      ...visible.map((person) =>
        node("div", { class: "team-member", text: person })
      ),
      group.length > visible.length
        ? node("div", {
            class: "result-render-cap",
            text:
              "+ "
              + (group.length - visible.length)
              + " more"
          })
        : null
    ]);
  }));
}

function tournamentResult(matches) {
  const values = Array.isArray(matches) ? matches : [];
  const matchLimit = Math.max(
    1,
    Math.floor(RESULT_RENDER_LIMIT / 2)
  );
  const preview = values.slice(0, matchLimit);
  const rows = preview.map((match, index) =>
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
  );

  if (values.length > preview.length) {
    rows.push(node("div", {
      class: "result-render-cap",
      text:
        "+ "
        + (values.length - preview.length)
        + " more stored matches not rendered"
    }));
  }

  return node("div", { class: "bracket-list" }, rows);
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

async function historyPairsForTool(tool, ts) {
  const active = (ts.rules || []).filter(
    (rule) => rule.enabled !== false && rule.type === "historyAvoid"
  );
  if (!active.length) return new Set();

  const depth = Math.max(
    ...active.map((rule) => Number(rule.params?.depth) || 5)
  );

  const [persistedRuns, persistedLegacy] = await Promise.all([
    getRecentForTool("runs", tool.id, depth),
    getRecentForTool("history", tool.id, depth)
  ]);

  const canonical = mergeRecentRecords(
    state.runs.filter((run) => run.toolId === tool.id),
    persistedRuns,
    { sortKey: "timestamp", limit: depth }
  ).map((run) => ({
    toolId: run.toolId,
    detail: run.detail,
    timestamp: run.timestamp
  }));

  const legacy = mergeRecentRecords(
    state.history.filter((entry) => entry.toolId === tool.id),
    persistedLegacy,
    { sortKey: "timestamp", limit: depth }
  ).map((entry) => ({
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

  if (selectionTools.has(tool.id)) {
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
  } else if (tool.custom) {
    const experience = customExperienceFromToolId(tool.id);
    if (experience) {
      rules.push("Custom");
      rules.push(experience.primitive);
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
    " motion-v2",
    p.celebration ? " is-celebration" : "",
    p.reducedMotion ? " is-reduced-reveal" : ""
  ].join("");
}

function presentationStageStyle(ts) {
  const p = ts.presentation;
  if (!p) return {};
  return {
    "--present-duration": p.duration + "ms",
    "--anticipation-duration": p.anticipationMs + "ms",
    "--reveal-duration": p.revealMs + "ms",
    "--settle-duration": p.settleMs + "ms",
    "--active-duration": p.activeMs + "ms",
    "--impact-delay": p.impactMs + "ms",
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

function customWheelModel(experience, ts) {
  if (!experience) return null;

  try {
    const entries = prepareCustomListEntries(
      experience,
      {
        inputItems: parseList(ts.customInputText)
      }
    );

    return normalizeSelection(
      entries.map((entry) => entry.label),
      entries.map((entry, index) => ({
        key: entry.id || (entry.label + "\u001f" + index),
        label: entry.label,
        weight: Number(entry.weight ?? 1),
        excluded: false
      }))
    );
  } catch {
    return null;
  }
}

function customResultDisplay(result) {
  if (result == null) return "READY";
  if (typeof result === "string" || typeof result === "number") {
    return String(result);
  }
  if (Array.isArray(result)) {
    return result.length === 1 ? String(result[0]) : result.join(", ");
  }
  if (result.value != null) return String(result.value);
  if (result.total != null) return String(result.total);
  if (result.card != null) return String(result.card);
  if (Array.isArray(result.cards)) return result.cards.join(", ");
  if (Array.isArray(result.items)) return result.items.join(", ");
  if (result.output != null) return customResultDisplay(result.output);
  if (result.summary != null) return String(result.summary);
  return "RESULT";
}

function customResultListValues(result) {
  if (result == null) return [];
  if (Array.isArray(result)) return result.map(String);
  if (Array.isArray(result.cards)) return result.cards.map(String);
  if (Array.isArray(result.items)) return result.items.map(String);
  if (result.output != null) return customResultItems(result.output);
  return [];
}

function buildCustomStage(tool, ts, wrap) {
  const experience = customExperienceFromToolId(tool.id);
  const result = ts.result;
  if (!experience) {
    wrap.append(node("div", {
      class: "stage-result",
      text: "UNAVAILABLE"
    }));
    return;
  }

  const layout = experience.appearance.layout === "auto"
    ? (
        experience.primitive === "dice" || experience.primitive === "faces"
          ? "dice"
          : experience.primitive === "deck"
            ? "card"
            : experience.primitive === "shuffle"
              ? "list"
              : experience.primitive === "number"
                ? "number"
                : experience.primitive === "table"
                  ? "table"
                  : "text"
      )
    : experience.appearance.layout;

  if (layout === "wheel") {
    const model = customWheelModel(experience, ts);
    const wheel = node("div", {
      class: "wheel",
      style: {
        background: makeWheelGradient(model),
        transform:
          "rotate(" + (ts.previousWheelRotation || 0) + "deg)",
        transitionDuration:
          (ts.presentation?.activeMs || ts.presentation?.duration || 0) + "ms"
      }
    });
    const labels = wheelLabels(model);
    if (labels) wheel.append(labels);

    wrap.append(
      node("div", { class: "wheel-wrap" }, [
        wheel,
        node("div", {
          class: "wheel-pointer",
          "aria-hidden": "true"
        }),
        node("div", {
          class: "wheel-center-label",
          text: (model?.eligibleCount || 0) + " eligible"
        })
      ]),
      node("div", {
        class: "stage-label",
        text: experience.appearance.resultLabel
      }),
      node("div", {
        class: "stage-result",
        text: customResultDisplay(result)
      })
    );

    if (ts.pendingWheelRotation != null) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wheel.style.transform =
          "rotate(" + ts.pendingWheelRotation + "deg)";
      }));
    }
    return;
  }

  if (layout === "dice") {
    let rolls = [];
    if (Array.isArray(result)) rolls = result;
    else if (result?.diceGroups?.length) {
      rolls = result.diceGroups.flatMap((group) =>
        group.dice.map((die) => die.total)
      );
    }

    wrap.append(
      rolls.length
        ? node("div", {
            class: "dice-row " + (ts.animating ? "rolling" : "")
          }, rolls.slice(0, 20).map((value) =>
            node("div", {
              class: "die custom-die",
              text: String(value)
            })
          ))
        : null,
      node("div", {
        class: "stage-label",
        text: experience.appearance.resultLabel
      }),
      node("div", {
        class: "stage-result",
        text: customResultDisplay(result)
      })
    );
    return;
  }

  if (layout === "card") {
    const cards = customResultListValues(result);
    wrap.append(
      node("div", {
        class: "stage-label",
        text: experience.appearance.resultLabel
      }),
      cards.length
        ? node("div", { class: "custom-card-row" },
            cards.slice(0, 12).map((card) =>
              node("div", {
                class: "play-card custom-play-card",
                text: card
              })
            )
          )
        : node("div", {
            class: "stage-result play-card custom-play-card",
            text: "DRAW"
          }),
      result?.remaining != null
        ? node("div", {
            class: "stage-sub",
            text: result.remaining + " remain in source deck"
          })
        : null
    );
    return;
  }

  if (layout === "list") {
    const values = customResultListValues(result);
    wrap.append(
      node("div", {
        class: "stage-label",
        text: experience.appearance.resultLabel
      }),
      values.length
        ? resultList(values)
        : node("div", {
            class: "stage-result",
            text: customResultDisplay(result)
          })
    );
    return;
  }

  if (layout === "table" && result?.label != null) {
    wrap.append(
      node("div", {
        class: "stage-label",
        text: result.label
      }),
      node("div", {
        class: "stage-result",
        text: String(result.value)
      })
    );
    return;
  }

  wrap.append(
    node("div", {
      class: "stage-label",
      text: experience.appearance.resultLabel
    }),
    node("div", {
      class: "stage-result",
      text: customResultDisplay(result)
    }),
    experience.primitive === "compound" && result?.steps?.length
      ? resultList(
          result.steps.map((step) =>
            step.name + " · " + step.summary
          )
        )
      : null
  );
}

function diceFaceNode(value, sides) {
  const numeric = Number(value);
  const isPipFace =
    Number(sides) === 6
    && Number.isInteger(numeric)
    && numeric >= 1
    && numeric <= 6;

  if (!isPipFace) {
    return node("div", {
      class: "die die-number",
      text: String(value)
    });
  }

  const patterns = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  };

  return node("div", {
    class: "die die-pips",
    "aria-label": String(numeric)
  }, patterns[numeric].map((position) =>
    node("span", {
      class: "die-pip pip-" + position,
      "aria-hidden": "true"
    })
  ));
}

function playingCardVisual(card) {
  const text = String(card || "");
  const suit = text.slice(-1);
  const rank = text.slice(0, -1) || "?";
  const red = /[♥♦]/.test(suit);

  return node("div", {
    class: "play-card playing-card " + (red ? "red-card" : "black-card"),
    "aria-label": text || "No card drawn"
  }, [
    node("span", { class: "card-corner top", text: rank + suit }),
    node("span", { class: "card-suit", text: suit || "?" }),
    node("span", { class: "card-corner bottom", text: rank + suit })
  ]);
}

function buildStage(tool, ts) {
  const family = toolVisualFamily(tool);
  const stage = node("div", {
    class:
      "tool-stage tool-stage-v2 stage-family-"
      + family
      + " stage-tool-"
      + tool.id
      + " accent-"
      + tool.accent
      + presentationStageClasses(tool, ts),
    dataset: {
      tool: tool.id,
      family
    },
    style: presentationStageStyle(ts)
  });
  const wrap = node("div", { class: "stage-content" });
  const result = ts.result;

  if (tool.custom) {
    buildCustomStage(tool, ts, wrap);
  } else if (tool.id === "coin") {
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
          diceFaceNode(value, result?.sides || ts.diceSides)
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
    const localizedValues = localizedNumberResultValues(result);
    if (localizedValues.length > 1) {
      wrap.append(
        node("div", { class: "stage-label", text: "Random numbers" }),
        node("div", {
          class: "stage-result",
          text: localizedNumber(result.count) + " VALUES",
          style: { fontSize: "clamp(36px,9vw,58px)" }
        }),
        resultList(localizedValues)
      );
    } else {
      wrap.append(
        node("div", { class: "stage-label", text: "Random number" }),
        node("div", {
          class: "stage-result",
          text: localizedValues[0] || "GENERATE"
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
          (ts.presentation?.activeMs || ts.presentation?.duration || 0) + "ms"
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
    wrap.append(
      node("div", {
        class: "card-stage-visual",
        "aria-hidden": result ? "true" : null
      }, [
        node("div", { class: "card-deck" }, [
          node("span", { class: "card-deck-mark" },
            iconNode("brand")
          )
        ]),
        result
          ? playingCardVisual(result.card)
          : node("div", {
              class: "play-card playing-card card-placeholder"
            }, [
              node("span", { class: "card-suit", text: "?" })
            ])
      ]),
      node("div", {
        class: "stage-label",
        text: result ? "Drawn card" : "52-card deck"
      }),
      result
        ? node("div", {
            class: "stage-result card-result-label",
            text: result.card
          })
        : node("div", {
            class: "stage-result card-result-label",
            text: "DRAW"
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
    node("div", { class: "tool-error-mark", "aria-hidden": "true" },
      iconNode("warning")
    ),
    node("div", { class: "tool-error-copy" }, [
      node("strong", { text: "Could not randomize" }),
      node("span", { text: message })
    ])
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
    iconNode("chance", { className: "fairness-icon" }),
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
        node("div", { class: "fairness-probabilities" }, [
          ...model.entries
            .slice(0, FAIRNESS_RENDER_LIMIT)
            .map((entry) =>
              node("div", {
                class: "fairness-probability-row" + (!entry.eligible ? " is-ineligible" : "")
              }, [
                node("span", { text: entry.label }),
                node("strong", {
                  text: entry.excluded ? "Excluded" : percentage(entry.probability)
                })
              ])
            ),
          model.entries.length > FAIRNESS_RENDER_LIMIT
            ? node("div", {
                class: "fairness-probability-row fairness-render-cap"
              }, [
                node("span", {
                  text:
                    (model.entries.length - FAIRNESS_RENDER_LIMIT)
                    + " additional entries"
                }),
                node("strong", {
                  text: "Stored, not rendered"
                })
              ])
            : null
        ])
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
    announce("Undid the last " + resolveTool(toolId).name + " action.");
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
    announce("Redid the stored " + resolveTool(toolId).name + " result.");
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

  if (!resolveTool(run.toolId)) {
    announce("The tool definition for this historical Run is no longer available.");
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
  scrollToTop();
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

  if (!resolveTool(run.toolId)) {
    announce("The tool definition for this historical Run is no longer available.");
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

async function resumeStoredSession(session) {
  if (!session) return;

  try {
    await ensureRunsLoaded(session.runIds || []);
  } catch (error) {
    announce(error?.message || "Could not load Session history.");
    return;
  }

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
  scrollToTop();
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

function customControls(tool, ts) {
  const experience = customExperienceFromToolId(tool.id);
  const wrap = node("div", { class: "custom-runtime-controls" });

  if (!experience) {
    return toolError("This Custom Experience no longer exists.");
  }

  wrap.append(node("div", { class: "custom-runtime-summary" }, [
    node("div", {}, [
      node("strong", { text: experience.primitive }),
      node("span", {
        text:
          "Revision "
          + experience.revision
          + " · declarative"
      })
    ]),
    node("button", {
      class: "small-action",
      type: "button",
      onClick: () => openBuilder(experience.id)
    }, "Edit in Builder")
  ]));

  if (customExperienceNeedsPromptInput(experience)) {
    const input = node("textarea", {
      class: "field",
      "aria-label": "Custom Experience input",
      placeholder: "One item per line"
    });
    input.value = ts.customInputText;
    input.addEventListener("input", () => {
      ts.customInputText = input.value;
      invalidateTool(tool.id, ts);
    });
    wrap.append(node("div", {
      class: "control custom-prompt-input"
    }, [
      node("label", { text: "Input for this run" }),
      input
    ]));
  } else {
    const count =
      experience.config.entries?.length
      || experience.config.rows?.length
      || experience.config.cards?.length
      || experience.config.faces?.length
      || experience.config.steps?.length
      || null;

    wrap.append(node("div", {
      class: "notice custom-definition-notice",
      text:
        "Definition is locked at runtime"
        + (count != null ? " · " + count + " configured items/steps" : "")
        + ". Edit it in Builder."
    }));
  }

  return wrap;
}

function buildControls(tool, ts) {
  const family = toolVisualFamily(tool);
  const controls = node("div", {
    class:
      "controls tool-controls tool-controls-"
      + family
  });
  const grid = node("div", { class: "control-grid" });

  controls.append(node("div", { class: "tool-controls-head" }, [
    node("div", {}, [
      node("span", { text: "Setup" }),
      node("strong", { text: "Tune this randomizer" })
    ]),
    node("small", {
      text:
        family === "people" || family === "competition"
          ? "Inputs, rules & fairness"
          : family === "private"
            ? "Private setup & reveal"
            : "Inputs & options"
    })
  ]));

  const templateBar = templateContextBar(tool, ts);
  if (templateBar) controls.append(templateBar);

  const sessionBar = sessionControlBar(tool, ts);
  if (sessionBar) controls.append(sessionBar);

  if (ts.error) controls.append(toolError(ts.error));

  if (tool.custom) {
    controls.append(customControls(tool, ts));
  } else if (toolAcceptsListInput(tool.id)) {
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
              : toolAcceptsListInput(tool.id)
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

function buildToolActionDock(tool, ts) {
  const dock = node("div", {
    class:
      "tool-action-dock tool-action-"
      + toolVisualFamily(tool)
      + (ts.presentation ? " is-presenting" : ""),
    style: presentationStageStyle(ts)
  });

  const primary = node("button", {
    class: "primary action-button tool-primary-action",
    type: "button",
    onClick: () => runTool(tool.id)
  }, ts.computing ? "WORKING…" : actionLabel(tool.id, ts));

  if (
    ts.computing
    || ts.replayRunId
    || (tool.id === "cards" && Array.isArray(ts.deck) && ts.deck.length === 0)
  ) {
    primary.disabled = true;
  }

  dock.append(primary);

  const secondary = node("div", {
    class: "tool-action-secondary"
  });

  if (tool.id === "cards" && ts.deck && !ts.replayRunId) {
    secondary.append(node("button", {
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
    secondary.append(node("button", {
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
    secondary.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: shareCurrentResult
    }, "Share"));

    if (tool.id !== "secret-santa") {
      secondary.append(node("button", {
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
      }, "Use Result In…"));
    }
  }

  if (secondary.childElementCount) {
    dock.append(secondary);
  }

  return dock;
}

function actionLabel(id, ts) {
  if (ts.animating) return "SHOW RESULT";
  const customExperience = customExperienceFromToolId(id);
  if (customExperience) {
    return customExperience.appearance.actionLabel || "GENERATE";
  }
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

  if (customExperienceFromToolId(id)) {
    after.lastCustomFairness = cloneData(output.fairness || null);
  }

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
  const tool = resolveTool(id);
  let ts = ensureToolState(id);

  if (ts.computing) return;
  if (state.computeBusy) {
    announce("Another randomization is still committing.");
    return;
  }

  if (ts.animating || ts.presentation) {
    if (skipPresentation(id)) return;
  }

  if (!ts.workflowSilent) {
    primeAudio(
      normalizeExperienceSettings(state.settings).presentation.sound
    );
  }

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

  ts.computing = true;
  state.computeBusy = true;
  if (state.toolId === id || state.view === "party") render();

  try {
    if (constraintTools.has(id)) {
      const context = constraintContext(tool, ts);
      config.constraintItems = context.items;
      config.constraintFields = context.fields;
      config.historyPairs = [
        ...await historyPairsForTool(tool, ts)
      ];
    }

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
    let workflowSession = ts.workflowSessionId
      ? workflowSessionById(ts.workflowSessionId)
      : null;
    let workflow = workflowSession
      ? workflowForSession(workflowSession)
      : null;
    let expectedWorkflowSessionRevision = workflowSession?.revision ?? null;

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

    if (workflowSession) {
      const workflowNode = workflow?.nodes?.find(
        (candidate) => candidate.id === ts.workflowNodeId
      );
      if (
        !workflow
        || workflowSession.status !== "active"
        || workflowSession.currentNodeId !== ts.workflowNodeId
        || workflowNode?.type !== "tool"
      ) {
        throw new Error("This Decision Studio workflow node is no longer active.");
      }
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

    const customExperience = tool.custom
      ? customExperienceFromToolId(id)
      : null;
    const computeStart =
      globalThis.performance?.now
        ? globalThis.performance.now()
        : Date.now();
    const offload = shouldOffloadTool(
      id,
      config,
      customExperience
    ) && computeWorkerSupported();

    const executeOnMainThread = () => (
      customExperience
        ? executeCustomExperience(
            customExperience,
            {
              inputItems: parseList(ts.customInputText)
            },
            prepared.source
          )
        : executeTool(id, config, prepared.source)
    );

    let output;
    if (offload) {
      try {
        output = await runComputeTask("tool.execute", {
          toolId: id,
          config,
          customExperience,
          customInputItems: parseList(ts.customInputText),
          randomSpec: prepared.workerRandomSpec
        });
        state.performance.workerTasks += 1;
        state.performance.lastComputeMode = "worker";
      } catch (error) {
        if ([
          "COMPUTE_WORKER_UNAVAILABLE",
          "COMPUTE_WORKER_POST_FAILED",
          "COMPUTE_WORKER_CRASHED"
        ].includes(error?.code)) {
          output = executeOnMainThread();
          state.performance.mainThreadTasks += 1;
          state.performance.lastComputeMode = "main-fallback";
        } else {
          throw error;
        }
      }
    } else {
      output = executeOnMainThread();
      state.performance.mainThreadTasks += 1;
      state.performance.lastComputeMode = "main";
    }

    const computeEnd =
      globalThis.performance?.now
        ? globalThis.performance.now()
        : Date.now();
    state.performance.lastComputeMs = Math.max(
      0,
      Math.round((computeEnd - computeStart) * 10) / 10
    );

    let result = output.result;
    let summary = output.summary;

    if (id === "date") {
      const date = new Date(result.timestamp);
      const localized = new Intl.DateTimeFormat(currentRegionalLocale(), {
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
      workflowSessionId: workflowSession?.id || null,
      workflowNodeId: ts.workflowNodeId || null,
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
    let nextWorkflowSession = null;
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

    if (workflowSession) {
      nextWorkflowSession = recordWorkflowNode(
        workflowSession,
        workflow,
        ts.workflowNodeId,
        {
          runId: run.id,
          resultItems: resultToItems(id, result),
          summary
        }
      );
    }

    await commitRunAndSession({
      run,
      session: nextSession,
      event,
      templateSession: nextTemplateSession,
      partySession: nextPartySession,
      workflowSession: nextWorkflowSession,
      settingsRecord: prepared.settingsRecord,
      expectedSessionRevision,
      expectedTemplateSessionRevision,
      expectedPartySessionRevision,
      expectedWorkflowSessionRevision
    });

    if (prepared.nextSettings) state.settings = prepared.nextSettings;

    state.runs = [
      run,
      ...state.runs.filter((candidate) => candidate.id !== run.id)
    ].sort((a, b) => b.timestamp - a.timestamp);

    if (nextSession) replaceSession(nextSession);
    if (nextTemplateSession) replaceTemplateSession(nextTemplateSession);
    if (nextPartySession) replacePartySession(nextPartySession);
    if (nextWorkflowSession) replaceWorkflowSession(nextWorkflowSession);

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

    if (nextWorkflowSession) {
      state.activeWorkflowSessionId = nextWorkflowSession.id;
    }

    const plan = beginPresentation(
      id,
      ts,
      result,
      { silent: Boolean(nextWorkflowSession) }
    );

    if (nextPartySession) {
      broadcastPartyAudience({
        party: nextPartySession,
        run,
        stage: "result"
      });
    }

    if (
      id === "wheel"
      || (
        tool.custom
        && customExperience?.appearance?.layout === "wheel"
        && Number.isSafeInteger(output.detail?.selectedIndex)
      )
    ) {
      const index = output.detail.selectedIndex;
      const model = id === "wheel"
        ? normalizeSelection(config.items, config.selectionEntries || [])
        : customWheelModel(customExperience, ts);
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

    ts.computing = false;
    state.computeBusy = false;
    render();
    announce(tool.name + " result: " + summary);
  } catch (error) {
    ts = ensureToolState(id);
    ts.computing = false;
    state.computeBusy = false;
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
  if (customExperienceFromToolId(id)) {
    return customResultDisplay(result);
  }

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
    editor.visibleLimit = POOL_RENDER_CHUNK;
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
    editor.visibleLimit = POOL_RENDER_CHUNK;
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
  const visibleWindow = progressiveSlice(
    visible,
    editor.visibleLimit || POOL_RENDER_CHUNK,
    POOL_RENDER_CHUNK
  );
  const renderedVisible = visibleWindow.visible;

  const selected = editor.selected;
  const bulkTag = node("input", {
    class: "field bulk-tag-input",
    placeholder: "Tag selected",
    "aria-label": "Tag selected items"
  });

  modal.append(node("div", { class: "pool-bulk-bar" }, [
    node("span", {
      text:
        selected.size
        + " selected · "
        + visible.length
        + " matches · "
        + renderedVisible.length
        + " rendered"
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
  for (const item of renderedVisible) {
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

  if (visibleWindow.hasMore) {
    modal.append(node("div", {
      class: "pool-render-more"
    }, [
      node("span", {
        text:
          visibleWindow.shown
          + " of "
          + visibleWindow.total
          + " matching items rendered"
      }),
      node("button", {
        class: "secondary",
        type: "button",
        onClick: () => {
          editor.visibleLimit = visibleWindow.nextLimit;
          render();
        }
      }, "Render more")
    ]));
  }

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
  const tool = resolveTool(config.toolId);
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
  const tool = resolveTool(config.toolId);
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
  const tool = resolveTool(config.toolId);
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
  if (toolAcceptsListInput(tool.id)) {
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

  const tool = resolveTool(preset.toolId);
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
  const tool = resolveTool(config.toolId);
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
  const targets = [
    ...TOOLS.map((tool) => tool.id),
    ...state.customExperiences
      .filter(
        (experience) =>
          experience.status === "published"
          && customExperienceNeedsPromptInput(experience)
      )
      .map((experience) => customToolId(experience.id))
  ]
    .filter((id) => id !== config.sourceToolId)
    .filter((id) => toolAcceptsListInput(id))
    .map(resolveTool)
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
            if (tool.custom) next.customInputText = items.join("\n");
            else next.listText = items.join("\n");
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
        visualToolIcon(tool, "tool-icon"),
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
          + (resolveTool(preset.toolId)?.name || preset.toolId)
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
              "aria-label": "Remove template step " + (index + 1),
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

  const formatter = new Intl.DateTimeFormat(currentRegionalLocale(), {
    dateStyle: "medium",
    timeStyle: "long"
  });

  modal.append(
    node("div", { class: "run-detail-title" }, [
      node("span", { class: "history-icon" },
        visualToolIcon(
          resolveTool(run.toolId) || {
            id: run.toolId,
            icon: run.icon || "✦"
          },
          "run-detail-tool-icon"
        )
      ),
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

  if (
    run.origin !== "legacy"
    && run.afterState
    && (run.toolId === "studio" || resolveTool(run.toolId))
  ) {
    actions.append(node("button", {
      class: "secondary",
      type: "button",
      onClick: () => replayStoredRun(run)
    }, "Replay"));
  }

  if (
    run.origin !== "legacy"
    && run.beforeState
    && (run.toolId === "studio" || resolveTool(run.toolId))
  ) {
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

function renderModal(previousFocusIdentity = null) {
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
    && state.modal.type === "portable-import"
  ) {
    renderPortableImportModal(modal, state.modal);
  } else if (
    typeof state.modal === "object"
    && state.modal.type === "import-custom-experience"
  ) {
    renderCustomImportModal(modal, state.modal);
  } else if (
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
    state.settings = normalizeAccessibilitySettings(
      normalizeExperienceSettings(state.settings)
    );

    modal.append(
      node("h2", { text: "Randomness" }),
      node("p", {
        text: "Secure mode uses Web Crypto. Seeded mode gives a reproducible sequence for testing and shared challenges."
      })
    );

    const modes = node("div", {
      class: "segmented",
      "aria-label": "Randomness mode"
    });

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
      class: "segmented settings-reveal-modes",
      "aria-label": "Reveal mode"
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

    modal.append(
      node("h3", {
        class: "settings-section-title",
        text: "Accessibility & region"
      }),
      node("p", {
        class: "settings-section-copy",
        text:
          "Regional format changes dates and numbers without changing the app language. Contrast and control size are local display preferences."
      })
    );

    const regionalFormat = node("select", {
      class: "field",
      "aria-label": "Regional format"
    }, [
      node("option", { value: "auto", text: "Region · System default" }),
      node("option", { value: "en-US", text: "Region · English (United States)" }),
      node("option", { value: "de-DE", text: "Region · Deutsch (Deutschland)" }),
      node("option", { value: "fr-FR", text: "Region · Français (France)" }),
      node("option", { value: "ko-KR", text: "Region · 한국어 (대한민국)" })
    ]);
    regionalFormat.value = state.settings.accessibility.regionalFormat;
    regionalFormat.addEventListener("change", async () => {
      await updateAccessibilitySetting(
        "regionalFormat",
        regionalFormat.value
      );
      render();
    });

    const contrast = node("select", {
      class: "field",
      "aria-label": "Contrast preference"
    }, [
      node("option", { value: "system", text: "Contrast · System" }),
      node("option", { value: "standard", text: "Contrast · Standard" }),
      node("option", { value: "more", text: "Contrast · Higher" })
    ]);
    contrast.value = state.settings.accessibility.contrast;
    contrast.addEventListener("change", async () => {
      await updateAccessibilitySetting("contrast", contrast.value);
      render();
    });

    const controlSize = node("select", {
      class: "field",
      "aria-label": "Control size"
    }, [
      node("option", { value: "standard", text: "Controls · Standard" }),
      node("option", { value: "large", text: "Controls · Large" })
    ]);
    controlSize.value = state.settings.accessibility.controlSize;
    controlSize.addEventListener("change", async () => {
      await updateAccessibilitySetting(
        "controlSize",
        controlSize.value
      );
      render();
    });

    modal.append(node("div", {
      class: "settings-accessibility-grid"
    }, [
      regionalFormat,
      contrast,
      controlSize
    ]));

    modal.append(
      node("h3", {
        class: "settings-section-title",
        text: "Data & devices"
      }),
      node("p", {
        class: "settings-section-copy",
        text:
          "Randomizer is local-first. Backups and transfer packages are ordinary files that you control; no account or cloud service is required."
      })
    );

    const storage = state.storageStatus;
    const device = state.device;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches
      || navigator.standalone === true;

    const deviceName = node("input", {
      class: "field",
      type: "text",
      value: device?.name || "This device",
      "aria-label": "Device name",
      placeholder: "This device"
    });
    deviceName.addEventListener("change", () => {
      renameCurrentDevice(deviceName.value);
    });

    modal.append(node("section", {
      class: "settings-data-panel"
    }, [
      node("div", { class: "settings-data-status-grid" }, [
        node("div", {}, [
          node("span", { text: "Storage" }),
          node("strong", {
            text: storage
              ? formatStorageBytes(storage.usage)
                + (storage.quota
                  ? " / " + formatStorageBytes(storage.quota)
                  : "")
              : "Checking…"
          })
        ]),
        node("div", {}, [
          node("span", { text: "Durability" }),
          node("strong", {
            text: storage?.persisted ? "Persistent" : "Best effort"
          })
        ]),
        node("div", {}, [
          node("span", { text: "Network" }),
          node("strong", {
            text: state.networkOnline ? "Online" : "Offline"
          })
        ]),
        node("div", {}, [
          node("span", { text: "App" }),
          node("strong", {
            text:
              state.updateAvailable
                ? "Update ready"
                : standalone
                  ? "Installed PWA"
                  : "Browser"
          })
        ]),
        node("div", {}, [
          node("span", { text: "Compute" }),
          node("strong", {
            text: computeWorkerSupported()
              ? "Background worker"
              : "Main thread"
          })
        ]),
        node("div", {}, [
          node("span", { text: "History cache" }),
          node("strong", {
            text:
              (state.runs.length + state.history.length)
              + (
                state.historyPaging.runsHasMore
                || state.historyPaging.historyHasMore
                  ? "+ loaded"
                  : " loaded"
              )
          })
        ]),
        node("div", {}, [
          node("span", { text: "Last compute" }),
          node("strong", {
            text:
              state.performance.lastComputeMs == null
                ? "—"
                : state.performance.lastComputeMode
                  + " · "
                  + state.performance.lastComputeMs
                  + " ms"
          })
        ]),
        node("div", {}, [
          node("span", { text: "Worker tasks" }),
          node("strong", {
            text:
              state.performance.workerTasks
              + " worker · "
              + state.performance.mainThreadTasks
              + " main"
          })
        ])
      ]),
      node("label", { class: "control settings-device-name" }, [
        node("span", {
          text:
            "Device name"
            + (device?.deviceId
              ? " · " + device.deviceId.slice(0, 8)
              : "")
        }),
        deviceName
      ]),
      node("div", { class: "settings-device-actions" }, [
        !storage?.persisted
          ? node("button", {
              class: "small-action",
              type: "button",
              onClick: requestDurableStorage
            }, "Protect local storage")
          : null,
        state.installPrompt
          ? node("button", {
              class: "small-action",
              type: "button",
              onClick: installPwa
            }, "Install app")
          : null,
        state.updateAvailable
          ? node("button", {
              class: "small-action",
              type: "button",
              onClick: activateWaitingServiceWorker
            }, "Apply update")
          : null
      ].filter(Boolean)),
      node("div", { class: "settings-backup-actions" }, [
        node("button", {
          class: "secondary",
          type: "button",
          onClick: async () => {
            try {
              await downloadPortablePackage("full");
            } catch (error) {
              announce(error?.message || "Could not create backup.");
            }
          }
        }, "Download full backup"),
        node("button", {
          class: "secondary",
          type: "button",
          onClick: openPortableImportPicker
        }, "Import / restore"),
        node("button", {
          class: "secondary",
          type: "button",
          onClick: shareLibraryPackage
        }, "Share library"),
        node("button", {
          class: "secondary",
          type: "button",
          onClick: async () => {
            try {
              await downloadPortablePackage("library");
            } catch (error) {
              announce(error?.message || "Could not create transfer package.");
            }
          }
        }, "Download transfer file")
      ]),
      node("div", {
        class: "notice settings-data-note",
        text:
          "Full backup includes run history and active sessions. Library transfer contains reusable Pools, Presets, Rule Sets, Session Templates, Custom Experiences, Workflows, favorites, and settings. Device identity stays local to each device."
      })
    ]));

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
      const tool = resolveTool(id);
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
        visualToolIcon(tool, "tool-icon"),
        node("strong", { text: tool.name }),
        node("small", { text: tool.blurb })
      ]);
    })));
  }

  finalizeModalAccessibility(modal, previousFocusIdentity);
  backdrop.append(modal);
  return backdrop;
}

function render() {
  if (!state.settings) return;

  applyAccessibilityPreferences();
  root.setAttribute("aria-busy", state.computeBusy ? "true" : "false");
  if (!state.modal) {
    root.removeAttribute("inert");
    root.removeAttribute("aria-hidden");
  }

  const existingBackdrop = document.querySelector(".modal-backdrop");
  const existingModal = existingBackdrop?.querySelector(".modal") || null;
  const nextSignature = modalSignature();
  const sameModal =
    Boolean(existingModal)
    && Boolean(nextSignature)
    && modalFocusSignature === nextSignature;
  const previousModalFocus =
    sameModal && existingModal?.contains(document.activeElement)
      ? focusIdentity(document.activeElement)
      : null;

  if (!existingBackdrop && state.modal) {
    modalReturnFocus = focusIdentity(document.activeElement);
  }

  const restoreFocusAfterClose =
    Boolean(existingBackdrop)
    && !state.modal
    && modalReturnFocus
      ? modalReturnFocus
      : null;

  document.querySelectorAll(".modal-backdrop").forEach((item) => item.remove());

  if (state.view === "audience") {
    const main = renderAudience();
    main.id = "main-content";
    main.tabIndex = -1;
    applySegmentedSemantics(main);
    root.replaceChildren(main);
    return;
  }

  if (state.view === "party") {
    const main = renderParty();
    main.id = "main-content";
    main.tabIndex = -1;
    applySegmentedSemantics(main);
    root.replaceChildren(main);
    return;
  }

  const layout = node("div", {
    class: "layout",
    dataset: { view: state.view }
  });
  layout.append(topBar());

  if (state.view === "play") layout.append(renderPlay());
  else if (state.view === "arcade") layout.append(renderArcade());
  else if (state.view === "pools") layout.append(renderPools());
  else if (state.view === "history") layout.append(renderHistory());
  else if (state.view === "studio") layout.append(renderStudio());
  else if (state.view === "template-session") layout.append(renderTemplateSession());
  else if (state.view === "creations") layout.append(renderCreations());
  else if (state.view === "builder") layout.append(renderBuilder());
  else if (state.view === "tool") layout.append(renderTool());

  layout.append(primaryNavigation());

  const main = layout.querySelector("main");
  if (main) {
    main.id = "main-content";
    main.tabIndex = -1;
    main.classList.add("shell-main");
  }

  applySegmentedSemantics(layout);

  root.replaceChildren(layout);

  const modal = renderModal(previousModalFocus);
  if (modal) {
    document.body.append(modal);
    modalFocusSignature = nextSignature;
  } else {
    modalFocusSignature = null;
  }

  root.toggleAttribute("inert", Boolean(modal));
  if (modal) root.setAttribute("aria-hidden", "true");
  else root.removeAttribute("aria-hidden");

  if (restoreFocusAfterClose) {
    window.requestAnimationFrame(() => {
      matchingFocusable(document, restoreFocusAfterClose)?.focus({
        preventScroll: true
      });
    });
    modalReturnFocus = null;
  }
}

function refreshPwaUpdateState() {
  const available = Boolean(state.swRegistration?.waiting);
  if (state.updateAvailable !== available) {
    state.updateAvailable = available;
    if (state.modal === "settings") render();
  }
}

async function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    state.swRegistration = registration;
    refreshPwaUpdateState();

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed"
          && navigator.serviceWorker.controller
        ) {
          state.updateAvailable = true;
          if (state.modal === "settings") render();
        }
      });
    });

    registration.update().catch(() => {});
    return registration;
  } catch {
    return null;
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
  if (state.modal === "settings") render();
});

window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  announce("Randomizer installed.");
  if (state.modal === "settings") render();
});

window.addEventListener("online", () => {
  state.networkOnline = true;
  if (state.modal === "settings") render();
});

window.addEventListener("offline", () => {
  state.networkOnline = false;
  if (state.modal === "settings") render();
});

const contrastMediaQuery =
  window.matchMedia?.("(prefers-contrast: more)") || null;
if (contrastMediaQuery) {
  const syncSystemContrast = () => {
    if (
      state.settings?.accessibility?.contrast === "system"
    ) {
      applyAccessibilityPreferences();
    }
  };
  if (typeof contrastMediaQuery.addEventListener === "function") {
    contrastMediaQuery.addEventListener("change", syncSystemContrast);
  } else if (typeof contrastMediaQuery.addListener === "function") {
    contrastMediaQuery.addListener(syncSystemContrast);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (state.reloadingForUpdate) {
      state.reloadingForUpdate = false;
      location.reload();
    }
  });
}

async function init() {
  const params = new URLSearchParams(location.search);
  const requestedAudience = safeRouteToken(params.get("audience"));

  if (requestedAudience) {
    state.settings = normalizeExperienceSettings({});
    state.audiencePartyId = requestedAudience;
    state.view = "audience";
    state.toolId = null;

    const channel = partyChannelFor(requestedAudience);
    if (channel) {
      channel.onmessage = (event) => {
        const payload = normalizeAudienceMessage(
          event.data,
          requestedAudience
        );
        if (!payload) return;
        state.audienceState = payload;
        render();
      };

      channel.postMessage({
        type: "party-state-request",
        partyId: requestedAudience
      });
    }

    render();

    registerAppServiceWorker();
    return;
  }

  await loadData();
  [state.device, state.storageStatus] = await Promise.all([
    getDeviceIdentity(),
    getStorageStatus()
  ]);

  const requestedParty = safeRouteToken(params.get("party"));
  const requestedWorkflowSession =
    safeRouteToken(params.get("workflowSession"));
  const requestedTemplateSession =
    safeRouteToken(params.get("templateSession"));
  const requestedBuilder = safeRouteToken(params.get("builder"));
  const requestedTool = safeRouteToken(params.get("tool"));
  const requestedView = params.get("view");

  if (
    requestedTemplateSession
    && !templateSessionById(requestedTemplateSession)
  ) {
    const [stored] = await getMany(
      "templateSessions",
      [requestedTemplateSession]
    );
    if (stored) replaceTemplateSession(stored);
  }

  if (
    requestedWorkflowSession
    && !workflowSessionById(requestedWorkflowSession)
  ) {
    const [stored] = await getMany(
      "workflowSessions",
      [requestedWorkflowSession]
    );
    if (stored) replaceWorkflowSession(stored);
  }

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
    requestedWorkflowSession
    && workflowSessionById(requestedWorkflowSession)
  ) {
    const workflowSession = workflowSessionById(requestedWorkflowSession);
    state.activeWorkflowSessionId = workflowSession.id;
    state.workflowInputText = workflowSession.pauseReason === "input"
      ? (workflowSession.nodeInputs?.[workflowSession.currentNodeId] || []).join("\n")
      : "";
    state.view = "studio";
    state.toolId = null;
  } else if (
    requestedBuilder
    && customExperienceById(requestedBuilder)
  ) {
    const experience = customExperienceById(requestedBuilder);
    state.builder = {
      draft: cloneData(experience),
      baseRevision: experience.revision,
      isNew: false,
      testIndex: 0,
      testInput: "Option A\nOption B\nOption C",
      testResult: null,
      error: null
    };
    state.view = "builder";
    state.toolId = null;
  } else if (
    requestedTemplateSession
    && templateSessionById(requestedTemplateSession)
  ) {
    state.activeTemplateSessionId = requestedTemplateSession;
    state.view = "template-session";
    state.toolId = null;
  } else if (resolveTool(requestedTool)) {
    state.view = "tool";
    state.toolId = requestedTool;
    ensureToolState(requestedTool);
    maybeResumeLatestSession(requestedTool);
  } else if (
    ["play", "arcade", "studio", "pools", "history"].includes(requestedView)
  ) {
    state.view = requestedView;
    state.toolId = null;
  }

  render();

  const resumedWorkflowSession = workflowSessionById(
    state.activeWorkflowSessionId
  );
  if (
    state.view === "studio"
    && resumedWorkflowSession?.status === "active"
  ) {
    const resumedWorkflow = workflowForSession(resumedWorkflowSession);
    if (resumedWorkflow?.automation.mode === "auto") {
      setTimeout(
        () => advanceWorkflowSession(resumedWorkflowSession.id),
        0
      );
    }
  }

  registerAppServiceWorker();

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
