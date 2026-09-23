export const REGIONAL_FORMATS = Object.freeze([
  "auto",
  "en-US",
  "de-DE",
  "fr-FR",
  "ko-KR"
]);

export const CONTRAST_MODES = Object.freeze([
  "system",
  "standard",
  "more"
]);

export const CONTROL_SIZE_MODES = Object.freeze([
  "standard",
  "large"
]);

export const DEFAULT_ACCESSIBILITY_SETTINGS = Object.freeze({
  regionalFormat: "auto",
  contrast: "system",
  controlSize: "standard"
});

export function normalizeAccessibilitySettings(settings = {}) {
  const source = settings.accessibility || {};
  return {
    ...settings,
    accessibility: {
      regionalFormat: REGIONAL_FORMATS.includes(source.regionalFormat)
        ? source.regionalFormat
        : DEFAULT_ACCESSIBILITY_SETTINGS.regionalFormat,
      contrast: CONTRAST_MODES.includes(source.contrast)
        ? source.contrast
        : DEFAULT_ACCESSIBILITY_SETTINGS.contrast,
      controlSize: CONTROL_SIZE_MODES.includes(source.controlSize)
        ? source.controlSize
        : DEFAULT_ACCESSIBILITY_SETTINGS.controlSize
    }
  };
}

export function resolveRegionalLocale(
  preference = "auto",
  languages = []
) {
  if (
    preference
    && preference !== "auto"
    && REGIONAL_FORMATS.includes(preference)
  ) {
    return preference;
  }

  const candidates = Array.isArray(languages)
    ? languages
    : [languages];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;

    try {
      return Intl.getCanonicalLocales(value)[0] || "en-US";
    } catch {
      // Continue to the next browser language.
    }
  }

  return "en-US";
}

export function languageFromLocale(locale) {
  try {
    return new Intl.Locale(locale).language || "en";
  } catch {
    return "en";
  }
}

export function formatDateTime(
  value,
  locale,
  options = {}
) {
  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(
    locale || "en-US",
    options
  ).format(date);
}

export function formatNumber(
  value,
  locale,
  options = {}
) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(
    locale || "en-US",
    options
  ).format(number);
}

export function formatBytes(
  value,
  locale,
  {
    maximumFractionDigits = 1
  } = {}
) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const amount = bytes / (1024 ** index);

  return formatNumber(amount, locale, {
    maximumFractionDigits:
      index === 0 ? 0 : maximumFractionDigits
  }) + " " + units[index];
}

export function effectiveContrastMode(
  preference = "system",
  systemMore = false
) {
  if (preference === "more") return "more";
  if (preference === "standard") return "standard";
  return systemMore ? "more" : "standard";
}

export function focusableSelector() {
  return [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");
}

export function nextFocusIndex({
  currentIndex,
  count,
  shiftKey = false
}) {
  if (!Number.isSafeInteger(count) || count <= 0) return -1;
  const current = Number.isSafeInteger(currentIndex)
    ? currentIndex
    : -1;

  if (shiftKey) {
    return current <= 0 ? count - 1 : current - 1;
  }
  return current < 0 || current >= count - 1
    ? 0
    : current + 1;
}
