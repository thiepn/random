import {
  normalizeAccessibilitySettings,
  effectiveContrastMode,
  effectiveTheme
} from "./accessibility-i18n.js";

const THEMES = [
  ["system", "System"],
  ["light", "Light"],
  ["dark", "Dark"]
];

const ACCENTS = [
  ["violet", "Violet"],
  ["cyan", "Cyan"],
  ["blue", "Blue"],
  ["pink", "Pink"],
  ["red", "Red"],
  ["gold", "Gold"],
  ["green", "Green"],
  ["orange", "Orange"]
];

function mediaMatches(query) {
  return Boolean(
    window.matchMedia && window.matchMedia(query).matches
  );
}

export function applyVisualPreferences(
  settings,
  { locale = "en-US", reducedMotion = false } = {}
) {
  const normalized = normalizeAccessibilitySettings(settings);
  const accessibility = normalized.accessibility;
  const root = document.documentElement;
  const theme = effectiveTheme(
    accessibility.theme,
    mediaMatches("(prefers-color-scheme: dark)")
  );

  root.dataset.locale = locale;
  root.dataset.theme = theme;
  root.dataset.accent = accessibility.accent;
  root.dataset.contrast = effectiveContrastMode(
    accessibility.contrast,
    mediaMatches("(prefers-contrast: more)")
  );
  root.dataset.controlSize = accessibility.controlSize;
  root.dataset.motion = reducedMotion ? "reduced" : "full";
  root.style.colorScheme = theme;

  try {
    localStorage.setItem("randomizer.visual.v1", JSON.stringify({
      theme: accessibility.theme,
      accent: accessibility.accent,
      contrast: accessibility.contrast,
      controlSize: accessibility.controlSize,
      motion:
        settings?.presentation?.motion
        || settings?.motion
        || "system"
    }));
  } catch {}

  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "light" ? "#f6f7fb" : "#0a0c18"
  );

  return normalized;
}

export function createThemeAccentControls({
  node,
  settings,
  onChange
}) {
  const accessibility =
    normalizeAccessibilitySettings(settings).accessibility;

  const themes = node("div", {
    class: "segmented settings-theme-modes",
    "aria-label": "Color theme"
  }, THEMES.map(([value, label]) =>
    node("button", {
      class: accessibility.theme === value ? "active" : "",
      type: "button",
      onClick: () => onChange("theme", value)
    }, label)
  ));

  const accents = node("div", {
    class: "settings-accent-picker",
    role: "group",
    "aria-label": "Accent color"
  }, ACCENTS.map(([value, label]) =>
    node("button", {
      class:
        "settings-accent-choice accent-choice-" + value
        + (accessibility.accent === value ? " active" : ""),
      type: "button",
      "aria-pressed":
        accessibility.accent === value ? "true" : "false",
      title: label + " accent",
      onClick: () => onChange("accent", value)
    }, [
      node("span", {
        class: "settings-accent-swatch",
        "aria-hidden": "true"
      }),
      node("span", { text: label })
    ])
  ));

  return [themes, accents];
}

export function createDisplayPreferenceControls({
  node,
  settings,
  onChange
}) {
  const accessibility =
    normalizeAccessibilitySettings(settings).accessibility;
  const [themes, accents] = createThemeAccentControls({
    node,
    settings,
    onChange
  });

  function select(label, value, options, key) {
    const control = node("select", {
      class: "field",
      "aria-label": label
    }, options.map(([optionValue, text]) =>
      node("option", { value: optionValue, text })
    ));
    control.value = value;
    control.addEventListener("change", () =>
      onChange(key, control.value)
    );
    return control;
  }

  const regional = select(
    "Regional format",
    accessibility.regionalFormat,
    [
      ["auto", "Region · System default"],
      ["en-US", "Region · English (United States)"],
      ["de-DE", "Region · Deutsch (Deutschland)"],
      ["fr-FR", "Region · Français (France)"],
      ["ko-KR", "Region · 한국어 (대한민국)"]
    ],
    "regionalFormat"
  );

  const contrast = select(
    "Contrast preference",
    accessibility.contrast,
    [
      ["system", "Contrast · System"],
      ["standard", "Contrast · Standard"],
      ["more", "Contrast · Higher"]
    ],
    "contrast"
  );

  const controlSize = select(
    "Control size",
    accessibility.controlSize,
    [
      ["standard", "Controls · Standard"],
      ["large", "Controls · Large"]
    ],
    "controlSize"
  );

  return [
    themes,
    accents,
    node("div", { class: "settings-accessibility-grid" }, [
      regional,
      contrast,
      controlSize
    ])
  ];
}

function listen(query, callback) {
  const media = window.matchMedia?.(query) || null;
  if (!media) return;
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", callback);
  } else if (typeof media.addListener === "function") {
    media.addListener(callback);
  }
}

export function bindVisualPreferenceMedia({
  getSettings,
  onPreferenceChange
}) {
  listen("(prefers-contrast: more)", () => {
    if (getSettings()?.accessibility?.contrast === "system") {
      onPreferenceChange();
    }
  });
  listen("(prefers-color-scheme: dark)", () => {
    if (getSettings()?.accessibility?.theme === "system") {
      onPreferenceChange();
    }
  });
  listen("(prefers-reduced-motion: reduce)", () => {
    const settings = getSettings();
    const motion =
      settings?.presentation?.motion
      || settings?.motion
      || "system";
    if (motion === "system") onPreferenceChange();
  });
}
