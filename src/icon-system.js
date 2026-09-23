const SVG_NS = ["http:", "", "www.w3.org", "2000", "svg"].join("/");

const COMMON = Object.freeze({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
});

function el(tag, attrs = {}) {
  return { tag, attrs };
}

const p = (d, attrs = {}) => el("path", { d, ...attrs });
const c = (cx, cy, r, attrs = {}) => el("circle", { cx, cy, r, ...attrs });
const r = (x, y, width, height, rx = 0, attrs = {}) =>
  el("rect", { x, y, width, height, rx, ...attrs });
const l = (x1, y1, x2, y2, attrs = {}) =>
  el("line", { x1, y1, x2, y2, ...attrs });
const pl = (points, attrs = {}) => el("polyline", { points, ...attrs });
const pg = (points, attrs = {}) => el("polygon", { points, ...attrs });

export const ICON_DEFINITIONS = Object.freeze({
  brand: [
    p("M12 4.25c.55 3.15 2.35 4.95 5.5 5.5-3.15.55-4.95 2.35-5.5 5.5-.55-3.15-2.35-4.95-5.5-5.5 3.15-.55 4.95-2.35 5.5-5.5Z"),
    c(18.5, 5.5, 1.1, { fill: "currentColor", stroke: "none" }),
    c(5.25, 18.25, .9, { fill: "currentColor", stroke: "none" })
  ],

  play: [
    c(12, 12, 8.25),
    pg("10 8.6 16 12 10 15.4", { fill: "currentColor", stroke: "none" })
  ],
  arcade: [
    r(4, 4, 6, 6, 1.6),
    r(14, 4, 6, 6, 1.6),
    r(4, 14, 6, 6, 1.6),
    r(14, 14, 6, 6, 1.6)
  ],
  studio: [
    c(6, 7, 2),
    c(18, 6, 2),
    c(12, 18, 2),
    l(7.8, 7.2, 16.1, 6.3),
    l(7.2, 8.7, 10.9, 16.3),
    l(16.9, 7.7, 13.1, 16.3)
  ],
  pools: [
    p("M4.5 7.5 12 4l7.5 3.5L12 11 4.5 7.5Z"),
    p("M4.5 12 12 15.5 19.5 12"),
    p("M4.5 16.5 12 20l7.5-3.5")
  ],
  history: [
    p("M5.4 7.3A8 8 0 1 1 4 12"),
    pl("4 5.5 5.4 7.3 7.5 6"),
    l(12, 8, 12, 12.4),
    l(12, 12.4, 15, 14.2)
  ],
  settings: [
    c(12, 12, 2.6),
    p("M19.1 13.3a7.9 7.9 0 0 0 0-2.6l1.7-1.25-2-3.45-2.05.9a8.7 8.7 0 0 0-2.25-1.3L14.25 3h-4.5L9.5 5.6a8.7 8.7 0 0 0-2.25 1.3L5.2 6l-2 3.45 1.7 1.25a7.9 7.9 0 0 0 0 2.6L3.2 14.55l2 3.45 2.05-.9a8.7 8.7 0 0 0 2.25 1.3l.25 2.6h4.5l.25-2.6a8.7 8.7 0 0 0 2.25-1.3l2.05.9 2-3.45-1.7-1.25Z")
  ],
  back: [
    l(19, 12, 5, 12),
    pl("10 7 5 12 10 17")
  ],
  search: [
    c(10.5, 10.5, 5.75),
    l(14.8, 14.8, 19.5, 19.5)
  ],
  star: [
    pg("12 3.9 14.35 8.65 19.6 9.4 15.8 13.1 16.7 18.35 12 15.9 7.3 18.35 8.2 13.1 4.4 9.4 9.65 8.65")
  ],
  "star-filled": [
    pg("12 3.9 14.35 8.65 19.6 9.4 15.8 13.1 16.7 18.35 12 15.9 7.3 18.35 8.2 13.1 4.4 9.4 9.65 8.65", {
      fill: "currentColor"
    })
  ],
  template: [
    r(4.5, 4.5, 6, 5, 1.2),
    r(13.5, 14.5, 6, 5, 1.2),
    p("M10.5 7h2a3 3 0 0 1 3 3v4.5"),
    pl("13.6 12.6 15.5 14.5 17.4 12.6")
  ],
  lock: [
    r(5.5, 10.5, 13, 9, 2),
    p("M8 10.5V8a4 4 0 0 1 8 0v2.5"),
    c(12, 14.7, 1, { fill: "currentColor", stroke: "none" }),
    l(12, 15.7, 12, 17.2)
  ],

  check: [
    c(12, 12, 8),
    pl("8.4 12.2 10.8 14.6 15.8 9.5")
  ],
  pause: [
    c(12, 12, 8),
    l(9.5, 8.5, 9.5, 15.5),
    l(14.5, 8.5, 14.5, 15.5)
  ],
  warning: [
    p("M12 4.2 20 18H4L12 4.2Z"),
    l(12, 9, 12, 13),
    c(12, 16.1, .8, { fill: "currentColor", stroke: "none" })
  ],
  info: [
    c(12, 12, 8),
    l(12, 10.5, 12, 16),
    c(12, 7.6, .85, { fill: "currentColor", stroke: "none" })
  ],
  offline: [
    p("M5 9.5a10.5 10.5 0 0 1 14 0"),
    p("M8 12.5a6 6 0 0 1 8 0"),
    p("M10.8 15.5a2.4 2.4 0 0 1 2.4 0"),
    l(4, 4, 20, 20)
  ],

  "category-classics": [
    p("M12 4.2c.55 3.1 2.35 4.9 5.45 5.45-3.1.55-4.9 2.35-5.45 5.45-.55-3.1-2.35-4.9-5.45-5.45 3.1-.55 4.9-2.35 5.45-5.45Z"),
    c(18.4, 17.5, 1.15, { fill: "currentColor", stroke: "none" })
  ],
  "category-people": [
    c(9, 8, 2.5),
    c(16.5, 9, 2),
    p("M4.5 19c.35-3.5 2-5.4 4.5-5.4s4.15 1.9 4.5 5.4"),
    p("M14 14.2c2.9-.55 4.85 1.2 5.5 4.8")
  ],
  "category-generators": [
    p("M6 18 17.5 6.5"),
    p("m15.5 4 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"),
    c(6.1, 18, 1.6)
  ],
  "category-games": [
    p("M8 5h8v4.5a4 4 0 0 1-8 0V5Z"),
    p("M8 7H5.5v1.5A3.5 3.5 0 0 0 9 12"),
    p("M16 7h2.5v1.5A3.5 3.5 0 0 1 15 12"),
    l(12, 13.5, 12, 17),
    l(8.5, 19, 15.5, 19)
  ],

  coin: [
    c(12, 12, 8),
    p("M12 4a8 8 0 0 1 0 16"),
    l(12, 7.5, 12, 16.5)
  ],
  dice: [
    r(4.5, 4.5, 15, 15, 3),
    c(8.3, 8.3, 1, { fill: "currentColor", stroke: "none" }),
    c(15.7, 8.3, 1, { fill: "currentColor", stroke: "none" }),
    c(12, 12, 1, { fill: "currentColor", stroke: "none" }),
    c(8.3, 15.7, 1, { fill: "currentColor", stroke: "none" }),
    c(15.7, 15.7, 1, { fill: "currentColor", stroke: "none" })
  ],
  wheel: [
    c(12, 12, 8),
    c(12, 12, 2),
    l(12, 4, 12, 10),
    l(18.9, 8, 13.7, 11),
    l(18.9, 16, 13.7, 13),
    l(12, 20, 12, 14),
    l(5.1, 16, 10.3, 13),
    l(5.1, 8, 10.3, 11)
  ],
  picker: [
    c(12, 12, 3),
    p("M12 4v3M12 17v3M4 12h3M17 12h3"),
    p("M6.35 6.35 8.5 8.5M15.5 15.5l2.15 2.15M17.65 6.35 15.5 8.5M8.5 15.5l-2.15 2.15")
  ],
  number: [
    l(9, 4.5, 7, 19.5),
    l(17, 4.5, 15, 19.5),
    l(5.5, 9, 19, 9),
    l(5, 15, 18.5, 15)
  ],
  shuffle: [
    p("M4.5 7h2.2c4.6 0 5.3 10 10.4 10H19"),
    pl("16.5 14.5 19 17 16.5 19.5"),
    p("M4.5 17h2.2c1.4 0 2.5-.9 3.5-2.2"),
    p("M13.4 8.4c1-1 2.1-1.4 3.7-1.4H19"),
    pl("16.5 4.5 19 7 16.5 9.5")
  ],
  teams: [
    c(9, 8, 2.2),
    c(16.5, 9, 1.8),
    p("M4.5 18.5c.4-3.2 2-5 4.5-5s4.1 1.8 4.5 5"),
    p("M14.1 14.2c2.7-.5 4.6 1 5.4 4.3")
  ],
  pairs: [
    c(8.2, 9, 2.3),
    c(15.8, 9, 2.3),
    p("M4.8 18c.4-3 1.6-4.6 3.4-4.6s3 1.6 3.4 4.6"),
    p("M12.4 18c.4-3 1.6-4.6 3.4-4.6s3 1.6 3.4 4.6"),
    l(10.7, 11.6, 13.3, 11.6)
  ],
  cards: [
    r(7, 4.5, 10.5, 14.5, 2),
    p("M7 7 5.6 7.4a2 2 0 0 0-1.4 2.45l2.6 8.95"),
    p("M10 8.5h4.5M10 12h4.5M10 15.5h3")
  ],
  chance: [
    c(8, 8, 2),
    c(16, 16, 2),
    l(7, 17, 17, 7)
  ],
  lottery: [
    p("M5 7.5h14v3a2 2 0 0 0 0 4v3H5v-3a2 2 0 0 0 0-4v-3Z"),
    p("M12 9.2l.75 1.55 1.7.25-1.23 1.2.3 1.7-1.52-.8-1.52.8.3-1.7-1.23-1.2 1.7-.25L12 9.2Z")
  ],
  color: [
    p("M12 4.5c4.4 0 7.5 2.8 7.5 6.5 0 2.2-1.3 3.6-3.2 3.6h-1.2c-.9 0-1.4.8-1.05 1.6.55 1.25-.25 2.3-1.75 2.3-4.5 0-7.8-3-7.8-7.1 0-3.9 3.3-6.9 7.5-6.9Z"),
    c(8.2, 10, .9, { fill: "currentColor", stroke: "none" }),
    c(11, 7.8, .9, { fill: "currentColor", stroke: "none" }),
    c(14.3, 8.2, .9, { fill: "currentColor", stroke: "none" })
  ],
  date: [
    r(4.5, 6, 15, 13.5, 2.3),
    l(8, 4, 8, 8),
    l(16, 4, 16, 8),
    l(4.5, 10, 19.5, 10),
    c(9, 14.5, .8, { fill: "currentColor", stroke: "none" }),
    c(14.5, 14.5, .8, { fill: "currentColor", stroke: "none" })
  ],
  direction: [
    c(12, 12, 8),
    pg("14.4 8.2 12.9 12.9 8.2 14.4 9.7 9.7", { fill: "currentColor", stroke: "none" }),
    c(12, 12, 1)
  ],
  letter: [
    p("M7 18 12 6l5 12"),
    l(8.7, 14, 15.3, 14)
  ],
  sampler: [
    c(7, 8, 1.7),
    c(12, 8, 1.7),
    c(17, 8, 1.7),
    p("M5 17c.2-2.4 1-3.7 2-3.7s1.8 1.3 2 3.7"),
    p("M10 17c.2-2.4 1-3.7 2-3.7s1.8 1.3 2 3.7"),
    p("M15 17c.2-2.4 1-3.7 2-3.7s1.8 1.3 2 3.7"),
    p("m18.5 4 .45 1.45 1.55.45-1.55.45-.45 1.45-.45-1.45-1.55-.45 1.55-.45.45-1.45Z")
  ],
  groups: [
    r(4.5, 5, 6, 5.5, 1.3),
    r(13.5, 5, 6, 5.5, 1.3),
    r(4.5, 13.5, 6, 5.5, 1.3),
    r(13.5, 13.5, 6, 5.5, 1.3)
  ],
  assignment: [
    c(6.5, 7, 2),
    c(6.5, 17, 2),
    r(15, 5, 4.5, 4, 1),
    r(15, 15, 4.5, 4, 1),
    p("M8.5 7h4.5l-1.7-1.7M13 7l-1.7 1.7"),
    p("M8.5 17h4.5l-1.7-1.7M13 17l-1.7 1.7")
  ],
  elimination: [
    c(12, 12, 8),
    c(12, 12, 4.5),
    c(12, 12, 1.2),
    l(6.2, 17.8, 17.8, 6.2)
  ],
  ladder: [
    l(7, 4, 7, 20),
    l(17, 4, 17, 20),
    l(7, 7, 17, 7),
    l(7, 11, 17, 14),
    l(7, 17, 17, 17)
  ],
  "secret-santa": [
    r(5, 9, 14, 11, 2),
    r(4, 7, 16, 4, 1.4),
    l(12, 7, 12, 20),
    p("M12 7c-1.7 0-4.5-.8-4.5-2.3 0-1.05.8-1.7 1.8-1.7C11 3 12 7 12 7Zm0 0c1.7 0 4.5-.8 4.5-2.3 0-1.05-.8-1.7-1.8-1.7C13 3 12 7 12 7Z")
  ],
  tournament: [
    p("M5 5v4h4M5 19v-4h4M19 5v4h-4M19 19v-4h-4"),
    p("M9 7h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h0"),
    p("M15 7h-2")
  ],
  time: [
    c(12, 12, 8),
    l(12, 7, 12, 12.5),
    l(12, 12.5, 15.5, 14.5)
  ],
  coordinate: [
    c(12, 12, 2),
    c(12, 12, 7),
    l(12, 3.5, 12, 7),
    l(12, 17, 12, 20.5),
    l(3.5, 12, 7, 12),
    l(17, 12, 20.5, 12)
  ],
  rps: [
    c(7.2, 13.2, 3.1),
    r(14, 5.5, 5, 5, 1),
    p("M13.8 18.2 18.8 13M13.8 13l5 5.2")
  ],

  input: [
    r(4.5, 6, 15, 12, 2),
    l(8, 10, 16, 10),
    l(8, 14, 13, 14)
  ],
  branch: [
    p("M5 12h5a4 4 0 0 0 4-4V5"),
    p("M10 12h4a4 4 0 0 1 4 4v3"),
    pl("11.5 5 14 2.5 16.5 5"),
    pl("15.5 19 18 21.5 20.5 19")
  ],
  output: [
    r(4.5, 6, 15, 12, 2),
    l(8, 12, 15.5, 12),
    pl("13 9.5 15.5 12 13 14.5")
  ]
});

export const TOOL_ICON_IDS = Object.freeze([
  "coin","dice","wheel","picker","number","shuffle","teams","pairs","cards",
  "chance","lottery","color","date","direction","letter","sampler","groups",
  "assignment","elimination","ladder","secret-santa","tournament","time",
  "coordinate","rps"
]);

export const CATEGORY_ICON_IDS = Object.freeze([
  "category-classics",
  "category-people",
  "category-generators",
  "category-games"
]);

export const NAV_ICON_IDS = Object.freeze([
  "play",
  "arcade",
  "studio",
  "pools",
  "history"
]);

export function hasIcon(name) {
  return Object.hasOwn(ICON_DEFINITIONS, String(name || ""));
}

export function toolIconId(tool) {
  const id = String(tool?.iconId || tool?.id || "");
  return hasIcon(id) ? id : null;
}

export function categoryIconId(category) {
  const id = String(
    category?.iconId || ("category-" + String(category?.id || ""))
  );
  return hasIcon(id) ? id : null;
}

export function iconNode(name, {
  className = "",
  size = null,
  title = null,
  decorative = true
} = {}) {
  if (typeof document === "undefined") {
    throw new Error("iconNode requires a DOM document.");
  }

  const definition = ICON_DEFINITIONS[String(name || "")];
  if (!definition) {
    throw new Error("Unknown icon: " + String(name || ""));
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [key, value] of Object.entries(COMMON)) {
    svg.setAttribute(key, value);
  }

  svg.setAttribute(
    "class",
    ["ra-icon", className].filter(Boolean).join(" ")
  );

  if (size != null) {
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
  }

  if (decorative) {
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
  } else if (title) {
    svg.setAttribute("role", "img");
    const titleNode = document.createElementNS(SVG_NS, "title");
    titleNode.textContent = String(title);
    svg.append(titleNode);
  }

  for (const part of definition) {
    const child = document.createElementNS(SVG_NS, part.tag);
    for (const [key, value] of Object.entries(part.attrs)) {
      child.setAttribute(key, String(value));
    }
    svg.append(child);
  }

  return svg;
}
