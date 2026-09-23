import assert from "node:assert/strict";
import {
  normalizeAccessibilitySettings,
  resolveRegionalLocale,
  languageFromLocale,
  formatDateTime,
  formatNumber,
  formatBytes,
  effectiveContrastMode,
  nextFocusIndex
} from "../src/accessibility-i18n.js";

{
  const normalized = normalizeAccessibilitySettings({
    accessibility: {
      regionalFormat: "de-DE",
      contrast: "more",
      controlSize: "large"
    }
  });
  assert.equal(normalized.accessibility.regionalFormat, "de-DE");
  assert.equal(normalized.accessibility.contrast, "more");
  assert.equal(normalized.accessibility.controlSize, "large");
}

{
  const normalized = normalizeAccessibilitySettings({
    accessibility: {
      regionalFormat: "invalid",
      contrast: "invalid",
      controlSize: "invalid"
    }
  });
  assert.deepEqual(normalized.accessibility, {
    regionalFormat: "auto",
    contrast: "system",
    controlSize: "standard"
  });
}

assert.equal(
  resolveRegionalLocale("fr-FR", ["de-DE"]),
  "fr-FR"
);
assert.equal(
  resolveRegionalLocale("auto", ["de-DE"]),
  "de-DE"
);
assert.equal(languageFromLocale("ko-KR"), "ko");

{
  const german = formatNumber(1234.5, "de-DE", {
    minimumFractionDigits: 1
  });
  assert.ok(german.includes(","), german);
}

{
  const text = formatDateTime(
    new Date("2026-09-23T12:00:00Z"),
    "en-US",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC"
    }
  );
  assert.ok(text.includes("2026"), text);
}

assert.equal(formatBytes(0, "en-US"), "0 B");
assert.ok(formatBytes(1536, "en-US").includes("KB"));

assert.equal(effectiveContrastMode("system", true), "more");
assert.equal(effectiveContrastMode("standard", true), "standard");

assert.equal(
  nextFocusIndex({
    currentIndex: 2,
    count: 3,
    shiftKey: false
  }),
  0
);
assert.equal(
  nextFocusIndex({
    currentIndex: 0,
    count: 3,
    shiftKey: true
  }),
  2
);

console.log("accessibility/i18n model tests passed");
