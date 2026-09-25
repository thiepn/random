(() => {
  const root = document.documentElement;
  let saved = {};
  try {
    saved = JSON.parse(
      localStorage.getItem("randomizer.visual.v1") || "{}"
    ) || {};
  } catch {}

  const matches = (query) =>
    Boolean(window.matchMedia?.(query)?.matches);

  const theme =
    saved.theme === "light" || saved.theme === "dark"
      ? saved.theme
      : matches("(prefers-color-scheme: dark)")
        ? "dark"
        : "light";
  const contrast =
    saved.contrast === "more" || saved.contrast === "standard"
      ? saved.contrast
      : matches("(prefers-contrast: more)")
        ? "more"
        : "standard";
  const motion =
    saved.motion === "reduced" || saved.motion === "full"
      ? saved.motion
      : matches("(prefers-reduced-motion: reduce)")
        ? "reduced"
        : "full";

  root.dataset.theme = theme;
  root.dataset.accent = [
    "violet", "cyan", "blue", "pink",
    "red", "gold", "green", "orange"
  ].includes(saved.accent) ? saved.accent : "violet";
  root.dataset.contrast = contrast;
  root.dataset.controlSize =
    saved.controlSize === "large" ? "large" : "standard";
  root.dataset.motion = motion;
  root.style.colorScheme = theme;
})();